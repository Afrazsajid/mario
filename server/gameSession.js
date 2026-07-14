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
    this.currentCheckpointId = null;
    this.currentCheckpointSpawn = null;
    this.tick = 0;
    this.startedAt = Date.now();
    this.remainingSeconds = this.matchDurationSeconds();
    this.lastSnapshotAt = 0;
    this.events = [];
    this.lasers = [];
    this.enemyProjectiles = this.world.enemyProjectiles || [];
    this.nextLaserId = 1;
    this.nextEnemyProjectileId = 1;
    this.firstFinishAwarded = false;
    this.gameOverStarted = false;
    this.gameOverStartedAt = null;
    this.restartAt = null;
    this.roundStartsAt = null;
    this.resetPlayers();
  }

  resetPlayers(options = {}) {
    const resetStats = options.resetStats !== false;
    const useCheckpoint = !!options.useCheckpoint && this.currentCheckpointSpawn;
    let index = 0;
    this.room.players.forEach((player) => {
      player.slot = index;
      const spawn = useCheckpoint
        ? { x: this.currentCheckpointSpawn.x + index * 18, y: this.currentCheckpointSpawn.y }
        : this.world.spawnPoints[index];
      player.state = physics.createPlayerState(spawn, index);
      this.applySpawnProtection(player.state);
      player.input = { sequence: 0 };
      player.lastLaserFiredAt = 0;
      player.fireHeld = false;
      if (resetStats || !player.stats) player.stats = scoring.createStats();
      player.restartVote = false;
      index += 1;
    });
  }

  matchDurationSeconds() {
    return Math.max(0, constants.MATCH_SECONDS || 0);
  }

  matchHasTimer() {
    return this.matchDurationSeconds() > 0;
  }

  applySpawnProtection(state) {
    if (!state || !constants.SPAWN_INVULNERABILITY_MS) return;
    const expiresAt = Date.now() + constants.SPAWN_INVULNERABILITY_MS;
    state.invulnerableUntil = expiresAt;
    state.temporaryEffect = "damageInvulnerability";
    state.effectExpiresAt = expiresAt;
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
    this.remainingSeconds = this.matchHasTimer()
      ? Math.max(0, this.matchDurationSeconds() - Math.floor((now - this.startedAt) / 1000))
      : 0;

    this.stepMovingPlatforms(dt);
    this.world.enemies.forEach((enemy) => physics.stepEnemy(enemy, dt, this.world, {
      players: this.activePlayers(),
      spawnEnemyProjectile: (source) => this.spawnEnemyProjectile(source, now)
    }));
    this.checkShellEnemyCollisions();
    this.stepLasers(dt, now);
    this.stepEnemyProjectiles(dt, now);
    this.room.players.forEach((player) => {
      if (!player.connected) return;
      this.updatePowerTimers(player);
      this.applyPendingForm(player);
      this.advanceDeathAnimation(player, now);
      if (!player.state || player.state.playerState !== constants.PLAYER_STATES.ACTIVE) return;
      const previousDead = player.state.dead;
      const previousFinished = player.state.finished;
      physics.stepPlayer(player.state, player.input || {}, dt, this.world);
      this.handleFireInput(player, now);

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
      this.checkCheckpoints(player);
      this.checkEnemyCollisions(player);
    });

    if (this.matchHasTimer() && this.remainingSeconds <= 0) this.handleTimerExpired();
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

  checkCheckpoints(player) {
    const box = player.state;
    if (!box || box.playerState !== constants.PLAYER_STATES.ACTIVE) return;
    this.world.checkpoints.forEach((checkpoint) => {
      if (checkpoint.activated || !physics.overlaps(box, checkpoint)) return;
      checkpoint.activated = true;
      checkpoint.activatedBy = player.id;
      checkpoint.activatedAt = Date.now();
      this.currentCheckpointId = checkpoint.id;
      this.currentCheckpointSpawn = { x: checkpoint.spawnX, y: checkpoint.spawnY };
      this.score(player, "checkpoint");
      this.emitRoom("game:event", {
        id: `${this.roundId}-${this.tick}-${checkpoint.id}`,
        roundId: this.roundId,
        playerId: player.id,
        checkpointId: checkpoint.id,
        type: "checkpoint:activated",
        x: checkpoint.x,
        y: checkpoint.y
      });
    });
  }

  stepMovingPlatforms(dt) {
    if (!this.world.movingPlatforms || !this.world.movingPlatforms.length) return;
    this.world.movingPlatforms.forEach((platform) => {
      const previousX = platform.x;
      platform.x += platform.vx * dt;
      if (platform.x <= platform.minX) {
        platform.x = platform.minX;
        platform.vx = Math.abs(platform.vx);
      } else if (platform.x >= platform.maxX) {
        platform.x = platform.maxX;
        platform.vx = -Math.abs(platform.vx);
      }
      this.carryPlayersOnPlatform(platform, platform.x - previousX);
    });
    if (levelData.syncSolids) levelData.syncSolids(this.world);
  }

  carryPlayersOnPlatform(platform, deltaX) {
    if (!deltaX) return;
    this.room.players.forEach((player) => {
      const state = player.state;
      if (!state || state.playerState !== constants.PLAYER_STATES.ACTIVE) return;
      const feetY = state.y + state.h;
      const onTop = Math.abs(feetY - platform.y) <= 2 &&
        state.x + state.w > platform.x &&
        state.x < platform.x + platform.w;
      if (!onTop) return;
      state.x = Math.max(0, Math.min(this.world.width - state.w, state.x + deltaX));
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
      if (enemy.behaviour === "pipePlant" && enemy.state === "hidden") return;
      const stomp = box.vy > 0 && box.y + box.h - enemy.y <= 12;
      if (stomp || box.temporaryEffect === "star") {
        if (enemy.type === "koopa" && enemy.state !== "shellStationary" && enemy.state !== "shellMoving" && box.temporaryEffect !== "star") {
          this.enterKoopaShell(enemy);
          box.vy = -170;
          this.score(player, "enemyAdvanced");
          return;
        }
        if (enemy.type === "spiny" && box.temporaryEffect !== "star") {
          if (Date.now() > box.invulnerableUntil) {
            const eliminated = this.damagePlayer(player);
            if (!eliminated) this.score(player, "damage");
          }
          return;
        }
        if (enemy.state === "shellStationary" && box.temporaryEffect !== "star") {
          this.kickShell(enemy, box.x + box.w / 2 < enemy.x + enemy.w / 2 ? 1 : -1);
          box.vy = -150;
          return;
        }
        if (enemy.state === "shellMoving" && box.temporaryEffect !== "star") {
          enemy.state = "shellStationary";
          enemy.vx = 0;
          box.vy = -170;
          return;
        }
        this.defeatEnemy(enemy);
        box.vy = -170;
        this.score(player, this.scoreEventForEnemy(enemy));
      } else if (enemy.state === "shellStationary") {
        this.kickShell(enemy, box.x + box.w / 2 < enemy.x + enemy.w / 2 ? 1 : -1);
      } else if (Date.now() > box.invulnerableUntil) {
        const eliminated = this.damagePlayer(player);
        if (!eliminated) this.score(player, "damage");
      }
    });
  }

  enterKoopaShell(enemy) {
    const feetY = enemy.y + enemy.h;
    enemy.state = "shellStationary";
    enemy.spriteFamily = "koopa";
    enemy.h = 14;
    enemy.w = 14;
    enemy.y = feetY - enemy.h;
    enemy.vx = 0;
    enemy.vy = 0;
  }

  kickShell(enemy, direction) {
    enemy.state = "shellMoving";
    enemy.vx = direction * 150;
    enemy.direction = direction;
    this.emitRoom("game:event", {
      id: `${this.roundId}-${this.tick}-${enemy.id}-shell-kick`,
      roundId: this.roundId,
      enemyId: enemy.id,
      type: "enemy:shellKick"
    });
  }

  checkShellEnemyCollisions() {
    const shells = this.world.enemies.filter((enemy) => enemy.alive && enemy.state === "shellMoving");
    if (!shells.length) return;
    shells.forEach((shell) => {
      this.world.enemies.forEach((enemy) => {
        if (!enemy.alive || enemy === shell || enemy.state === "shellMoving" || !physics.overlaps(shell, enemy)) return;
        this.defeatEnemy(enemy);
        const owner = this.activePlayers().find((player) => Math.abs(player.state.x - shell.x) < 260);
        if (owner) this.score(owner, this.scoreEventForEnemy(enemy));
        this.emitRoom("game:event", {
          id: `${this.roundId}-${this.tick}-${shell.id}-${enemy.id}-shell-hit`,
          roundId: this.roundId,
          enemyId: enemy.id,
          type: "enemy:shellHit"
        });
      });
    });
  }

  activeLaserCount(playerId) {
    return this.lasers.filter((laser) => laser.ownerId === playerId).length;
  }

  canPlayerFire(player, now) {
    const state = player && player.state;
    if (!state || state.playerState !== constants.PLAYER_STATES.ACTIVE) return false;
    if (state.dead || state.finished || state.pendingForm) return false;
    if (state.form !== "fire") return false;
    if (now - (player.lastLaserFiredAt || 0) < constants.LASER_COOLDOWN_MS) return false;
    if (this.activeLaserCount(player.id) >= constants.MAX_ACTIVE_LASERS_PER_PLAYER) return false;
    return true;
  }

  handPosition(state, direction) {
    const tall = state.h >= constants.PLAYER_SUPER_HEIGHT;
    const x = direction > 0 ? state.x + state.w - 1 : state.x - constants.LASER_WIDTH + 1;
    const y = state.y + (tall ? 13 : 7);
    return { x, y };
  }

  handleFireInput(player, now) {
    const input = player.input || {};
    if (!input.fire) {
      player.fireHeld = false;
      return false;
    }
    if (player.fireHeld) return false;
    player.fireHeld = true;
    if (!this.canPlayerFire(player, now)) return false;
    return this.spawnLaser(player, now);
  }

  spawnLaser(player, now) {
    const state = player.state;
    const direction = state.facing < 0 ? -1 : 1;
    const hand = this.handPosition(state, direction);
    const laser = {
      id: `laser-${this.roundId}-${this.nextLaserId++}`,
      roundId: this.roundId,
      ownerId: player.id,
      x: hand.x,
      y: hand.y,
      w: constants.LASER_WIDTH,
      h: constants.LASER_HEIGHT,
      vx: direction * constants.LASER_SPEED,
      direction,
      createdAt: now,
      expiresAt: now + constants.LASER_LIFETIME_MS
    };
    this.lasers.push(laser);
    player.lastLaserFiredAt = now;
    state.shootingUntil = now + constants.SHOOT_ANIMATION_MS;
    this.emitRoom("game:event", {
      id: `${this.roundId}-${this.tick}-${player.id}-laser-fire`,
      roundId: this.roundId,
      playerId: player.id,
      laserId: laser.id,
      type: "laser:fire",
      x: laser.x,
      y: laser.y,
      direction
    });
    return true;
  }

  stepLasers(dt, now) {
    if (!this.lasers.length) return;
    const survivors = [];
    this.lasers.forEach((laser) => {
      laser.x += laser.vx * dt;
      if (this.shouldDestroyLaser(laser, now)) return;
      const enemy = this.hitEnemy(laser);
      if (enemy) {
        this.destroyEnemyWithLaser(laser, enemy);
        return;
      }
      if (this.hitsSolid(laser)) return;
      survivors.push(laser);
    });
    this.lasers = survivors;
  }

  shouldDestroyLaser(laser, now) {
    return now >= laser.expiresAt ||
      laser.x + laser.w < 0 ||
      laser.x > this.world.width ||
      laser.y + laser.h < 0 ||
      laser.y > this.world.height;
  }

  hitEnemy(laser) {
    return this.world.enemies.find((enemy) => enemy.alive && physics.overlaps(laser, enemy));
  }

  hitsSolid(laser) {
    return this.world.solids.some((solid) => physics.overlaps(laser, solid));
  }

  destroyEnemyWithLaser(laser, enemy) {
    if (!enemy.alive) return;
    this.defeatEnemy(enemy);
    const owner = this.room.players.get(laser.ownerId);
    if (owner) this.score(owner, this.scoreEventForEnemy(enemy));
    this.emitRoom("game:event", {
      id: `${this.roundId}-${this.tick}-${laser.id}-hit`,
      roundId: this.roundId,
      playerId: laser.ownerId,
      laserId: laser.id,
      enemyId: enemy.id,
      type: "laser:hit"
    });
  }

  scoreEventForEnemy(enemy) {
    return enemy.type === "goomba" || enemy.type === "fastWalker" ? "enemyBasic" : "enemyAdvanced";
  }

  defeatEnemy(enemy) {
    enemy.alive = false;
    enemy.state = "defeated";
    enemy.vx = 0;
    enemy.vy = 0;
  }

  spawnEnemyProjectile(source, now = Date.now()) {
    if (!source.alive || source.state !== "telegraph") return false;
    if (this.enemyProjectiles.length >= constants.MAX_ACTIVE_ENEMY_PROJECTILES) return false;
    const direction = source.direction < 0 ? -1 : 1;
    this.enemyProjectiles.push({
      id: `enemy-shot-${this.roundId}-${this.nextEnemyProjectileId++}`,
      sourceId: source.id,
      type: "ranged",
      x: direction < 0 ? source.x - 8 : source.x + source.w,
      y: source.y + 8,
      w: 10,
      h: 8,
      vx: direction * constants.ENEMY_PROJECTILE_SPEED,
      vy: 0,
      direction,
      createdAt: now,
      expiresAt: now + constants.ENEMY_PROJECTILE_LIFETIME_MS
    });
    this.world.enemyProjectiles = this.enemyProjectiles;
    this.emitRoom("game:event", {
      id: `${this.roundId}-${this.tick}-${source.id}-enemy-fire`,
      roundId: this.roundId,
      enemyId: source.id,
      type: "enemy:fire",
      x: source.x,
      y: source.y
    });
    return true;
  }

  stepEnemyProjectiles(dt, now) {
    if (!this.enemyProjectiles.length) return;
    const survivors = [];
    this.enemyProjectiles.forEach((projectile) => {
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      if (now >= projectile.expiresAt ||
        projectile.x + projectile.w < 0 ||
        projectile.x > this.world.width ||
        projectile.y + projectile.h < 0 ||
        projectile.y > this.world.height) return;
      if (this.world.solids.some((solid) => physics.overlaps(projectile, solid))) return;
      const hitPlayer = this.activePlayers().find((player) => physics.overlaps(player.state, projectile));
      if (hitPlayer) {
        if (Date.now() > hitPlayer.state.invulnerableUntil) {
          const eliminated = this.damagePlayer(hitPlayer);
          if (!eliminated) this.score(hitPlayer, "damage");
        }
        return;
      }
      survivors.push(projectile);
    });
    this.enemyProjectiles = survivors;
    this.world.enemyProjectiles = survivors;
  }

  clearPlayerLasers(playerId) {
    this.lasers = this.lasers.filter((laser) => laser.ownerId !== playerId);
  }

  clearLasers() {
    this.lasers = [];
  }

  clearEnemyProjectiles() {
    this.enemyProjectiles = [];
    if (this.world) this.world.enemyProjectiles = this.enemyProjectiles;
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
      fire: false,
      clientTime: Date.now()
    };
    player.fireHeld = false;
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
    this.clearPlayerLasers(player.id);
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
    if (!this.matchHasTimer()) return;
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
    this.clearLasers();
    this.clearEnemyProjectiles();
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
    if (this.currentCheckpointId) {
      const checkpoint = this.world.checkpoints.find((item) => item.id === this.currentCheckpointId);
      if (checkpoint) {
        checkpoint.activated = true;
        this.currentCheckpointSpawn = { x: checkpoint.spawnX, y: checkpoint.spawnY };
      }
    }
    this.tick = 0;
    this.startedAt = Date.now() + constants.ROUND_RESTART_COUNTDOWN_MS;
    this.remainingSeconds = this.matchDurationSeconds();
    this.lastSnapshotAt = 0;
    this.events = [];
    this.clearLasers();
    this.enemyProjectiles = this.world.enemyProjectiles || [];
    this.nextLaserId = 1;
    this.nextEnemyProjectileId = 1;
    this.firstFinishAwarded = false;
    this.gameOverStarted = false;
    this.gameOverStartedAt = null;
    this.restartAt = null;
    this.roundStartsAt = Date.now() + constants.ROUND_RESTART_COUNTDOWN_MS;
    this.roundState = constants.ROUND_STATES.COUNTDOWN;
    this.resetPlayers({ resetStats: true, useCheckpoint: true });
    this.emitRoom("round:reset", this.snapshot());
    this.emitRoom("game:countdown", { remaining: 3, roundId: this.roundId, roundStartsAt: this.roundStartsAt });
  }

  startRoundIfReady(now) {
    if (this.roundState !== constants.ROUND_STATES.COUNTDOWN || now < this.roundStartsAt) return;
    this.roundState = constants.ROUND_STATES.PLAYING;
    this.startedAt = now;
    this.remainingSeconds = this.matchDurationSeconds();
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
      currentCheckpointId: this.currentCheckpointId,
      level: {
        id: this.world.id,
        title: this.world.title,
        width: this.world.width,
        finishX: this.world.finishX,
        endless: !!this.world.endless,
        theme: this.world.theme,
        sections: this.world.sections
      },
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
      enemies: this.world.enemies.map((enemy) => ({
        id: enemy.id,
        x: enemy.x,
        y: enemy.y,
        w: enemy.w,
        h: enemy.h,
        vx: enemy.vx,
        alive: enemy.alive,
        type: enemy.type,
        spriteFamily: enemy.spriteFamily,
        behaviour: enemy.behaviour,
        state: enemy.state,
        direction: enemy.direction
      })),
      checkpoints: this.world.checkpoints.map((checkpoint) => ({
        id: checkpoint.id,
        x: checkpoint.x,
        y: checkpoint.y,
        activated: !!checkpoint.activated,
        activatedBy: checkpoint.activatedBy || null,
        sectionId: checkpoint.sectionId
      })),
      movingPlatforms: this.world.movingPlatforms.map((platform) => ({
        id: platform.id,
        x: platform.x,
        y: platform.y,
        w: platform.w,
        h: platform.h,
        vx: platform.vx
      })),
      lasers: this.lasers.map((laser) => ({
        id: laser.id,
        ownerId: laser.ownerId,
        x: laser.x,
        y: laser.y,
        w: laser.w,
        h: laser.h,
        direction: laser.direction,
        createdAt: laser.createdAt,
        expiresAt: laser.expiresAt
      })),
      enemyProjectiles: this.enemyProjectiles.map((projectile) => ({
        id: projectile.id,
        sourceId: projectile.sourceId,
        type: projectile.type,
        x: projectile.x,
        y: projectile.y,
        w: projectile.w,
        h: projectile.h,
        direction: projectile.direction,
        expiresAt: projectile.expiresAt
      }))
    };
  }
}

module.exports = { GameSession };
