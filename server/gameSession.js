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
    this.roundId = 1;
    this.roundState = constants.ROUND_STATES.PLAYING;
    this.tick = 0;
    this.startedAt = Date.now();
    this.remainingSeconds = constants.MATCH_SECONDS;
    this.lastSnapshotAt = 0;
    this.events = [];
    this.firstFinishAwarded = false;
    this.gameOverStarted = false;
    this.gameOverStartedAt = null;
    this.restartAt = null;
    this.roundStartsAt = null;
    this.resetPlayers();
  }

  resetPlayers(options = {}) {
    const resetStats = options.resetStats !== false;
    let index = 0;
    this.room.players.forEach((player) => {
      player.slot = index;
      player.state = physics.createPlayerState(this.world.spawnPoints[index], index);
      player.input = { sequence: 0 };
      if (resetStats || !player.stats) player.stats = scoring.createStats();
      player.restartVote = false;
      index += 1;
    });
  }

  setInput(playerId, input) {
    const player = this.room.players.get(playerId);
    if (!player || !player.connected || this.room.status !== constants.ROOM_STATUS.PLAYING) return;
    if (this.roundState !== constants.ROUND_STATES.PLAYING) return;
    if (!player.state || player.state.playerState !== constants.PLAYER_STATES.ACTIVE) return;
    player.input = input;
  }

  score(player, type, extra = {}) {
    const result = scoring.applyScoreEvent(player.stats, { type, ...extra }, Date.now());
    const event = {
      id: `${this.tick}-${player.id}-${type}-${Math.random().toString(36).slice(2, 7)}`,
      roundId: this.roundId,
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
    const now = Date.now();
    if (this.roundState === constants.ROUND_STATES.COUNTDOWN) {
      this.startRoundIfReady(now);
      return;
    }
    if (this.roundState === constants.ROUND_STATES.GAME_OVER || this.roundState === constants.ROUND_STATES.RESTARTING) {
      this.advanceRestart(now);
      return;
    }
    if (this.roundState !== constants.ROUND_STATES.PLAYING && this.roundState !== constants.ROUND_STATES.PLAYER_ELIMINATED) return;
    this.remainingSeconds = Math.max(0, constants.MATCH_SECONDS - Math.floor((now - this.startedAt) / 1000));

    this.world.enemies.forEach((enemy) => physics.stepEnemy(enemy, dt, this.world));
    this.room.players.forEach((player) => {
      if (!player.connected) return;
      this.updatePowerTimers(player);
      this.applyPendingForm(player);
      this.advanceDeathAnimation(player, now);
      if (!player.state || player.state.playerState !== constants.PLAYER_STATES.ACTIVE) return;
      const previousDead = player.state.dead;
      const previousFinished = player.state.finished;
      physics.stepPlayer(player.state, player.input || {}, dt, this.world);

      if (player.state.dead && !previousDead) {
        this.eliminatePlayer(player, "fall");
        return;
      }
      if (player.state.finished && !previousFinished) {
        player.state.playerState = constants.PLAYER_STATES.FINISHED;
        player.state.isFinished = true;
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

    if (this.remainingSeconds <= 0) this.handleTimerExpired();
    this.checkRoundEnd();
  }

  collectWorldObjects(player) {
    const box = player.state;
    if (!box || box.playerState !== constants.PLAYER_STATES.ACTIVE) return;
    this.world.coins.forEach((coin) => {
      if (!coin.collectedBy && physics.overlaps(box, coin)) {
        coin.collectedBy = player.id;
        this.score(player, "coin");
      }
    });
    this.world.powerUps.forEach((power) => {
      if (!power.collectedBy && physics.overlaps(box, power)) {
        power.collectedBy = player.id;
        this.applyPowerUp(player, power.type);
        this.score(player, power.type === "star" ? "star" : power.type === "fireFlower" ? "fireFlower" : "mushroom");
      }
    });
  }

  updatePowerTimers(player) {
    const state = player.state;
    if (!state) return;
    const now = Date.now();
    if (state.effectExpiresAt && now >= state.effectExpiresAt) {
      state.temporaryEffect = "none";
      state.effectExpiresAt = 0;
    }
  }

  canResizePlayer(state, nextHeight) {
    const feetY = state.y + state.h;
    const test = { x: state.x, y: feetY - nextHeight, w: state.w, h: nextHeight };
    return !this.world.solids.some((solid) => physics.overlaps(test, solid));
  }

  setPlayerForm(player, form) {
    const state = player.state;
    const nextHeight = form === "small" ? constants.PLAYER_SMALL_HEIGHT : constants.PLAYER_SUPER_HEIGHT;
    if (state.h !== nextHeight) {
      if (!this.canResizePlayer(state, nextHeight)) {
        state.pendingForm = form;
        return false;
      }
      const feetY = state.y + state.h;
      state.h = nextHeight;
      state.y = feetY - state.h;
    }
    state.form = form;
    state.pendingForm = null;
    return true;
  }

  applyPendingForm(player) {
    if (player.state && player.state.pendingForm) this.setPlayerForm(player, player.state.pendingForm);
  }

  applyPowerUp(player, type) {
    const state = player.state;
    if (type === "mushroom") {
      if (state.form === "small") this.setPlayerForm(player, "super");
      else if (state.form === "super") this.setPlayerForm(player, "fire");
    } else if (type === "fireFlower") {
      this.setPlayerForm(player, "fire");
    } else if (type === "star") {
      state.temporaryEffect = "star";
      state.effectExpiresAt = Date.now() + 10000;
    }
  }

  damagePlayer(player) {
    const state = player.state;
    if (!state || state.playerState !== constants.PLAYER_STATES.ACTIVE) return false;
    if (state.form === "fire") {
      this.setPlayerForm(player, "super");
    } else if (state.form === "super") {
      this.setPlayerForm(player, "small");
    } else {
      return this.eliminatePlayer(player, "enemy");
    }
    state.invulnerableUntil = Date.now() + 1400;
    state.temporaryEffect = "damageInvulnerability";
    state.effectExpiresAt = state.invulnerableUntil;
    return false;
  }

  checkEnemyCollisions(player) {
    const box = player.state;
    if (!box || box.playerState !== constants.PLAYER_STATES.ACTIVE) return;
    this.world.enemies.forEach((enemy) => {
      if (!enemy.alive || !physics.overlaps(box, enemy)) return;
      const stomp = box.vy > 0 && box.y + box.h - enemy.y <= 12;
      if (stomp || box.temporaryEffect === "star") {
        enemy.alive = false;
        box.vy = -170;
        this.score(player, enemy.type === "koopa" ? "enemyAdvanced" : "enemyBasic");
      } else if (Date.now() > box.invulnerableUntil) {
        const eliminated = this.damagePlayer(player);
        if (!eliminated) this.score(player, "damage");
      }
    });
  }

  clearInput(player) {
    player.input = {
      sequence: player.input && player.input.sequence ? player.input.sequence : 0,
      left: false,
      right: false,
      jump: false,
      run: false,
      action: false,
      interact: false,
      highJump: false,
      clientTime: Date.now()
    };
  }

  eliminatePlayer(player, reason) {
    const state = player.state;
    if (!state || state.playerState !== constants.PLAYER_STATES.ACTIVE) return false;
    const now = Date.now();
    this.clearInput(player);
    state.playerState = constants.PLAYER_STATES.DYING;
    state.isAlive = false;
    state.isDead = true;
    state.dead = true;
    state.animation = "dead";
    state.deathReason = reason;
    state.deathStartedAt = now;
    state.deathAnimationEndsAt = now + constants.DEATH_ANIMATION_MS;
    state.vx = 0;
    state.vy = -120;
    state.temporaryEffect = "none";
    state.effectExpiresAt = 0;
    this.roundState = constants.ROUND_STATES.PLAYER_ELIMINATED;
    this.score(player, reason === "fall" ? "fall" : "death");
    const event = {
      id: `${this.roundId}-${this.tick}-${player.id}-dying`,
      roundId: this.roundId,
      playerId: player.id,
      type: "player:dying",
      reason,
      deathStartedAt: now
    };
    this.events.push(event);
    this.emitRoom("game:event", event);
    return true;
  }

  advanceDeathAnimation(player, now) {
    const state = player.state;
    if (!state || state.playerState !== constants.PLAYER_STATES.DYING) return;
    const elapsed = now - state.deathStartedAt;
    state.vy = Math.min(220, state.vy + 900 * (1 / constants.SERVER_TICK_RATE));
    state.y += state.vy * (1 / constants.SERVER_TICK_RATE);
    state.deathProgress = Math.min(1, Math.max(0, elapsed / constants.DEATH_ANIMATION_MS));
    if (now < state.deathAnimationEndsAt) return;
    state.playerState = constants.PLAYER_STATES.SPECTATING;
    state.isEliminated = true;
    state.isSpectating = true;
    state.isAlive = false;
    state.isDead = true;
    state.dead = true;
    state.vx = 0;
    state.vy = 0;
    this.clearInput(player);
    const survivor = this.activePlayers()[0];
    this.emitRoom("game:event", {
      id: `${this.roundId}-${this.tick}-${player.id}-spectating`,
      roundId: this.roundId,
      playerId: player.id,
      type: "player:spectating",
      watchingPlayerId: survivor ? survivor.id : null
    });
  }

  activePlayers() {
    return Array.from(this.room.players.values()).filter((player) =>
      player.connected && player.state && player.state.playerState === constants.PLAYER_STATES.ACTIVE
    );
  }

  playersInRound() {
    return Array.from(this.room.players.values()).filter((player) => player.state);
  }

  checkRoundEnd() {
    if (this.room.status !== constants.ROOM_STATUS.PLAYING) return;
    const players = this.playersInRound();
    const active = this.activePlayers();
    const finished = players.filter((player) => player.state.playerState === constants.PLAYER_STATES.FINISHED);
    if (finished.length > 0) {
      this.finish("finished");
      return;
    }
    const allOut = players.length > 0 && players.every((player) =>
      player.state.playerState === constants.PLAYER_STATES.SPECTATING ||
      player.state.playerState === constants.PLAYER_STATES.ELIMINATED ||
      player.state.playerState === constants.PLAYER_STATES.FINISHED
    );
    if (active.length === 1 && this.roundState === constants.ROUND_STATES.PLAYER_ELIMINATED) {
      const survivor = active[0];
      this.roundState = constants.ROUND_STATES.PLAYING;
      this.emitRoom("game:event", {
        id: `${this.roundId}-${this.tick}-last-player`,
        roundId: this.roundId,
        playerId: survivor.id,
        type: "round:lastPlayer"
      });
    }
    if (active.length === 0 && allOut) this.beginGameOver("all_players_eliminated");
  }

  handleTimerExpired() {
    this.activePlayers().forEach((player) => this.eliminatePlayer(player, "timer"));
  }

  beginGameOver(reason) {
    if (this.gameOverStarted) return;
    const now = Date.now();
    this.gameOverStarted = true;
    this.roundState = constants.ROUND_STATES.GAME_OVER;
    this.gameOverStartedAt = now;
    this.restartAt = now + constants.GAME_OVER_PRESENTATION_MS + constants.GAME_OVER_RESTART_MS;
    this.clearAllInputs();
    const event = {
      id: `${this.roundId}-${this.tick}-game-over`,
      roundId: this.roundId,
      type: "round:gameOver",
      reason,
      gameOverStartedAt: this.gameOverStartedAt,
      restartAt: this.restartAt,
      players: this.playersInRound().map((player) => this.room.publicPlayer(player))
    };
    this.events.push(event);
    this.emitRoom("round:gameOver", event);
    this.emitRoom("game:event", event);
  }

  clearAllInputs() {
    this.room.players.forEach((player) => this.clearInput(player));
  }

  advanceRestart(now) {
    if (
      this.roundState === constants.ROUND_STATES.GAME_OVER &&
      this.gameOverStartedAt &&
      now >= this.gameOverStartedAt + constants.GAME_OVER_PRESENTATION_MS
    ) {
      this.roundState = constants.ROUND_STATES.RESTARTING;
      this.emitRoom("game:event", {
        id: `${this.roundId}-${this.tick}-restarting`,
        roundId: this.roundId,
        type: "round:restarting",
        restartAt: this.restartAt
      });
    }
    if (!this.restartAt || now < this.restartAt) return;
    this.resetRound();
  }

  resetRound() {
    if (this.roundState === constants.ROUND_STATES.COUNTDOWN) return;
    this.roundId += 1;
    this.world = levelData.createWorld();
    this.tick = 0;
    this.startedAt = Date.now() + constants.ROUND_RESTART_COUNTDOWN_MS;
    this.remainingSeconds = constants.MATCH_SECONDS;
    this.lastSnapshotAt = 0;
    this.events = [];
    this.firstFinishAwarded = false;
    this.gameOverStarted = false;
    this.gameOverStartedAt = null;
    this.restartAt = null;
    this.roundStartsAt = Date.now() + constants.ROUND_RESTART_COUNTDOWN_MS;
    this.roundState = constants.ROUND_STATES.COUNTDOWN;
    this.resetPlayers({ resetStats: true });
    this.emitRoom("round:reset", this.snapshot());
    this.emitRoom("game:countdown", { remaining: 3, roundId: this.roundId, roundStartsAt: this.roundStartsAt });
  }

  startRoundIfReady(now) {
    if (this.roundState !== constants.ROUND_STATES.COUNTDOWN || now < this.roundStartsAt) return;
    this.roundState = constants.ROUND_STATES.PLAYING;
    this.startedAt = now;
    this.remainingSeconds = constants.MATCH_SECONDS;
    this.clearAllInputs();
    this.emitRoom("round:start", this.snapshot());
    this.emitRoom("game:start", this.snapshot());
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
      roundId: this.roundId,
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
      roundId: this.roundId,
      roundState: this.roundState,
      serverTime: Date.now(),
      gameOverStartedAt: this.gameOverStartedAt,
      restartAt: this.restartAt,
      roundStartsAt: this.roundStartsAt,
      remainingSeconds: this.remainingSeconds,
      level: { id: this.world.id, title: this.world.title, width: this.world.width, finishX: this.world.finishX, theme: this.world.theme },
      players: Array.from(this.room.players.values()).map((player) => ({
        id: player.id,
        slot: player.slot,
        name: player.name,
        character: player.character,
        characterId: player.character,
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
