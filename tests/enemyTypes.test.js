"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const constants = require("../shared/constants");
const enemyRegistry = require("../shared/enemyRegistry");
const levelData = require("../shared/levelData");
const { RoomManager } = require("../server/roomManager");
const { GameSession } = require("../server/gameSession");

function createSession() {
  const emitted = [];
  const rm = new RoomManager({ emitRoom: (roomCode, event, payload) => emitted.push({ roomCode, event, payload }) });
  const created = rm.createRoomWithToken("s1", { name: "Mario", character: "nova" });
  const joined = created.room.join("s2", { name: "Luigi", character: "bolt" });
  const room = created.room;
  room.status = constants.ROOM_STATUS.PLAYING;
  room.game = new GameSession(room, (event, payload) => emitted.push({ roomCode: room.code, event, payload }));
  return { emitted, game: room.game, mario: created.player, luigi: joined.player };
}

test("enemy registry exposes Phase 1 enemy behaviours and measured atlas frames", () => {
  ["goomba", "fastWalker", "koopa", "plant", "spiny", "flying", "ranged"].forEach((type) => {
    assert.ok(enemyRegistry.ENEMY_TYPES[type], `${type} is registered`);
    assert.ok(enemyRegistry.frameForType(type), `${type} has atlas frames`);
  });
  assert.equal(enemyRegistry.frameForType("plant").enemy[0].sx, 128);
  assert.equal(enemyRegistry.frameForType("spiny").enemy[0].sx, 512);
  assert.equal(enemyRegistry.frameForType("flying").enemy[0].sw, 32);
  assert.ok(enemyRegistry.ENCOUNTER_TEMPLATES.length >= 14);
});

test("endless world contains progressively unlocked enemy variety", () => {
  const world = levelData.createWorld();
  const types = new Set(world.enemies.map((enemy) => enemy.type));
  ["goomba", "fastWalker", "koopa", "plant", "spiny", "flying", "ranged"].forEach((type) => {
    assert.equal(types.has(type), true, `${type} appears in authored encounters`);
  });
  assert.equal(levelData.validateLevel(world).ok, true);
});

test("pipe plant remains hidden while a player is close to the pipe", () => {
  const { game, mario } = createSession();
  const plant = game.world.enemies.find((enemy) => enemy.type === "plant");
  assert.ok(plant);
  mario.state.x = plant.x - 8;
  mario.state.y = plant.pipeTopY - mario.state.h;

  for (let i = 0; i < 90; i += 1) game.update(1 / constants.SERVER_TICK_RATE);

  assert.equal(plant.state, "hidden");
  assert.ok(plant.y >= plant.pipeTopY);
});

test("koopa stomp enters shell state and side contact kicks the shell", () => {
  const { game, mario } = createSession();
  const koopa = game.world.enemies.find((enemy) => enemy.type === "koopa");
  assert.ok(koopa);
  mario.state.x = koopa.x;
  mario.state.y = koopa.y - mario.state.h + 8;
  mario.state.vy = 160;

  game.checkEnemyCollisions(mario);
  assert.equal(koopa.alive, true);
  assert.equal(koopa.state, "shellStationary");

  mario.state.x = koopa.x - mario.state.w + 2;
  mario.state.y = koopa.y;
  mario.state.vy = 0;
  game.checkEnemyCollisions(mario);

  assert.equal(koopa.state, "shellMoving");
  assert.ok(koopa.vx > 0);
});

test("spiny cannot be defeated by a normal stomp but star defeats it", () => {
  const { game, mario, luigi } = createSession();
  const spiny = game.world.enemies.find((enemy) => enemy.type === "spiny");
  assert.ok(spiny);
  mario.state.invulnerableUntil = 0;
  mario.state.x = spiny.x;
  mario.state.y = spiny.y - mario.state.h + 8;
  mario.state.vy = 160;

  game.checkEnemyCollisions(mario);
  assert.equal(spiny.alive, true);
  assert.equal(mario.state.playerState, constants.PLAYER_STATES.DYING);

  luigi.state.temporaryEffect = "star";
  luigi.state.x = spiny.x;
  luigi.state.y = spiny.y - luigi.state.h + 8;
  luigi.state.vy = 160;
  game.checkEnemyCollisions(luigi);
  assert.equal(spiny.alive, false);
});

test("ranged enemy creates server-authoritative projectiles with a telegraph", () => {
  const { emitted, game, mario } = createSession();
  const ranged = game.world.enemies.find((enemy) => enemy.type === "ranged");
  assert.ok(ranged);
  mario.state.x = ranged.x - 120;
  mario.state.y = ranged.y;

  for (let i = 0; i < 30; i += 1) game.update(1 / constants.SERVER_TICK_RATE);

  assert.ok(game.enemyProjectiles.length > 0);
  assert.equal(emitted.some((item) => item.payload && item.payload.type === "enemy:fire"), true);
});
