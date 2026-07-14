"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const constants = require("../shared/constants");
const enemyRegistry = require("../shared/enemyRegistry");
const levelData = require("../shared/levelData");
const physics = require("../shared/physics");
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
  ["goomba", "fastWalker", "koopa", "plant", "spiny", "flying", "ranged", "fish"].forEach((type) => {
    assert.ok(enemyRegistry.ENEMY_TYPES[type], `${type} is registered`);
    assert.ok(enemyRegistry.frameForType(type), `${type} has atlas frames`);
  });
  assert.equal(enemyRegistry.frameForType("plant").enemy[0].sx, 224);
  assert.equal(enemyRegistry.frameForType("plant").enemy[0].sy, 8);
  assert.equal(enemyRegistry.frameForType("plant").enemy[0].mouth, "closed");
  assert.equal(enemyRegistry.frameForType("plant").enemy[1].sx, 240);
  assert.equal(enemyRegistry.frameForType("plant").enemy[1].mouth, "open");
  assert.equal(enemyRegistry.frameForType("plant").upsideDown[0].sx, 256);
  assert.equal(enemyRegistry.frameForType("plant").upsideDown[1].sx, 272);
  assert.equal(enemyRegistry.frameForType("spiny").enemy[0].sx, 512);
  assert.equal(enemyRegistry.frameForType("flying").enemy[0].sw, 32);
  assert.equal(enemyRegistry.frameForType("fish").enemy[0].sx, 624);
  assert.equal(enemyRegistry.frameForType("fish").enemy[1].sx, 640);
  assert.equal(enemyRegistry.frameForType("fish").enemy[0].sw, 16);
  assert.equal(enemyRegistry.frameForType("fish").enemy[0].sh, 16);
  assert.ok(enemyRegistry.ENCOUNTER_TEMPLATES.length >= 14);
});

test("endless world contains progressively unlocked enemy variety", () => {
  const world = levelData.createWorld();
  const types = new Set(world.enemies.map((enemy) => enemy.type));
  ["goomba", "fastWalker", "koopa", "plant", "spiny", "flying", "ranged", "fish"].forEach((type) => {
    assert.equal(types.has(type), true, `${type} appears in authored encounters`);
  });
  assert.equal(levelData.validateLevel(world).ok, true);
});

test("flower plants are introduced early and reused on strategic pipe positions", () => {
  const world = levelData.createWorld();
  const plants = world.enemies.filter((enemy) => enemy.type === "plant");
  const storyPlants = plants.filter((enemy) => enemy.id.startsWith("story-plant-"));
  assert.equal(storyPlants.length, 3);
  assert.ok(storyPlants.some((enemy) => enemy.id === "story-plant-intro" && enemy.x === 28 * constants.TILE_SIZE));
  assert.ok(storyPlants.some((enemy) => enemy.id === "story-plant-enemy" && enemy.x === 214 * constants.TILE_SIZE));
  assert.ok(storyPlants.some((enemy) => enemy.id === "story-plant-final" && enemy.x === 398 * constants.TILE_SIZE));
  assert.ok(storyPlants.every((enemy) => enemy.behaviour === "pipePlant" && enemy.state === "hidden"));
  assert.equal(enemyRegistry.ENEMY_TYPES.plant.minimumDistance, 550);
});

test("fish crossing enemy uses a bounded predictable arc and syncs in snapshots", () => {
  const { game } = createSession();
  const fish = game.world.enemies.find((enemy) => enemy.type === "fish");
  assert.ok(fish);
  assert.equal(fish.behaviour, "crossingFish");
  const startY = fish.y;

  for (let i = 0; i < 90; i += 1) game.update(1 / constants.SERVER_TICK_RATE);

  assert.ok(fish.x >= fish.patrolMinX);
  assert.ok(fish.x <= fish.patrolMaxX);
  assert.ok(fish.y <= fish.baseY);
  assert.notEqual(fish.y, startY);

  const snapshotFish = game.snapshot().enemies.find((enemy) => enemy.id === fish.id);
  assert.equal(snapshotFish.type, "fish");
  assert.equal(snapshotFish.state, fish.state);
  assert.equal(snapshotFish.direction, fish.direction);
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

test("pipe plant rises, attacks, lowers and syncs animation timing", () => {
  const { game, mario } = createSession();
  const plant = game.world.enemies.find((enemy) => enemy.type === "plant");
  assert.ok(plant);
  mario.state.x = plant.x - 160;
  mario.state.y = plant.pipeTopY - mario.state.h;

  const seen = new Set();
  for (let i = 0; i < 150; i += 1) {
    game.update(1 / constants.SERVER_TICK_RATE);
    seen.add(plant.state);
  }

  assert.equal(seen.has("rising"), true);
  assert.equal(seen.has("attacking"), true);
  assert.equal(seen.has("lowering"), true);
  assert.ok(plant.y <= plant.hiddenY);
  assert.ok([0, 1].includes(plant.animationFrame));

  const snapshotPlant = game.snapshot().enemies.find((enemy) => enemy.id === plant.id);
  assert.equal(snapshotPlant.state, plant.state);
  assert.equal(snapshotPlant.animationFrame, plant.animationFrame);
  assert.equal(typeof snapshotPlant.stateTime, "number");
});

test("pipe plant may rise while a player is jumping safely above the pipe", () => {
  const { game, mario } = createSession();
  const plant = game.world.enemies.find((enemy) => enemy.type === "plant");
  assert.ok(plant);
  plant.stateTime = 2;
  mario.state.x = plant.x;
  mario.state.y = plant.pipeTopY - 96;
  mario.state.vy = -120;

  physics.stepEnemy(plant, 1 / constants.SERVER_TICK_RATE, game.world, { players: [mario] });

  assert.equal(plant.state, "rising");
});

test("visible flower damages only on visible hitbox overlap", () => {
  const { game, mario } = createSession();
  const plant = game.world.enemies.find((enemy) => enemy.type === "plant");
  assert.ok(plant);
  mario.state.invulnerableUntil = 0;
  plant.state = "hidden";
  plant.y = plant.hiddenY;
  mario.state.x = plant.x;
  mario.state.y = plant.y;
  game.checkEnemyCollisions(mario);
  assert.equal(mario.state.playerState, constants.PLAYER_STATES.ACTIVE);

  plant.state = "attacking";
  plant.y = plant.exposedY;
  mario.state.x = plant.x;
  mario.state.y = plant.y;
  game.checkEnemyCollisions(mario);
  assert.equal(mario.state.playerState, constants.PLAYER_STATES.DYING);
});

test("flower can be defeated by fire once and resets on restart", () => {
  const { game, mario } = createSession();
  const plant = game.world.enemies.find((enemy) => enemy.type === "plant");
  assert.ok(plant);
  const initialScore = mario.stats.score;
  game.destroyEnemyWithLaser({ ownerId: mario.id, id: "test-flower-shot" }, plant);
  assert.equal(plant.alive, false);
  assert.equal(mario.stats.score > initialScore, true);

  game.destroyEnemyWithLaser({ ownerId: mario.id, id: "duplicate-flower-shot" }, plant);
  assert.equal(mario.stats.enemiesDefeated, 1);

  game.beginGameOver("test");
  game.restartAt = Date.now() - 1;
  game.advanceRestart(Date.now());
  const resetPlant = game.world.enemies.find((enemy) => enemy.type === "plant");
  assert.ok(resetPlant);
  assert.equal(resetPlant.alive, true);
  assert.equal(resetPlant.state, "hidden");
  assert.equal(game.enemyProjectiles.length, 0);
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
