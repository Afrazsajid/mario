"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const scoring = require("../shared/scoring");

test("server-side score updates and duplicate prevention are caller-controlled", () => {
  const stats = scoring.createStats();
  const first = scoring.applyScoreEvent(stats, { type: "coin" }, 1000);
  assert.equal(first.delta, 100);
  assert.equal(stats.coins, 1);
  const enemy = scoring.applyScoreEvent(stats, { type: "enemyBasic" }, 1100);
  assert.equal(enemy.delta, 250);
  assert.equal(stats.enemiesDefeated, 1);
});

test("winner calculation uses tie-breakers", () => {
  const a = { id: "a", stats: scoring.createStats() };
  const b = { id: "b", stats: scoring.createStats() };
  a.stats.score = 1000;
  b.stats.score = 1000;
  a.stats.deaths = 1;
  b.stats.deaths = 0;
  assert.equal(scoring.chooseWinner([a, b]).winnerId, "b");

  a.stats.deaths = 0;
  a.stats.finishedAt = 2000;
  b.stats.finishedAt = 3000;
  assert.equal(scoring.chooseWinner([a, b]).winnerId, "a");

  a.stats.finishedAt = 2000;
  b.stats.finishedAt = 2000;
  b.stats.coins = 3;
  assert.equal(scoring.chooseWinner([a, b]).winnerId, "b");
});

test("winner calculation can declare a draw", () => {
  const a = { id: "a", stats: scoring.createStats() };
  const b = { id: "b", stats: scoring.createStats() };
  assert.equal(scoring.chooseWinner([a, b]).draw, true);
});
