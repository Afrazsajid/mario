"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const constants = require("../shared/constants");
const { RoomManager } = require("../server/roomManager");
const { GameSession } = require("../server/gameSession");

function createSession() {
  const rm = new RoomManager();
  const created = rm.createRoomWithToken("s1", { name: "Mario", character: "nova" });
  const joined = created.room.join("s2", { name: "Luigi", character: "bolt" });
  const room = created.room;
  room.status = constants.ROOM_STATUS.PLAYING;
  room.game = new GameSession(room, () => {});
  return { room, game: room.game, mario: created.player, luigi: joined.player };
}

function makeFire(player) {
  player.state.form = "fire";
  player.state.h = constants.PLAYER_SUPER_HEIGHT;
  player.state.y -= constants.PLAYER_SUPER_HEIGHT - constants.PLAYER_SMALL_HEIGHT;
}

function pressFire(game, player, now = Date.now()) {
  player.input = { sequence: (player.input.sequence || 0) + 1, fire: true };
  player.fireHeld = false;
  player.lastLaserFiredAt = now - constants.LASER_COOLDOWN_MS - 1;
  return game.handleFireInput(player, now);
}

test("only active fire-form players can shoot lasers", () => {
  const { game, mario } = createSession();
  assert.equal(pressFire(game, mario), false);
  assert.equal(game.lasers.length, 0);

  makeFire(mario);
  assert.equal(pressFire(game, mario), true);
  assert.equal(game.lasers.length, 1);

  mario.state.pendingForm = "super";
  assert.equal(pressFire(game, mario), false);
  mario.state.pendingForm = null;
  mario.state.playerState = constants.PLAYER_STATES.SPECTATING;
  assert.equal(pressFire(game, mario), false);
});

test("lasers spawn from the player's hand in the current facing direction", () => {
  const { game, mario, luigi } = createSession();
  makeFire(mario);
  makeFire(luigi);

  mario.state.facing = 1;
  assert.equal(pressFire(game, mario), true);
  assert.equal(game.lasers[0].direction, 1);
  assert.equal(game.lasers[0].vx, constants.LASER_SPEED);
  assert.ok(game.lasers[0].x >= mario.state.x + mario.state.w - 1);

  luigi.state.facing = -1;
  assert.equal(pressFire(game, luigi), true);
  assert.equal(game.lasers[1].direction, -1);
  assert.equal(game.lasers[1].vx, -constants.LASER_SPEED);
  assert.ok(game.lasers[1].x <= luigi.state.x);
});

test("cooldown and max active laser limits are enforced server-side", () => {
  const { game, mario } = createSession();
  const now = Date.now();
  makeFire(mario);

  assert.equal(pressFire(game, mario, now), true);
  mario.fireHeld = false;
  mario.input.fire = true;
  assert.equal(game.handleFireInput(mario, now + constants.LASER_COOLDOWN_MS - 10), false);
  assert.equal(game.lasers.length, 1);

  mario.fireHeld = false;
  assert.equal(game.handleFireInput(mario, now + constants.LASER_COOLDOWN_MS + 1), true);
  assert.equal(game.lasers.length, 2);

  mario.fireHeld = false;
  mario.lastLaserFiredAt = now - constants.LASER_COOLDOWN_MS - 1;
  assert.equal(game.handleFireInput(mario, now + constants.LASER_COOLDOWN_MS * 3), false);
  assert.equal(game.lasers.length, constants.MAX_ACTIVE_LASERS_PER_PLAYER);
});

test("laser hits defeat an enemy once and award the owner score", () => {
  const { game, mario } = createSession();
  makeFire(mario);
  const enemy = game.world.enemies[0];
  game.lasers.push({
    id: "test-laser",
    ownerId: mario.id,
    x: enemy.x,
    y: enemy.y,
    w: constants.LASER_WIDTH,
    h: constants.LASER_HEIGHT,
    vx: constants.LASER_SPEED,
    direction: 1,
    createdAt: Date.now(),
    expiresAt: Date.now() + constants.LASER_LIFETIME_MS
  });

  game.stepLasers(0, Date.now());
  assert.equal(enemy.alive, false);
  assert.equal(game.lasers.length, 0);
  assert.equal(mario.stats.enemiesDefeated, 1);

  game.destroyEnemyWithLaser({ ownerId: mario.id, id: "duplicate" }, enemy);
  assert.equal(mario.stats.enemiesDefeated, 1);
});

test("lasers are destroyed by solids, boundaries, lifetime and round cleanup", () => {
  const { game, mario, luigi } = createSession();
  makeFire(mario);
  makeFire(luigi);
  const now = Date.now();
  const solid = game.world.solids.find((item) => item.type === "pipe" || item.type === "block" || item.type === "brick");

  game.lasers = [{
    id: "solid-hit",
    ownerId: mario.id,
    x: solid.x,
    y: solid.y,
    w: constants.LASER_WIDTH,
    h: constants.LASER_HEIGHT,
    vx: constants.LASER_SPEED,
    direction: 1,
    createdAt: now,
    expiresAt: now + constants.LASER_LIFETIME_MS
  }];
  game.stepLasers(0, now);
  assert.equal(game.lasers.length, 0);

  game.lasers = [{
    id: "boundary",
    ownerId: mario.id,
    x: game.world.width + 1,
    y: 30,
    w: constants.LASER_WIDTH,
    h: constants.LASER_HEIGHT,
    vx: constants.LASER_SPEED,
    direction: 1,
    createdAt: now,
    expiresAt: now + constants.LASER_LIFETIME_MS
  }];
  game.stepLasers(0, now);
  assert.equal(game.lasers.length, 0);

  game.lasers = [{
    id: "expired",
    ownerId: mario.id,
    x: 30,
    y: 30,
    w: constants.LASER_WIDTH,
    h: constants.LASER_HEIGHT,
    vx: constants.LASER_SPEED,
    direction: 1,
    createdAt: now - constants.LASER_LIFETIME_MS,
    expiresAt: now - 1
  }];
  game.stepLasers(0, now);
  assert.equal(game.lasers.length, 0);

  pressFire(game, mario, now + 2000);
  pressFire(game, luigi, now + 2000);
  assert.equal(game.lasers.length, 2);
  game.eliminatePlayer(mario, "fall");
  assert.equal(game.lasers.some((laser) => laser.ownerId === mario.id), false);
  assert.equal(game.lasers.some((laser) => laser.ownerId === luigi.id), true);

  game.beginGameOver("test");
  assert.equal(game.lasers.length, 0);

  game.lasers.push({
    id: "restart-clear",
    ownerId: luigi.id,
    x: 20,
    y: 20,
    w: constants.LASER_WIDTH,
    h: constants.LASER_HEIGHT,
    vx: constants.LASER_SPEED,
    direction: 1,
    createdAt: now,
    expiresAt: now + constants.LASER_LIFETIME_MS
  });
  game.resetRound();
  assert.equal(game.lasers.length, 0);
});
