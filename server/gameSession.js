"use strict";

const constants = require("../shared/constants");
const scoring = require("../shared/scoring");
const levelData = require("../shared/levelData");
const physics = require("../shared/physics");

class GameSession {
  constructor(room, emitRoom) {
    this.room = room;
    this.emitRoom = emitRoom;
    this.world = levelData.createWorld();
    this.tick = 0;
    this.startedAt = Date.now();
    this.remainingSeconds = constants.MATCH_SECONDS;
    this.lastSnapshotAt = 0;
    this.events = [];
    this.firstFinishAwarded = false;
    this.resetPlayers();
  }

  resetPlayers() {
    let index = 0;
    this.room.players.forEach((player) => {
      player.slot = index;
      player.state = physics.createPlayerState(this.world.spawnPoints[index], index);
      player.input = { sequence: 0 };
      player.stats = scoring.createStats();
      player.restartVote = false;
      index += 1;
    });
  }

  setInput(playerId, input) {
    const player = this.room.players.get(playerId);
    if (!player || !player.connected || this.room.status !== constants.ROOM_STATUS.PLAYING) return;
    player.input = input;
  }

  score(player, type, extra = {}) {
    const result = scoring.applyScoreEvent(player.stats, { type, ...extra }, Date.now());
    const event = {
      id: `${this.tick}-${player.id}-${type}-${Math.random().toString(36).slice(2, 7)}`,
      playerId: player.id,
      type,
      delta: result.delta,
      combo: result.combo,
      score: result.score
    };
    this.events.push(event);
    this.emitRoom("game:event", event);
  }

  update(dt) {
    if (this.room.status !== constants.ROOM_STATUS.PLAYING) return;
    this.tick += 1;
    this.remainingSeconds = Math.max(0, constants.MATCH_SECONDS - Math.floor((Date.now() - this.startedAt) / 1000));

    this.world.enemies.forEach((enemy) => physics.stepEnemy(enemy, dt, this.world));
    this.room.players.forEach((player) => {
      if (!player.connected) return;
      const previousDead = player.state.dead;
      const previousFinished = player.state.finished;
      physics.stepPlayer(player.state, player.input || {}, dt, this.world);

      if (player.state.dead && !previousDead) {
        this.score(player, "fall");
        const spawn = this.world.spawnPoints[player.slot];
        player.state = physics.createPlayerState(spawn, player.slot);
        player.state.invulnerableUntil = Date.now() + 1800;
      }
      if (player.state.finished && !previousFinished) {
        player.state.finishedAt = Date.now() - this.startedAt;
        this.score(player, "finish", { finishedAt: player.state.finishedAt });
        if (!this.firstFinishAwarded) {
          this.score(player, "firstFinish");
          this.firstFinishAwarded = true;
        }
        this.emitRoom("game:playerFinished", { playerId: player.id, finishTime: player.state.finishedAt });
      }

      this.collectWorldObjects(player);
      this.checkEnemyCollisions(player);
    });

    const activePlayers = Array.from(this.room.players.values());
    const allFinished = activePlayers.length > 0 && activePlayers.every((player) => player.state && player.state.finished);
    if (allFinished || this.remainingSeconds <= 0) this.finish(allFinished ? "finished" : "timer");
  }

  collectWorldObjects(player) {
    const box = player.state;
    this.world.coins.forEach((coin) => {
      if (!coin.collectedBy && physics.overlaps(box, coin)) {
        coin.collectedBy = player.id;
        this.score(player, "coin");
      }
    });
    this.world.powerUps.forEach((power) => {
      if (!power.collectedBy && physics.overlaps(box, power)) {
        power.collectedBy = player.id;
        player.state.power = power.type;
        this.score(player, power.type === "star" ? "star" : "mushroom");
      }
    });
  }

  checkEnemyCollisions(player) {
    const box = player.state;
    this.world.enemies.forEach((enemy) => {
      if (!enemy.alive || !physics.overlaps(box, enemy)) return;
      const stomp = box.vy > 0 && box.y + box.h - enemy.y <= 12;
      if (stomp || box.power === "star") {
        enemy.alive = false;
        box.vy = -170;
        this.score(player, enemy.type === "koopa" ? "enemyAdvanced" : "enemyBasic");
      } else if (Date.now() > box.invulnerableUntil) {
        box.invulnerableUntil = Date.now() + 1400;
        this.score(player, "damage");
      }
    });
  }

  finish(reason) {
    if (this.room.status === constants.ROOM_STATUS.RESULTS) return;
    this.room.status = constants.ROOM_STATUS.RESULTS;
    const players = Array.from(this.room.players.values());
    players.forEach((player) => {
      if (player.state && player.state.finished) {
        const secondsLeft = Math.max(0, this.remainingSeconds);
        scoring.applyScoreEvent(player.stats, { type: "timeBonus", seconds: secondsLeft }, Date.now());
      }
    });
    const winner = scoring.chooseWinner(players);
    const result = {
      reason,
      winner,
      roomCode: this.room.code,
      finishTime: Date.now() - this.startedAt,
      players: players.map((player) => this.room.publicPlayer(player))
    };
    this.emitRoom("game:over", result);
    this.emitRoom("room:state", this.room.publicState());
  }

  snapshot() {
    return {
      tick: this.tick,
      serverTime: Date.now(),
      remainingSeconds: this.remainingSeconds,
      level: { id: this.world.id, title: this.world.title, width: this.world.width, finishX: this.world.finishX },
      players: Array.from(this.room.players.values()).map((player) => ({
        id: player.id,
        slot: player.slot,
        name: player.name,
        character: player.character,
        connected: player.connected,
        ready: player.ready,
        ping: player.ping,
        inputAck: player.state ? player.state.lastSequence : 0,
        state: player.state,
        stats: player.stats
      })),
      coins: this.world.coins.filter((coin) => coin.collectedBy).map((coin) => ({ id: coin.id, collectedBy: coin.collectedBy })),
      powerUps: this.world.powerUps.filter((power) => power.collectedBy).map((power) => ({ id: power.id, collectedBy: power.collectedBy })),
      enemies: this.world.enemies.map((enemy) => ({ id: enemy.id, x: enemy.x, y: enemy.y, alive: enemy.alive, type: enemy.type }))
    };
  }
}

module.exports = { GameSession };
