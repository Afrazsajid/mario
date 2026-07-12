"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const constants = require("../shared/constants");
const { RoomManager } = require("../server/roomManager");

function manager() {
  const emitted = [];
  const rm = new RoomManager({ emitRoom: (roomCode, event, payload) => emitted.push({ roomCode, event, payload }) });
  rm.emitted = emitted;
  return rm;
}

function createFullRoom() {
  const rm = manager();
  const created = rm.createRoomWithToken("s1", { name: "Nova", character: "nova" });
  const joined = created.room.join("s2", { name: "Bolt", character: "bolt" });
  return { rm, room: created.room, host: created.player, guest: joined.player, hostToken: created.reconnectToken, guestToken: joined.reconnectToken };
}

test("creating and joining a room works", () => {
  const { room, host, guest } = createFullRoom();
  assert.equal(room.players.size, 2);
  assert.equal(host.slot, 0);
  assert.equal(guest.slot, 1);
});

test("third player is rejected and invalid room code returns no room", () => {
  const { rm, room } = createFullRoom();
  const third = room.join("s3", { name: "Third", character: "nova" });
  assert.equal(third.ok, false);
  assert.equal(rm.getRoom("bad"), null);
});

test("room state changes when both players are ready", () => {
  const { room, host, guest } = createFullRoom();
  assert.equal(room.status, constants.ROOM_STATUS.WAITING);
  assert.equal(room.setReady(host.id, true).ok, true);
  assert.equal(room.status, constants.ROOM_STATUS.WAITING);
  assert.equal(room.setReady(guest.id, true).ok, true);
  assert.equal(room.status, constants.ROOM_STATUS.READY);
  assert.equal(room.canStart(), true);
});

test("starting a game enters countdown and playing", async () => {
  const { room, host, guest } = createFullRoom();
  room.setReady(host.id, true);
  room.setReady(guest.id, true);
  const result = room.startCountdown(() => {});
  assert.equal(result.ok, true);
  assert.equal(room.status, constants.ROOM_STATUS.COUNTDOWN);
  await new Promise((resolve) => setTimeout(resolve, 3150));
  assert.equal(room.status, constants.ROOM_STATUS.PLAYING);
  assert.ok(room.game);
});

test("duplicate coin collection and enemy scoring are prevented by world state", () => {
  const { room, host, guest } = createFullRoom();
  room.setReady(host.id, true);
  room.setReady(guest.id, true);
  room.status = constants.ROOM_STATUS.PLAYING;
  room.game = new (require("../server/gameSession").GameSession)(room, () => {});
  const coin = room.game.world.coins[0];
  host.state.x = coin.x;
  host.state.y = coin.y;
  guest.state.x = coin.x;
  guest.state.y = coin.y;
  room.game.collectWorldObjects(host);
  room.game.collectWorldObjects(guest);
  assert.equal(host.stats.coins + guest.stats.coins, 1);
  const enemy = room.game.world.enemies[0];
  host.state.x = enemy.x;
  host.state.y = enemy.y - 4;
  host.state.vy = 100;
  guest.state.x = enemy.x;
  guest.state.y = enemy.y - 4;
  guest.state.vy = 100;
  room.game.checkEnemyCollisions(host);
  room.game.checkEnemyCollisions(guest);
  assert.equal(host.stats.enemiesDefeated + guest.stats.enemiesDefeated, 1);
});

test("temporary disconnect can reconnect during grace period", () => {
  const { room, guest, guestToken } = createFullRoom();
  room.disconnectPlayer(guest.id);
  assert.equal(room.players.get(guest.id).connected, false);
  const restored = room.reconnect("s2b", guest.id, guestToken);
  assert.equal(restored.ok, true);
  assert.equal(room.players.get(guest.id).connected, true);
});

test("failed reconnection expires and cleans waiting room slot", async () => {
  const { room, guest } = createFullRoom();
  room.disconnectPlayer(guest.id);
  clearTimeout(room.players.get(guest.id).reconnectTimer);
  room.players.get(guest.id).reconnectTimer = setTimeout(() => {
    room.players.delete(guest.id);
  }, 10);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(room.players.has(guest.id), false);
});

test("room cleanup and restart voting reset state", () => {
  const { rm, room, host, guest } = createFullRoom();
  room.status = constants.ROOM_STATUS.RESULTS;
  host.restartVote = true;
  guest.restartVote = true;
  room.resetToLobby();
  assert.equal(room.status, constants.ROOM_STATUS.WAITING);
  assert.equal(host.restartVote, false);
  rm.deleteRoom(room.code);
  assert.equal(rm.rooms.has(room.code), false);
});
