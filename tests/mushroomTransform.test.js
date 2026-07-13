"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
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
  return { game: room.game, mario: created.player, luigi: joined.player };
}

function loadInterpolation() {
  const source = fs.readFileSync(path.join(__dirname, "..", "client", "multiplayer", "interpolation.js"), "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.PQDInterpolation;
}

test("mushroom transformation keeps both players' feet fixed", () => {
  const { game, mario, luigi } = createSession();

  [mario, luigi].forEach((player) => {
    const feetY = player.state.y + player.state.h;
    game.setPlayerForm(player, "super");
    assert.equal(player.state.form, "super");
    assert.equal(player.state.h, constants.PLAYER_SUPER_HEIGHT);
    assert.equal(player.state.y + player.state.h, feetY);
  });
});

test("client interpolation applies new Super height without floating feet", () => {
  const interpolation = loadInterpolation();
  const display = { x: 100, y: 120, w: 14, h: 16, form: "small" };
  const target = { x: 100, y: 104, w: 14, h: 32, form: "super" };
  const feetY = display.y + display.h;

  const smoothed = interpolation.smoothPlayer(display, target, 0.5);

  assert.equal(smoothed.h, constants.PLAYER_SUPER_HEIGHT);
  assert.equal(smoothed.y + smoothed.h, feetY);
  assert.equal(smoothed.form, "super");
});
