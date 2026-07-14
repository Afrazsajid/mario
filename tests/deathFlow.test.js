"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const constants = require("../shared/constants");
const { RoomManager } = require("../server/roomManager");
const { GameSession } = require("../server/gameSession");

function createSession() {
  const emitted = [];
  const rm = new RoomManager({ emitRoom: (roomCode, event, payload) => emitted.push({ roomCode, event, payload }) });
  const created = rm.createRoomWithToken("s1", { name: "Nova", character: "nova" });
  const joined = created.room.join("s2", { name: "Bolt", character: "bolt" });
  const room = created.room;
  room.status = constants.ROOM_STATUS.PLAYING;
  room.game = new GameSession(room, (event, payload) => emitted.push({ roomCode: room.code, event, payload }));
  return { emitted, room, game: room.game, host: created.player, guest: joined.player };
}

function finishDeathAnimation(player) {
  player.state.deathAnimationEndsAt = Date.now() - 1;
  player.state.deathStartedAt = Date.now() - constants.DEATH_ANIMATION_MS - 1;
}

test("a dead player becomes a spectator and cannot send input", () => {
  const { game, host, guest } = createSession();
  host.input = { sequence: 7, right: true };
  assert.equal(game.eliminatePlayer(host, "fall"), true);
  assert.equal(host.state.playerState, constants.PLAYER_STATES.DYING);
  assert.equal(host.input.right, false);
  assert.equal(guest.state.playerState, constants.PLAYER_STATES.ACTIVE);

  finishDeathAnimation(host);
  game.update(1 / constants.SERVER_TICK_RATE);
  assert.equal(host.state.playerState, constants.PLAYER_STATES.SPECTATING);
  assert.equal(host.state.isSpectating, true);
  assert.equal(game.roundState, constants.ROUND_STATES.PLAYING);

  game.setInput(host.id, { sequence: 99, right: true });
  assert.notEqual(host.input.sequence, 99);
  assert.equal(host.input.right, false);
});

test("all eliminated players trigger Game Over once", () => {
  const { emitted, game, host, guest } = createSession();
  game.eliminatePlayer(host, "fall");
  game.eliminatePlayer(guest, "enemy");
  finishDeathAnimation(host);
  finishDeathAnimation(guest);

  game.update(1 / constants.SERVER_TICK_RATE);
  assert.equal(game.roundState, constants.ROUND_STATES.GAME_OVER);
  assert.equal(game.gameOverStarted, true);
  assert.ok(game.restartAt > Date.now());

  const gameOverEvents = () => emitted.filter((item) => item.event === "round:gameOver").length;
  assert.equal(gameOverEvents(), 1);
  game.beginGameOver("duplicate");
  game.update(1 / constants.SERVER_TICK_RATE);
  assert.equal(gameOverEvents(), 1);
});

test("automatic restart resets the mutable round state", () => {
  const { game, host, guest } = createSession();
  const firstRound = game.roundId;
  host.stats.score = 1200;
  guest.stats.coins = 4;
  host.state.form = "fire";
  game.world.coins[0].collectedBy = host.id;
  game.world.enemies[0].alive = false;

  game.beginGameOver("test");
  game.restartAt = Date.now() - 1;
  game.advanceRestart(Date.now());

  assert.equal(game.roundId, firstRound + 1);
  assert.equal(game.roundState, constants.ROUND_STATES.COUNTDOWN);
  assert.equal(host.stats.score, 0);
  assert.equal(guest.stats.coins, 0);
  assert.equal(host.state.form, "small");
  assert.equal(game.world.coins.some((coin) => coin.collectedBy), false);
  assert.equal(game.world.enemies.every((enemy) => enemy.alive), true);

  game.roundStartsAt = Date.now() - 1;
  game.update(1 / constants.SERVER_TICK_RATE);
  assert.equal(game.roundState, constants.ROUND_STATES.PLAYING);
});

test("a survivor can finish the level after the other player is spectating", () => {
  const { emitted, room, game, host, guest } = createSession();
  game.eliminatePlayer(host, "fall");
  finishDeathAnimation(host);
  game.update(1 / constants.SERVER_TICK_RATE);

  game.world.finishX = guest.state.x;
  guest.state.x = game.world.finishX;
  game.update(0);

  assert.equal(room.status, constants.ROOM_STATUS.RESULTS);
  assert.notEqual(game.roundState, constants.ROUND_STATES.GAME_OVER);
  assert.equal(emitted.some((item) => item.event === "game:over"), true);
});
