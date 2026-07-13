"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const constants = require("../shared/constants");
const levelData = require("../shared/levelData");
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

test("extended level validates and exposes six progressive sections", () => {
  const world = levelData.createWorld();
  const report = levelData.validateLevel(world);
  assert.equal(report.ok, true, report.issues.join("\n"));
  assert.deepEqual(report.sections, ["intro", "movement", "enemy", "vertical", "advanced", "final"]);
  assert.equal(world.width, constants.LEVEL_WIDTH);
  assert.equal(world.finishX, 434 * constants.TILE_SIZE);
  assert.equal(world.checkpoints.length, 4);
  assert.equal(world.movingPlatforms.length, 4);
});

test("old blocked wall area is a climbable designed route", () => {
  const world = levelData.createWorld();
  const fixedSteps = world.staticSolids
    .filter((solid) => solid.id.indexOf("fixed-route-") === 0 && solid.id.indexOf("step") !== -1)
    .sort((a, b) => a.x - b.x);
  assert.ok(fixedSteps.length >= 12);
  for (let i = 1; i < fixedSteps.length; i += 1) {
    const dx = Math.abs(fixedSteps[i].x - fixedSteps[i - 1].x);
    const dy = Math.abs(fixedSteps[i].y - fixedSteps[i - 1].y);
    assert.ok(dx <= constants.TILE_SIZE * 7);
    assert.ok(dy <= constants.PLAYER_SUPER_HEIGHT * 2);
  }
  assert.equal(levelData.validateLevel(world).ok, true);
});

test("checkpoints activate once, sync in snapshots and become restart spawn", () => {
  const { game, mario, luigi } = createSession();
  const checkpoint = game.world.checkpoints[0];
  mario.state.x = checkpoint.x;
  mario.state.y = checkpoint.y;
  game.checkCheckpoints(mario);
  assert.equal(checkpoint.activated, true);
  assert.equal(game.currentCheckpointId, checkpoint.id);
  assert.equal(mario.stats.score, 250);

  game.checkCheckpoints(luigi);
  assert.equal(luigi.stats.score, 0);
  assert.equal(game.snapshot().checkpoints[0].activated, true);

  game.beginGameOver("test");
  game.restartAt = Date.now() - 1;
  game.advanceRestart(Date.now());
  assert.equal(game.roundState, constants.ROUND_STATES.COUNTDOWN);
  assert.ok(mario.state.x >= checkpoint.spawnX);
  assert.ok(luigi.state.x > mario.state.x);
});

test("moving platforms are server-synchronised and carry standing players", () => {
  const { game, mario } = createSession();
  const platform = game.world.movingPlatforms[0];
  mario.state.x = platform.x + 8;
  mario.state.y = platform.y - mario.state.h;
  const startX = mario.state.x;
  game.stepMovingPlatforms(1 / constants.SERVER_TICK_RATE);
  assert.notEqual(platform.x, platform.baseX);
  assert.notEqual(mario.state.x, startX);
  assert.equal(game.snapshot().movingPlatforms[0].id, platform.id);
});
