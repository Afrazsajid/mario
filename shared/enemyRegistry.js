(function (root, factory) {
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
      spriteFamily: "plant",
      movementSpeed: 28,
      health: 1,
      damage: 1,
      scoreEvent: "enemyAdvanced",
      budgetCost: 2,
      minimumDistance: 2200,
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
    plant: Object.freeze({
      enemy: [{ sx: 128, sy: 8, sw: 16, sh: 24 }, { sx: 144, sy: 8, sw: 16, sh: 24 }],
      enemyr: [{ sx: 80, sy: 8, sw: 16, sh: 24 }, { sx: 96, sy: 8, sw: 16, sh: 24 }],
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
    })
  });

  var ENCOUNTER_TEMPLATES = Object.freeze([
    { id: "SINGLE_PATROL", minDistance: 0, maxDistance: Infinity, budgetCost: 1, requiredTerrain: "ground", slots: ["goomba"], safeEntryDistance: 96, safeExitDistance: 64 },
    { id: "DOUBLE_PATROL", minDistance: 700, maxDistance: Infinity, budgetCost: 2, requiredTerrain: "ground", slots: ["goomba", "goomba"], safeEntryDistance: 112, safeExitDistance: 64 },
    { id: "BASIC_PLUS_KOOPA", minDistance: 1400, maxDistance: Infinity, budgetCost: 3, requiredTerrain: "ground", slots: ["goomba", "koopa"], safeEntryDistance: 128, safeExitDistance: 80 },
    { id: "PIPE_PLANT", minDistance: 2200, maxDistance: Infinity, budgetCost: 2, requiredTerrain: "pipe", slots: ["plant"], safeEntryDistance: 112, safeExitDistance: 96 },
    { id: "DOUBLE_PIPE_TIMING", minDistance: 4500, maxDistance: Infinity, budgetCost: 4, requiredTerrain: "pipe", slots: ["plant", "plant"], safeEntryDistance: 128, safeExitDistance: 96 },
    { id: "FAST_FOLLOWER", minDistance: 2800, maxDistance: Infinity, budgetCost: 3, requiredTerrain: "ground", slots: ["goomba", "fastWalker"], safeEntryDistance: 128, safeExitDistance: 80 },
    { id: "UPPER_ROUTE_GUARD", minDistance: 3200, maxDistance: Infinity, budgetCost: 3, requiredTerrain: "platform", slots: ["goomba", "fastWalker"], safeEntryDistance: 128, safeExitDistance: 80 },
    { id: "SHELL_CHAIN", minDistance: 3800, maxDistance: Infinity, budgetCost: 5, requiredTerrain: "ground", slots: ["koopa", "goomba", "goomba"], safeEntryDistance: 144, safeExitDistance: 96 },
    { id: "PLATFORM_PATROL", minDistance: 4000, maxDistance: Infinity, budgetCost: 2, requiredTerrain: "platform", slots: ["goomba"], safeEntryDistance: 112, safeExitDistance: 96 },
    { id: "VERTICAL_MIX", minDistance: 5500, maxDistance: Infinity, budgetCost: 4, requiredTerrain: "mixed", slots: ["goomba", "flying"], safeEntryDistance: 144, safeExitDistance: 96 },
    { id: "SPINY_PRESSURE", minDistance: 6200, maxDistance: Infinity, budgetCost: 3, requiredTerrain: "ground", slots: ["spiny"], safeEntryDistance: 128, safeExitDistance: 96 },
    { id: "RANGED_CROSSING", minDistance: 10000, maxDistance: Infinity, budgetCost: 4, requiredTerrain: "open", slots: ["ranged"], safeEntryDistance: 160, safeExitDistance: 128 },
    { id: "MIXED_GROUND_FORMATION", minDistance: 9000, maxDistance: Infinity, budgetCost: 7, requiredTerrain: "ground", slots: ["goomba", "fastWalker", "spiny"], safeEntryDistance: 160, safeExitDistance: 112 },
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
    }
    if (def.behaviour === "aerialPatrol") {
      enemy.vy = 0;
      enemy.patrolMinX = options.patrolMinX !== undefined ? options.patrolMinX : x - 64;
      enemy.patrolMaxX = options.patrolMaxX !== undefined ? options.patrolMaxX : x + 96;
      enemy.baseY = enemy.y;
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
  });
});
