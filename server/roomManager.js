"use strict";

const crypto = require("crypto");
const constants = require("../shared/constants");
const scoring = require("../shared/scoring");
const validation = require("../shared/validation");
const { GameSession } = require("./gameSession");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeEqualHash(a, b) {
  const left = Buffer.from(a || "", "hex");
  const right = Buffer.from(b || "", "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

class Room {
  constructor(code, hostSocketId, hostPayload, emitRoom, scheduleDelete) {
    this.code = code;
    this.status = constants.ROOM_STATUS.WAITING;
    this.createdAt = Date.now();
    this.hostId = null;
    this.players = new Map();
    this.emitRoom = emitRoom;
    this.scheduleDelete = scheduleDelete;
    this.autoStart = false;
    this.game = null;
    this.countdownTimer = null;
    this.addPlayer(hostSocketId, hostPayload, true);
  }

  publicPlayer(player) {
    return {
      id: player.id,
      slot: player.slot,
      name: player.name,
      character: player.character,
      characterId: player.character,
      host: player.id === this.hostId,
      connected: player.connected,
      ready: player.ready,
      ping: player.ping,
      reconnectingUntil: player.reconnectingUntil || null,
      stats: player.stats || scoring.createStats(),
      restartVote: !!player.restartVote
    };
  }

  publicState() {
    return {
      roomCode: this.code,
      status: this.status,
      hostId: this.hostId,
      autoStart: this.autoStart,
      players: Array.from(this.players.values()).map((player) => this.publicPlayer(player)),
      canStart: this.canStart(),
      inviteUrl: `/?room=${this.code}`
    };
  }

  addPlayer(socketId, payload, host) {
    if (this.players.size >= constants.ROOM_CAPACITY) return { ok: false, error: "Room is already full." };
    if (this.status !== constants.ROOM_STATUS.WAITING && this.status !== constants.ROOM_STATUS.READY) {
      return { ok: false, error: "This game has already started." };
    }
    const name = validation.validateName(payload.name);
    if (!name.ok) return name;
    const character = validation.validateCharacter(payload.character || constants.DEFAULT_CHARACTER);
    if (!character.ok) return character;
    const taken = Array.from(this.players.values()).some((player) => player.character === character.value && player.connected);
    if (taken) return { ok: false, error: "That character is already selected." };
    const token = crypto.randomBytes(24).toString("base64url");
    const id = crypto.randomUUID();
    const player = {
      id,
      socketId,
      slot: this.players.size,
      name: name.value,
      character: character.value,
      ready: false,
      connected: true,
      ping: 0,
      tokenHash: sha256(token),
      reconnectingUntil: null,
      reconnectTimer: null,
      input: { sequence: 0 },
      stats: scoring.createStats(),
      restartVote: false
    };
    this.players.set(id, player);
    if (host) this.hostId = id;
    return { ok: true, player, reconnectToken: token };
  }

  reconnect(socketId, playerId, token) {
    const player = this.players.get(playerId);
    if (!player || !token || !safeEqualHash(sha256(token), player.tokenHash)) return { ok: false, error: "Reconnect failed." };
    if (player.reconnectTimer) clearTimeout(player.reconnectTimer);
    player.socketId = socketId;
    player.connected = true;
    player.reconnectingUntil = null;
    return { ok: true, player };
  }

  join(socketId, payload) {
    if (payload.playerId && payload.reconnectToken) return this.reconnect(socketId, payload.playerId, payload.reconnectToken);
    return this.addPlayer(socketId, payload, false);
  }

  setReady(playerId, ready) {
    const player = this.players.get(playerId);
    if (!player) return { ok: false, error: "Player not found." };
    player.ready = !!ready;
    this.status = this.players.size === constants.ROOM_CAPACITY && Array.from(this.players.values()).every((p) => p.ready)
      ? constants.ROOM_STATUS.READY
      : constants.ROOM_STATUS.WAITING;
    return { ok: true };
  }

  setCharacter(playerId, characterId) {
    const player = this.players.get(playerId);
    const character = validation.validateCharacter(characterId);
    if (!player) return { ok: false, error: "Player not found." };
    if (!character.ok) return character;
    const taken = Array.from(this.players.values()).some((p) => p.id !== playerId && p.character === character.value);
    if (taken) return { ok: false, error: "That character is already selected." };
    player.character = character.value;
    player.ready = false;
    this.status = constants.ROOM_STATUS.WAITING;
    return { ok: true };
  }

  canStart() {
    return this.players.size === constants.ROOM_CAPACITY &&
      Array.from(this.players.values()).every((player) => player.connected && player.ready);
  }

  startCountdown(onStart) {
    if (!this.canStart()) return { ok: false, error: "Both players must be connected and ready." };
    if (this.status === constants.ROOM_STATUS.COUNTDOWN || this.status === constants.ROOM_STATUS.PLAYING) return { ok: false, error: "Game is already starting." };
    this.status = constants.ROOM_STATUS.COUNTDOWN;
    let remaining = 3;
    this.emitRoom("game:countdown", { remaining });
    this.countdownTimer = setInterval(() => {
      remaining -= 1;
      this.emitRoom("game:countdown", { remaining });
      if (remaining <= 0) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.status = constants.ROOM_STATUS.PLAYING;
        this.game = new GameSession(this, this.emitRoom);
        this.emitRoom("game:start", this.game.snapshot());
        this.emitRoom("room:state", this.publicState());
        onStart(this);
      }
    }, 1000);
    return { ok: true };
  }

  disconnectPlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;
    player.connected = false;
    player.input = { sequence: player.input ? player.input.sequence : 0 };
    player.reconnectingUntil = Date.now() + constants.RECONNECT_GRACE_MS;
    player.reconnectTimer = setTimeout(() => {
      player.reconnectingUntil = null;
      if (this.status === constants.ROOM_STATUS.PLAYING && this.game) this.game.finish("disconnect");
      else this.players.delete(player.id);
      if (this.players.size === 0) this.scheduleDelete(this.code);
      this.emitRoom("room:state", this.publicState());
    }, constants.RECONNECT_GRACE_MS);
    player.reconnectTimer.unref && player.reconnectTimer.unref();
  }

  leave(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;
    if (player.reconnectTimer) clearTimeout(player.reconnectTimer);
    this.players.delete(playerId);
    if (this.players.size === 0) this.scheduleDelete(this.code);
    else if (this.hostId === playerId) this.hostId = Array.from(this.players.keys())[0];
  }

  resetToLobby() {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.status = constants.ROOM_STATUS.WAITING;
    this.game = null;
    this.players.forEach((player) => {
      player.ready = false;
      player.restartVote = false;
      player.stats = scoring.createStats();
      player.input = { sequence: 0 };
    });
  }

  close() {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.players.forEach((player) => {
      if (player.reconnectTimer) clearTimeout(player.reconnectTimer);
    });
    this.status = constants.ROOM_STATUS.CLOSED;
  }
}

class RoomManager {
  constructor(options = {}) {
    this.rooms = new Map();
    this.emitRoom = options.emitRoom || (() => {});
    this.timers = new Map();
  }

  generateRoomCode() {
    let code = "";
    do {
      code = "";
      for (let i = 0; i < constants.ROOM_CODE_LENGTH; i += 1) {
        code += constants.ROOM_CODE_ALPHABET[crypto.randomInt(constants.ROOM_CODE_ALPHABET.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(socketId, payload) {
    const code = this.generateRoomCode();
    const room = new Room(code, socketId, payload, (event, data) => this.emitRoom(code, event, data), (roomCode) => this.deleteRoom(roomCode));
    const host = Array.from(room.players.values())[0];
    this.rooms.set(code, room);
    this.scheduleWaitingCleanup(code);
    return { room, player: host, reconnectToken: host && payload ? Array.from(room.players.values())[0].tokenHash : null };
  }

  createRoomWithToken(socketId, payload) {
    const code = this.generateRoomCode();
    const room = new Room(code, socketId, payload, (event, data) => this.emitRoom(code, event, data), (roomCode) => this.deleteRoom(roomCode));
    const player = Array.from(room.players.values())[0];
    const token = crypto.randomBytes(24).toString("base64url");
    player.tokenHash = sha256(token);
    this.rooms.set(code, room);
    this.scheduleWaitingCleanup(code);
    return { ok: true, room, player, reconnectToken: token };
  }

  getRoom(code) {
    const result = validation.validateRoomCode(code);
    return result.ok ? this.rooms.get(result.value) : null;
  }

  deleteRoom(code) {
    const room = this.rooms.get(code);
    if (!room) return;
    room.close();
    if (this.timers.has(code)) clearTimeout(this.timers.get(code));
    this.timers.delete(code);
    this.rooms.delete(code);
  }

  scheduleWaitingCleanup(code) {
    if (this.timers.has(code)) clearTimeout(this.timers.get(code));
    const timer = setTimeout(() => {
      const room = this.rooms.get(code);
      if (room && (room.status === constants.ROOM_STATUS.WAITING || room.players.size === 0)) this.deleteRoom(code);
    }, constants.WAITING_ROOM_TTL_MS);
    timer.unref && timer.unref();
    this.timers.set(code, timer);
  }

  tickAll(dt) {
    this.rooms.forEach((room) => {
      if (room.game) room.game.update(dt);
    });
  }

  snapshotsDue() {
    const now = Date.now();
    const interval = 1000 / constants.SNAPSHOT_RATE;
    const due = [];
    this.rooms.forEach((room, code) => {
      if (!room.game || room.status !== constants.ROOM_STATUS.PLAYING) return;
      if (now - room.game.lastSnapshotAt >= interval) {
        room.game.lastSnapshotAt = now;
        due.push({ code, snapshot: room.game.snapshot() });
      }
    });
    return due;
  }

  closeAll() {
    this.rooms.forEach((room, code) => this.deleteRoom(code));
  }
}

module.exports = { RoomManager, Room, sha256 };
