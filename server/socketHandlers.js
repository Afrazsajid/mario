"use strict";

const constants = require("../shared/constants");
const protocol = require("../shared/protocol");
const validation = require("../shared/validation");
const { RateLimiter } = require("./rateLimiter");

function inviteUrl(publicUrl, roomCode) {
  const base = publicUrl ? publicUrl.replace(/\/$/, "") : "";
  return `${base}/?room=${roomCode}`;
}

function registerSocketHandlers(io, roomManager, options = {}) {
  const createLimiter = new RateLimiter({ windowMs: 60_000, max: 8 });
  const joinLimiter = new RateLimiter({ windowMs: 60_000, max: 20 });
  const inputLimiter = new RateLimiter({ windowMs: 1000, max: 90 });
  const socketToPlayer = new Map();
  const socketToRoom = new Map();
  const C = protocol.CLIENT_EVENTS;
  const S = protocol.SERVER_EVENTS;

  function fail(socket, message, code) {
    socket.emit(S.ERROR, { message, code: code || "error" });
  }

  function attach(socket, room, player) {
    socket.join(room.code);
    socketToRoom.set(socket.id, room.code);
    socketToPlayer.set(socket.id, player.id);
  }

  function broadcastState(room) {
    io.to(room.code).emit(S.ROOM_STATE, room.publicState());
  }

  io.on("connection", (socket) => {
    socket.on(C.CREATE_ROOM, (payload = {}) => {
      if (!createLimiter.allow(socket.handshake.address || socket.id)) return fail(socket, "Too many room creation attempts.", "rate_limited");
      const created = roomManager.createRoomWithToken(socket.id, payload);
      if (!created.ok) return fail(socket, created.error, "invalid_room");
      attach(socket, created.room, created.player);
      const response = {
        roomCode: created.room.code,
        inviteUrl: inviteUrl(options.publicUrl, created.room.code),
        playerId: created.player.id,
        reconnectToken: created.reconnectToken,
        room: created.room.publicState()
      };
      socket.emit(S.ROOM_CREATED, response);
      broadcastState(created.room);
      console.log(`room created ${created.room.code}`);
    });

    socket.on(C.JOIN_ROOM, (payload = {}) => {
      if (!joinLimiter.allow(socket.handshake.address || socket.id)) return fail(socket, "Too many join attempts.", "rate_limited");
      const code = validation.validateRoomCode(payload.roomCode);
      if (!code.ok) return fail(socket, code.error, "invalid_room_code");
      const room = roomManager.getRoom(code.value);
      if (!room) return fail(socket, "Room not found or expired.", "room_not_found");
      const joined = room.join(socket.id, payload);
      if (!joined.ok) return fail(socket, joined.error, "join_failed");
      attach(socket, room, joined.player);
      socket.emit(S.ROOM_JOINED, {
        roomCode: room.code,
        inviteUrl: inviteUrl(options.publicUrl, room.code),
        playerId: joined.player.id,
        reconnectToken: joined.reconnectToken || payload.reconnectToken,
        room: room.publicState(),
        snapshot: room.game ? room.game.snapshot() : null
      });
      socket.to(room.code).emit(S.PLAYER_JOINED, { player: room.publicPlayer(joined.player) });
      broadcastState(room);
    });

    socket.on(C.READY, (payload = {}) => {
      const room = roomManager.getRoom(socketToRoom.get(socket.id));
      const playerId = socketToPlayer.get(socket.id);
      if (!room || !playerId) return;
      const result = room.setReady(playerId, !!payload.ready);
      if (!result.ok) return fail(socket, result.error, "ready_failed");
      io.to(room.code).emit(S.PLAYER_READY, { playerId, ready: !!payload.ready });
      broadcastState(room);
      if (room.autoStart && room.canStart()) room.startCountdown(() => {});
    });

    socket.on(C.CHARACTER, (payload = {}) => {
      const room = roomManager.getRoom(socketToRoom.get(socket.id));
      const playerId = socketToPlayer.get(socket.id);
      if (!room || !playerId) return;
      const result = room.setCharacter(playerId, payload.character);
      if (!result.ok) return fail(socket, result.error, "character_failed");
      broadcastState(room);
    });

    socket.on(C.START, () => {
      const room = roomManager.getRoom(socketToRoom.get(socket.id));
      const playerId = socketToPlayer.get(socket.id);
      if (!room || playerId !== room.hostId) return fail(socket, "Only the host can start.", "not_host");
      const result = room.startCountdown(() => {});
      if (!result.ok) return fail(socket, result.error, "start_failed");
      broadcastState(room);
    });

    socket.on(C.INPUT, (payload = {}) => {
      if (!inputLimiter.allow(socket.id)) return;
      const input = validation.sanitizeInputPacket(payload);
      if (!input.ok) return fail(socket, input.error, "invalid_input");
      const room = roomManager.getRoom(socketToRoom.get(socket.id));
      const playerId = socketToPlayer.get(socket.id);
      if (room && room.game) room.game.setInput(playerId, input.value);
    });

    socket.on(C.RESTART_VOTE, (payload = {}) => {
      const room = roomManager.getRoom(socketToRoom.get(socket.id));
      const playerId = socketToPlayer.get(socket.id);
      if (!room || room.status !== constants.ROOM_STATUS.RESULTS) return;
      const player = room.players.get(playerId);
      if (!player) return;
      player.restartVote = !!payload.wantsRestart;
      io.to(room.code).emit(S.RESTART_STATUS, { players: Array.from(room.players.values()).map((p) => ({ id: p.id, restartVote: !!p.restartVote })) });
      if (Array.from(room.players.values()).length === constants.ROOM_CAPACITY && Array.from(room.players.values()).every((p) => p.restartVote)) {
        room.resetToLobby();
        broadcastState(room);
      }
    });

    socket.on(C.RETURN_TO_LOBBY, () => {
      const room = roomManager.getRoom(socketToRoom.get(socket.id));
      if (!room || room.status !== constants.ROOM_STATUS.RESULTS) return;
      room.resetToLobby();
      broadcastState(room);
    });

    socket.on(C.LEAVE_ROOM, () => {
      const room = roomManager.getRoom(socketToRoom.get(socket.id));
      const playerId = socketToPlayer.get(socket.id);
      if (room && playerId) {
        room.leave(playerId);
        socket.leave(room.code);
        io.to(room.code).emit(S.PLAYER_LEFT, { playerId });
        broadcastState(room);
      }
      socketToPlayer.delete(socket.id);
      socketToRoom.delete(socket.id);
    });

    socket.on(C.PING, (payload = {}) => {
      const room = roomManager.getRoom(socketToRoom.get(socket.id));
      const playerId = socketToPlayer.get(socket.id);
      const now = Date.now();
      if (room && playerId) {
        const player = room.players.get(playerId);
        if (player) player.ping = Math.max(0, now - Number(payload.clientTime || now));
      }
      socket.emit(S.PONG, { clientTime: payload.clientTime, serverTime: now });
    });

    socket.on("disconnect", () => {
      const room = roomManager.getRoom(socketToRoom.get(socket.id));
      const playerId = socketToPlayer.get(socket.id);
      socketToPlayer.delete(socket.id);
      socketToRoom.delete(socket.id);
      if (!room || !playerId) return;
      room.disconnectPlayer(playerId);
      io.to(room.code).emit(S.PLAYER_LEFT, { playerId, reconnecting: true });
      broadcastState(room);
    });
  });
}

module.exports = { registerSocketHandlers, inviteUrl };
