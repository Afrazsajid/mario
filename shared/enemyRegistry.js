(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./enemyAtlas"));
  else root.PQDEnemyRegistry = factory(root.PQDEnemyAtlas);
})(typeof globalThis !== "undefined" ? globalThis : this, function (enemyAtlas) {
  "use strict";

  var ROLES = Object.freeze({
    PRESSURE: "pressure",
    PATROL: "patrol",
    LANDING_THREAT: "landing_threat",
    ROUTE_GUARD: "route_guard",
    REWARD_GUARD: "reward_guard",
    VERTICAL_PRESSURE: "vertical_pressure",
    AERIAL_PRESSURE: "aerial_pressure",
    PURSUER: "pursuer",
    ELITE: "elite",
    BOSS: "boss"
  });

  function enemy(config) {
    return Object.freeze(config);
  }

  var ENEMY_TYPES = Object.freeze({
    basicWalker: enemy({
      id: "basicWalker",
      legacyType: "goomba",
      spriteFamily: "basicWalker",
      role: ROLES.PATROL,
      health: 1,
      movementSpeed: 28,
      acceleration: 0,
      gravity: true,
      damage: 1,
      scoreType: "enemyBasic",
      scoreValue: 200,
      enemyBudgetCost: 1,
      minimumDifficulty: 1,
      allowedBiomes: ["aboveground"],
      behaviour: "walker",
      collisionSize: { w: 14, h: 14 },
      attackCooldown: 0,
      spawnRules: { groundOnly: true, safeEntryDistance: 56, safeExitDistance: 32 },
      maximumSimultaneousCount: 10
    }),
    fastWalker: enemy({
      id: "fastWalker",
      legacyType: "goomba",
      spriteFamily: "fastWalker",
      role: ROLES.PRESSURE,
      health: 1,
      movementSpeed: 44,
      acceleration: 0,
      gravity: true,
      damage: 1,
      scoreType: "enemyBasic",
      scoreValue: 250,
      enemyBudgetCost: 2,
      minimumDifficulty: 3,
      allowedBiomes: ["aboveground"],
      behaviour: "walker",
      collisionSize: { w: 14, h: 14 },
      attackCooldown: 0,
      spawnRules: { groundOnly: true, safeEntryDistance: 64, safeExitDistance: 40 },
      maximumSimultaneousCount: 6
    }),
    koopa: enemy({
      id: "koopa",
      legacyType: "koopa",
      spriteFamily: "koopa",
      role: ROLES.REWARD_GUARD,
      health: 1,
      movementSpeed: 26,
      acceleration: 0,
      gravity: true,
      damage: 1,
      scoreType: "enemyAdvanced",
      scoreValue: 350,
      enemyBudgetCost: 3,
      minimumDifficulty: 2,
      allowedBiomes: ["aboveground"],
      behaviour: "walker_shell_candidate",
      collisionSize: { w: 14, h: 24 },
      attackCooldown: 0,
      spawnRules: { groundOnly: true, safeEntryDistance: 72, safeExitDistance: 48 },
      maximumSimultaneousCount: 5
    }),
    spiny: enemy({
      id: "spiny",
      legacyType: "spiny",
      spriteFamily: "spiny",
      role: ROLES.ROUTE_GUARD,
      health: 1,
      movementSpeed: 22,
      acceleration: 0,
      gravity: true,
      damage: 1,
      scoreType: "enemyAdvanced",
      scoreValue: 400,
      enemyBudgetCost: 4,
      minimumDifficulty: 4,
      allowedBiomes: ["aboveground"],
      behaviour: "armoured_walker",
      collisionSize: { w: 14, h: 14 },
      attackCooldown: 0,
      spawnRules: { groundOnly: true, safeEntryDistance: 80, safeExitDistance: 56 },
      maximumSimultaneousCount: 4
    }),
    jumper: enemy({
      id: "jumper",
      legacyType: "jumper",
      spriteFamily: "jumper",
      role: ROLES.VERTICAL_PRESSURE,
      health: 1,
      movementSpeed: 20,
      acceleration: 0,
      gravity: true,
      damage: 1,
      scoreType: "enemyAdvanced",
      scoreValue: 450,
      enemyBudgetCost: 4,
      minimumDifficulty: 4,
      allowedBiomes: ["aboveground"],
      behaviour: "cycle_jumper",
      collisionSize: { w: 14, h: 24 },
      attackCooldown: 1600,
      spawnRules: { groundOnly: true, safeEntryDistance: 88, safeExitDistance: 56 },
      maximumSimultaneousCount: 3
    }),
    plant: enemy({
      id: "plant",
      legacyType: "plant",
      spriteFamily: "plant",
      role: ROLES.REWARD_GUARD,
      health: 1,
      movementSpeed: 0,
      acceleration: 0,
      gravity: false,
      damage: 1,
      scoreType: "enemyAdvanced",
      scoreValue: 450,
      enemyBudgetCost: 4,
      minimumDifficulty: 3,
      allowedBiomes: ["aboveground"],
      behaviour: "pipe_plant_cycle",
      collisionSize: { w: 14, h: 24 },
      attackCooldown: 2200,
      spawnRules: { pipeOnly: true, safeEntryDistance: 96, safeExitDistance: 56 },
      maximumSimultaneousCount: 4
    }),
    aerial: enemy({
      id: "aerial",
      legacyType: "aerial",
      spriteFamily: "aerial",
      role: ROLES.AERIAL_PRESSURE,
      health: 1,
      movementSpeed: 36,
      acceleration: 0,
      gravity: false,
      damage: 1,
      scoreType: "enemyAdvanced",
      scoreValue: 400,
      enemyBudgetCost: 4,
      minimumDifficulty: 5,
      allowedBiomes: ["aboveground"],
      behaviour: "aerial_sine",
      collisionSize: { w: 14, h: 14 },
      attackCooldown: 0,
      spawnRules: { airOnly: true, safeEntryDistance: 96, safeExitDistance: 64 },
      maximumSimultaneousCount: 4
    }),
    elite: enemy({
      id: "elite",
      legacyType: "elite",
      spriteFamily: "elite",
      role: ROLES.ELITE,
      health: 2,
      movementSpeed: 18,
      acceleration: 0,
      gravity: true,
      damage: 1,
      scoreType: "enemyAdvanced",
      scoreValue: 900,
      enemyBudgetCost: 8,
      minimumDifficulty: 7,
      allowedBiomes: ["aboveground"],
      behaviour: "elite_patrol",
      collisionSize: { w: 28, h: 30 },
      attackCooldown: 1800,
      spawnRules: { arenaOnly: true, safeEntryDistance: 128, safeExitDistance: 96 },
      maximumSimultaneousCount: 1
    })
  });

  var UNSUPPORTED_ATLAS_FAMILIES = Object.freeze(Object.keys(enemyAtlas.FAMILIES).filter(function (id) {
    return !enemyAtlas.FAMILIES[id].gameplaySupported;
  }));

  function get(id) {
    return ENEMY_TYPES[id] || ENEMY_TYPES.basicWalker;
  }

  function unlockedForTier(tier) {
    return Object.keys(ENEMY_TYPES).filter(function (id) {
      return ENEMY_TYPES[id].minimumDifficulty <= tier;
    });
  }

  return Object.freeze({
    ROLES: ROLES,
    ENEMY_TYPES: ENEMY_TYPES,
    UNSUPPORTED_ATLAS_FAMILIES: UNSUPPORTED_ATLAS_FAMILIES,
    get: get,
    unlockedForTier: unlockedForTier
  });
});
