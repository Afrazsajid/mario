(function (root, factory) {
<<<<<<< HEAD
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PQDEnemyRegistry = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var ENEMY_TYPES = Object.freeze({
    goomba: Object.freeze({
      id: "goomba",
      spriteFamily: "basicWalker",
      movementSpeed: 28,
      health: 1,
      damage: 1,
      scoreEvent: "enemyBasic",
      budgetCost: 1,
      minimumDistance: 0,
      maximumNearbyCount: 5,
      behaviour: "walker",
      allowedTerrain: ["ground", "platform"],
      spawnRules: ["wideSurface", "safeEntry"]
    }),
    fastWalker: Object.freeze({
      id: "fastWalker",
      spriteFamily: "fastWalker",
      movementSpeed: 46,
      health: 1,
      damage: 1,
      scoreEvent: "enemyBasic",
      budgetCost: 2,
      minimumDistance: 2000,
      maximumNearbyCount: 3,
      behaviour: "walker",
      allowedTerrain: ["ground"],
      spawnRules: ["wideSurface", "lateIntro"]
    }),
    koopa: Object.freeze({
      id: "koopa",
      spriteFamily: "koopa",
      movementSpeed: 30,
      shellSpeed: 150,
      health: 2,
      damage: 1,
      scoreEvent: "enemyAdvanced",
      budgetCost: 2,
      minimumDistance: 1200,
      maximumNearbyCount: 3,
      behaviour: "shellWalker",
      allowedTerrain: ["ground", "platform"],
      spawnRules: ["wideSurface", "shellOpportunity"]
    }),
    plant: Object.freeze({
      id: "plant",
      spriteFamily: "flowerPlant",
      movementSpeed: 28,
      health: 1,
      damage: 1,
      scoreEvent: "enemyAdvanced",
      budgetCost: 2,
      minimumDistance: 550,
      maximumNearbyCount: 2,
      behaviour: "pipePlant",
      allowedTerrain: ["pipe"],
      spawnRules: ["pipeOnly", "offsetCycle"]
    }),
    spiny: Object.freeze({
      id: "spiny",
      spriteFamily: "spiny",
      movementSpeed: 26,
      health: 1,
      damage: 1,
      scoreEvent: "enemyAdvanced",
      budgetCost: 3,
      minimumDistance: 5000,
      maximumNearbyCount: 3,
      behaviour: "armouredWalker",
      allowedTerrain: ["ground"],
      spawnRules: ["wideSurface", "notEarly"]
    }),
    flying: Object.freeze({
      id: "flying",
      spriteFamily: "flying",
      movementSpeed: 38,
      health: 1,
      damage: 1,
      scoreEvent: "enemyAdvanced",
      budgetCost: 3,
      minimumDistance: 5500,
      maximumNearbyCount: 2,
      behaviour: "aerialPatrol",
      allowedTerrain: ["air"],
      spawnRules: ["clearAir", "verticalPressure"]
    }),
    ranged: Object.freeze({
      id: "ranged",
      spriteFamily: "ranged",
      movementSpeed: 0,
      health: 1,
      damage: 1,
      scoreEvent: "enemyAdvanced",
      budgetCost: 4,
      minimumDistance: 10000,
      maximumNearbyCount: 2,
      behaviour: "projectileThrower",
      allowedTerrain: ["ground", "platform"],
      spawnRules: ["openSpace", "safeDodge"]
    }),
    fish: Object.freeze({
      id: "fish",
      spriteFamily: "fish",
      movementSpeed: 54,
      health: 1,
      damage: 1,
      scoreEvent: "enemyAdvanced",
      budgetCost: 3,
      minimumDistance: 15000,
      maximumNearbyCount: 2,
      behaviour: "crossingFish",
      allowedTerrain: ["air", "gap"],
      spawnRules: ["clearArc", "notMandatoryLanding"]
    })
  });

  var ENEMY_FRAMES = Object.freeze({
    basicWalker: Object.freeze({
      enemy: [{ sx: 0, sy: 16, sw: 16, sh: 16 }, { sx: 16, sy: 16, sw: 16, sh: 16 }],
      enemyr: [{ sx: 0, sy: 16, sw: 16, sh: 16 }, { sx: 16, sy: 16, sw: 16, sh: 16 }],
      drawWidth: 16,
      drawHeight: 16,
      collisionWidth: 14,
      collisionHeight: 14
    }),
    fastWalker: Object.freeze({
      enemy: [{ sx: 0, sy: 48, sw: 16, sh: 16 }, { sx: 16, sy: 48, sw: 16, sh: 16 }],
      enemyr: [{ sx: 0, sy: 48, sw: 16, sh: 16 }, { sx: 16, sy: 48, sw: 16, sh: 16 }],
      drawWidth: 16,
      drawHeight: 16,
      collisionWidth: 14,
      collisionHeight: 14
    }),
    koopa: Object.freeze({
      enemy: [{ sx: 96, sy: 0, sw: 16, sh: 32 }, { sx: 112, sy: 0, sw: 16, sh: 32 }],
      enemyr: [{ sx: 128, sy: 0, sw: 16, sh: 32 }, { sx: 144, sy: 0, sw: 16, sh: 32 }],
      shell: [{ sx: 160, sy: 16, sw: 16, sh: 16 }, { sx: 176, sy: 16, sw: 16, sh: 16 }],
      drawWidth: 16,
      drawHeight: 32,
      collisionWidth: 14,
      collisionHeight: 24
    }),
    flowerPlant: Object.freeze({
      enemy: [{ sx: 224, sy: 8, sw: 16, sh: 24, mouth: "closed" }, { sx: 240, sy: 8, sw: 16, sh: 24, mouth: "open" }],
      enemyr: [{ sx: 224, sy: 8, sw: 16, sh: 24, mouth: "closed" }, { sx: 240, sy: 8, sw: 16, sh: 24, mouth: "open" }],
      upsideDown: [{ sx: 256, sy: 8, sw: 16, sh: 24, mouth: "open" }, { sx: 272, sy: 8, sw: 16, sh: 24, mouth: "closed" }],
      drawWidth: 16,
      drawHeight: 24,
      collisionWidth: 14,
      collisionHeight: 22
    }),
    spiny: Object.freeze({
      enemy: [{ sx: 512, sy: 16, sw: 16, sh: 16 }, { sx: 528, sy: 16, sw: 16, sh: 16 }],
      enemyr: [{ sx: 544, sy: 16, sw: 16, sh: 16 }, { sx: 560, sy: 16, sw: 16, sh: 16 }],
      drawWidth: 16,
      drawHeight: 16,
      collisionWidth: 14,
      collisionHeight: 14
    }),
    flying: Object.freeze({
      enemy: [{ sx: 656, sy: 0, sw: 32, sh: 32 }, { sx: 688, sy: 0, sw: 32, sh: 32 }],
      enemyr: [{ sx: 656, sy: 0, sw: 32, sh: 32 }, { sx: 688, sy: 0, sw: 32, sh: 32 }],
      drawWidth: 32,
      drawHeight: 32,
      collisionWidth: 24,
      collisionHeight: 22
    }),
    ranged: Object.freeze({
      enemy: [{ sx: 416, sy: 8, sw: 16, sh: 24 }, { sx: 432, sy: 8, sw: 16, sh: 24 }],
      enemyr: [{ sx: 416, sy: 8, sw: 16, sh: 24 }, { sx: 432, sy: 8, sw: 16, sh: 24 }],
      projectile: { sx: 784, sy: 0, sw: 16, sh: 16 },
      drawWidth: 16,
      drawHeight: 24,
      collisionWidth: 14,
      collisionHeight: 22
    }),
    fish: Object.freeze({
      enemy: [{ sx: 624, sy: 16, sw: 16, sh: 16 }, { sx: 640, sy: 16, sw: 16, sh: 16 }],
      enemyr: [{ sx: 624, sy: 16, sw: 16, sh: 16 }, { sx: 640, sy: 16, sw: 16, sh: 16 }],
      drawWidth: 16,
      drawHeight: 16,
      collisionWidth: 14,
      collisionHeight: 12
    })
  });

  var ENCOUNTER_TEMPLATES = Object.freeze([
    { id: "SINGLE_PATROL", minDistance: 0, maxDistance: Infinity, budgetCost: 1, requiredTerrain: "ground", slots: ["goomba"], safeEntryDistance: 96, safeExitDistance: 64 },
    { id: "DOUBLE_PATROL", minDistance: 700, maxDistance: Infinity, budgetCost: 2, requiredTerrain: "ground", slots: ["goomba", "goomba"], safeEntryDistance: 112, safeExitDistance: 64 },
    { id: "BASIC_PLUS_KOOPA", minDistance: 1400, maxDistance: Infinity, budgetCost: 3, requiredTerrain: "ground", slots: ["goomba", "koopa"], safeEntryDistance: 128, safeExitDistance: 80 },
    { id: "PIPE_PLANT", minDistance: 550, maxDistance: Infinity, budgetCost: 2, requiredTerrain: "pipe", slots: ["plant"], safeEntryDistance: 112, safeExitDistance: 96 },
    { id: "DOUBLE_PIPE_TIMING", minDistance: 4500, maxDistance: Infinity, budgetCost: 4, requiredTerrain: "pipe", slots: ["plant", "plant"], safeEntryDistance: 128, safeExitDistance: 96 },
    { id: "FAST_FOLLOWER", minDistance: 2800, maxDistance: Infinity, budgetCost: 3, requiredTerrain: "ground", slots: ["goomba", "fastWalker"], safeEntryDistance: 128, safeExitDistance: 80 },
    { id: "UPPER_ROUTE_GUARD", minDistance: 3200, maxDistance: Infinity, budgetCost: 3, requiredTerrain: "platform", slots: ["goomba", "fastWalker"], safeEntryDistance: 128, safeExitDistance: 80 },
    { id: "SHELL_CHAIN", minDistance: 3800, maxDistance: Infinity, budgetCost: 5, requiredTerrain: "ground", slots: ["koopa", "goomba", "goomba"], safeEntryDistance: 144, safeExitDistance: 96 },
    { id: "PLATFORM_PATROL", minDistance: 4000, maxDistance: Infinity, budgetCost: 2, requiredTerrain: "platform", slots: ["goomba"], safeEntryDistance: 112, safeExitDistance: 96 },
    { id: "VERTICAL_MIX", minDistance: 5500, maxDistance: Infinity, budgetCost: 4, requiredTerrain: "mixed", slots: ["goomba", "flying"], safeEntryDistance: 144, safeExitDistance: 96 },
    { id: "SPINY_PRESSURE", minDistance: 6200, maxDistance: Infinity, budgetCost: 3, requiredTerrain: "ground", slots: ["spiny"], safeEntryDistance: 128, safeExitDistance: 96 },
    { id: "RANGED_CROSSING", minDistance: 10000, maxDistance: Infinity, budgetCost: 4, requiredTerrain: "open", slots: ["ranged"], safeEntryDistance: 160, safeExitDistance: 128 },
    { id: "MIXED_GROUND_FORMATION", minDistance: 9000, maxDistance: Infinity, budgetCost: 7, requiredTerrain: "ground", slots: ["goomba", "fastWalker", "spiny"], safeEntryDistance: 160, safeExitDistance: 112 },
    { id: "FISH_CROSSING", minDistance: 15000, maxDistance: Infinity, budgetCost: 3, requiredTerrain: "gap", slots: ["fish"], safeEntryDistance: 144, safeExitDistance: 112 },
    { id: "THREE_ROLE_ENCOUNTER", minDistance: 14000, maxDistance: Infinity, budgetCost: 8, requiredTerrain: "mixed", slots: ["goomba", "plant", "flying"], safeEntryDistance: 176, safeExitDistance: 128 }
  ]);

  function typeFor(id) {
    return ENEMY_TYPES[id] || ENEMY_TYPES.goomba;
  }

  function frameForType(id) {
    return ENEMY_FRAMES[typeFor(id).spriteFamily] || ENEMY_FRAMES.basicWalker;
  }

  function createEnemy(id, type, x, surfaceTopY, options) {
    options = options || {};
    var def = typeFor(type);
    var frame = frameForType(type);
    var h = frame.collisionHeight;
    var enemy = {
      id: id,
      type: def.id,
      spriteFamily: def.spriteFamily,
      behaviour: def.behaviour,
      x: x,
      y: surfaceTopY - h,
      originX: x,
      originY: surfaceTopY - h,
      w: frame.collisionWidth,
      h: h,
      vx: options.vx !== undefined ? options.vx : -def.movementSpeed,
      vy: 0,
      direction: options.direction || -1,
      alive: true,
      state: options.state || "active",
      stateTime: options.stateTime || 0,
      patrolMinX: options.patrolMinX,
      patrolMaxX: options.patrolMaxX,
      pipeTopY: options.pipeTopY,
      hiddenY: options.hiddenY,
      exposedY: options.exposedY,
      cycleOffset: options.cycleOffset || 0,
      cooldown: options.cooldown || 0,
      fireCooldown: options.fireCooldown || 0,
      lastFiredAt: 0,
      phase: options.phase || 0,
      animationFrame: options.animationFrame || 0,
      encounterId: options.encounterId || null,
      role: options.role || "PATROL"
    };
    if (def.behaviour === "pipePlant") {
      enemy.vx = 0;
      enemy.vy = 0;
      enemy.pipeTopY = options.pipeTopY !== undefined ? options.pipeTopY : surfaceTopY;
      enemy.exposedY = options.exposedY !== undefined ? options.exposedY : enemy.pipeTopY - h;
      enemy.hiddenY = options.hiddenY !== undefined ? options.hiddenY : enemy.pipeTopY + 4;
      enemy.y = enemy.hiddenY;
      enemy.state = "hidden";
      enemy.cycleSpeed = options.cycleSpeed || 1;
    }
    if (def.behaviour === "aerialPatrol") {
      enemy.vy = 0;
      enemy.patrolMinX = options.patrolMinX !== undefined ? options.patrolMinX : x - 64;
      enemy.patrolMaxX = options.patrolMaxX !== undefined ? options.patrolMaxX : x + 96;
      enemy.baseY = enemy.y;
    }
    if (def.behaviour === "crossingFish") {
      enemy.vy = 0;
      enemy.patrolMinX = options.patrolMinX !== undefined ? options.patrolMinX : x - 64;
      enemy.patrolMaxX = options.patrolMaxX !== undefined ? options.patrolMaxX : x + 96;
      enemy.baseY = options.baseY !== undefined ? options.baseY : enemy.y;
      enemy.arcHeight = options.arcHeight || 22;
    }
    return enemy;
  }

  return Object.freeze({
    ENEMY_TYPES: ENEMY_TYPES,
    ENEMY_FRAMES: ENEMY_FRAMES,
    ENCOUNTER_TEMPLATES: ENCOUNTER_TEMPLATES,
    typeFor: typeFor,
    frameForType: frameForType,
    createEnemy: createEnemy
=======
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
>>>>>>> 23d77d90b7ad9e49b6022c8b03b23d9d657e62b0
  });
});
