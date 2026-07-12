(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PQDScoring = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var SCORE_VALUES = Object.freeze({
    NORMAL_COIN: 100,
    BONUS_COIN: 250,
    DEFEAT_BASIC_ENEMY: 200,
    DEFEAT_ADVANCED_ENEMY: 350,
    MUSHROOM: 150,
    FIRE_FLOWER: 200,
    STAR: 300,
    CHECKPOINT: 250,
    ASSIST: 300,
    FINISH_LEVEL: 1000,
    FIRST_FINISH: 500,
    TIME_BONUS_PER_SECOND: 10,
    DEATH: -250,
    DAMAGE: -50,
    FALL: -300
  });

  var COMBO_WINDOW_MS = 3500;

  function createStats() {
    return {
      score: 0,
      coins: 0,
      enemiesDefeated: 0,
      powerUps: 0,
      deaths: 0,
      damageTaken: 0,
      highestCombo: 1,
      combo: 1,
      lastComboAt: -Infinity,
      finishedAt: null
    };
  }

  function positiveComboEvent(type) {
    return type === "coin" || type === "bonusCoin" || type === "enemyBasic" ||
      type === "enemyAdvanced" || type === "mushroom" || type === "fireFlower" ||
      type === "star" || type === "checkpoint" || type === "assist";
  }

  function valueFor(type) {
    switch (type) {
      case "coin": return SCORE_VALUES.NORMAL_COIN;
      case "bonusCoin": return SCORE_VALUES.BONUS_COIN;
      case "enemyBasic": return SCORE_VALUES.DEFEAT_BASIC_ENEMY;
      case "enemyAdvanced": return SCORE_VALUES.DEFEAT_ADVANCED_ENEMY;
      case "mushroom": return SCORE_VALUES.MUSHROOM;
      case "fireFlower": return SCORE_VALUES.FIRE_FLOWER;
      case "star": return SCORE_VALUES.STAR;
      case "checkpoint": return SCORE_VALUES.CHECKPOINT;
      case "assist": return SCORE_VALUES.ASSIST;
      case "finish": return SCORE_VALUES.FINISH_LEVEL;
      case "firstFinish": return SCORE_VALUES.FIRST_FINISH;
      case "timeBonus": return SCORE_VALUES.TIME_BONUS_PER_SECOND;
      case "death": return SCORE_VALUES.DEATH;
      case "damage": return SCORE_VALUES.DAMAGE;
      case "fall": return SCORE_VALUES.FALL;
      default: return 0;
    }
  }

  function applyScoreEvent(stats, event, now) {
    var type = event.type;
    var base = valueFor(type);
    var multiplier = 1;

    if (positiveComboEvent(type)) {
      stats.combo = now - stats.lastComboAt <= COMBO_WINDOW_MS ? stats.combo + 1 : 1;
      stats.lastComboAt = now;
      stats.highestCombo = Math.max(stats.highestCombo, stats.combo);
      multiplier = Math.min(4, 1 + (stats.combo - 1) * 0.25);
    } else if (base < 0) {
      stats.combo = 1;
    }

    var delta = type === "timeBonus" ? base * Math.max(0, Math.floor(event.seconds || 0)) : Math.round(base * multiplier);
    stats.score = Math.max(0, stats.score + delta);

    if (type === "coin" || type === "bonusCoin") stats.coins += 1;
    if (type === "enemyBasic" || type === "enemyAdvanced") stats.enemiesDefeated += 1;
    if (type === "mushroom" || type === "fireFlower" || type === "star") stats.powerUps += 1;
    if (type === "death" || type === "fall") stats.deaths += 1;
    if (type === "damage") stats.damageTaken += 1;
    if (type === "finish" && stats.finishedAt === null) stats.finishedAt = event.finishedAt || now;

    return { delta: delta, combo: stats.combo, score: stats.score };
  }

  function chooseWinner(players) {
    var list = players.slice().sort(function (a, b) {
      if (b.stats.score !== a.stats.score) return b.stats.score - a.stats.score;
      if (a.stats.deaths !== b.stats.deaths) return a.stats.deaths - b.stats.deaths;
      var af = a.stats.finishedAt == null ? Infinity : a.stats.finishedAt;
      var bf = b.stats.finishedAt == null ? Infinity : b.stats.finishedAt;
      if (af !== bf) return af - bf;
      if (b.stats.coins !== a.stats.coins) return b.stats.coins - a.stats.coins;
      return 0;
    });

    if (list.length < 2) return { winnerId: list[0] ? list[0].id : null, draw: false, reason: "single-player" };
    var top = list[0], next = list[1];
    var draw = top.stats.score === next.stats.score &&
      top.stats.deaths === next.stats.deaths &&
      (top.stats.finishedAt || null) === (next.stats.finishedAt || null) &&
      top.stats.coins === next.stats.coins;
    return { winnerId: draw ? null : top.id, draw: draw, reason: draw ? "draw" : "score" };
  }

  return Object.freeze({
    SCORE_VALUES: SCORE_VALUES,
    COMBO_WINDOW_MS: COMBO_WINDOW_MS,
    createStats: createStats,
    applyScoreEvent: applyScoreEvent,
    chooseWinner: chooseWinner
  });
});
