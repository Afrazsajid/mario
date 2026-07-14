(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./constants"), require("./physics"), require("./enemyRegistry"));
  else root.PQDLevelData = factory(root.PQDConstants, root.PQDPhysics, root.PQDEnemyRegistry);
})(typeof globalThis !== "undefined" ? globalThis : this, function (constants, physics, enemyRegistry) {
  "use strict";

  var tile = constants.TILE_SIZE;

  var DIFFICULTY_STAGES = Object.freeze({
    easy: { enemySpeedMultiplier: 1, movingPlatformSpeed: 1, maxGapMultiplier: 1 },
    medium: { enemySpeedMultiplier: 1.12, movingPlatformSpeed: 1.08, maxGapMultiplier: 1.08 },
    hard: { enemySpeedMultiplier: 1.25, movingPlatformSpeed: 1.18, maxGapMultiplier: 1.15 },
    expert: { enemySpeedMultiplier: 1.38, movingPlatformSpeed: 1.28, maxGapMultiplier: 1.22 }
  });

  var LEVEL_SECTIONS = Object.freeze([
    { id: "intro", name: "Easy Introduction", startTile: 0, endTile: 70, difficulty: "easy" },
    { id: "movement", name: "Movement Challenge", startTile: 70, endTile: 150, difficulty: "medium" },
    { id: "enemy", name: "Enemy Challenge", startTile: 150, endTile: 235, difficulty: "medium" },
    { id: "vertical", name: "Vertical Challenge", startTile: 235, endTile: 310, difficulty: "hard" },
    { id: "advanced", name: "Advanced Challenge", startTile: 310, endTile: 390, difficulty: "hard" },
    { id: "final", name: "Final Area", startTile: 390, endTile: 450, difficulty: "expert" }
  ]);

  var ENDLESS_START_TILE = 450;
  var ENDLESS_SECTION_TILES = 40;
  var ENDLESS_SECTION_COUNT = 96;
  var ENDLESS_WORLD_END_TILE = ENDLESS_START_TILE + ENDLESS_SECTION_TILES * ENDLESS_SECTION_COUNT;
  var ENDLESS_FAMILIES = Object.freeze([
    "FLOW_RUN",
    "FLAT_COMBAT",
    "SMALL_GAPS",
    "RISING_STAIRS",
    "PLATFORM_SEQUENCE",
    "SPLIT_ROUTE",
    "PIPE_SECTION",
    "RECOVERY_SECTION"
  ]);

  function rect(x, y, w, h, id, type) {
    return { id: id || ("solid-" + x + "-" + y), x: x, y: y, w: w, h: h, type: type || "solid" };
  }

  function tileRect(tx, ty, tw, th, id, type) {
    return rect(tx * tile, ty * tile, tw * tile, th * tile, id, type);
  }

  function coin(id, tx, ty) {
    return { id: id, x: tx * tile + 4, y: ty * tile + 4, w: 8, h: 8, collectedBy: null };
  }

  function enemy(id, tx, ty, type, speedMultiplier) {
    var surfaceTopY = (ty + 1) * tile;
    var def = enemyRegistry.typeFor(type);
    return enemyRegistry.createEnemy(id, def.id, tx * tile, surfaceTopY, {
      vx: -def.movementSpeed * speedMultiplier
    });
  }

  function enemyOnSurface(id, tx, surfaceTopTile, type, speedMultiplier) {
    var def = enemyRegistry.typeFor(type);
    return enemyRegistry.createEnemy(id, def.id, tx * tile, surfaceTopTile * tile, {
      vx: -def.movementSpeed * speedMultiplier
    });
  }

  function addGround(solids, spans) {
    spans.forEach(function (span, index) {
      solids.push(tileRect(span[0], 13, span[1] - span[0], 2, "ground-" + index, "ground"));
    });
  }

  function addBlocks(solids, blocks, prefix) {
    blocks.forEach(function (b, index) {
      solids.push(tileRect(b[0], b[1], b[2] || 1, b[3] || 1, prefix + "-" + index, b[4] || "block"));
    });
  }

  function addPipe(solids, tx, topTile, heightTiles, id) {
    solids.push(tileRect(tx, topTile, 2, heightTiles, id, "pipe"));
  }

  function addStair(solids, startTile, baseTile, steps, direction, prefix) {
    for (var i = 0; i < steps; i += 1) {
      var height = i + 1;
      var x = startTile + i * direction;
      var y = baseTile - height + 1;
      solids.push(tileRect(x, y, 1, height, prefix + "-step-" + i, "brick"));
    }
  }

  function addCoinArc(coins, id, startTile, startY, count, riseEvery) {
    for (var i = 0; i < count; i += 1) coins.push(coin(id + "-" + i, startTile + i, startY - Math.floor(i / riseEvery)));
  }

  function addLineCoins(coins, id, startTile, tileY, count) {
    for (var i = 0; i < count; i += 1) coins.push(coin(id + "-" + i, startTile + i, tileY));
  }

  function checkpoint(id, tx, ty, sectionId) {
    return {
      id: id,
      sectionId: sectionId,
      x: tx * tile,
      y: ty * tile,
      w: 14,
      h: 32,
      spawnX: tx * tile + 8,
      spawnY: 12 * tile,
      activated: false,
      activatedBy: null
    };
  }

  function movingPlatform(id, tx, ty, tw, pathTiles, speed, difficulty) {
    return {
      id: id,
      x: tx * tile,
      y: ty * tile,
      baseX: tx * tile,
      baseY: ty * tile,
      w: tw * tile,
      h: 8,
      minX: tx * tile,
      maxX: (tx + pathTiles) * tile,
      vx: speed * DIFFICULTY_STAGES[difficulty].movingPlatformSpeed,
      vy: 0,
      type: "movingPlatform"
    };
  }

  function buildStaticSolids() {
    var solids = [];
    addGround(solids, [[0, 69], [72, 118], [122, 181], [181, 235], [238, 300], [304, 360], [364, 450]]);

    addBlocks(solids, [
      [16, 9], [20, 9], [21, 9], [22, 9], [22, 5], [23, 9], [24, 9],
      [77, 9], [78, 9], [79, 9], [80, 5], [81, 5], [82, 5], [83, 5], [84, 5], [85, 5], [86, 5], [87, 5],
      [100, 9], [101, 9], [105, 9], [108, 5], [108, 9], [111, 9],
      [120, 7, 4, 1], [128, 6, 3, 1], [136, 8, 4, 1],
      [168, 9], [169, 9], [170, 9], [171, 9],
      [246, 10, 4, 1], [258, 8, 4, 1], [270, 6, 4, 1], [282, 8, 4, 1],
      [318, 9, 3, 1], [330, 7, 3, 1], [344, 8, 3, 1], [374, 9, 4, 1], [382, 7, 3, 1],
      [404, 9, 4, 1], [414, 8, 4, 1], [424, 7, 3, 1]
    ], "block");

    addPipe(solids, 28, 11, 2, "pipe-28");
    addPipe(solids, 38, 10, 3, "pipe-38");
    addPipe(solids, 46, 9, 4, "pipe-46");
    addPipe(solids, 57, 9, 4, "pipe-57");
    addPipe(solids, 163, 11, 2, "pipe-163");
    addPipe(solids, 214, 10, 3, "pipe-214");
    addPipe(solids, 295, 10, 3, "pipe-295");
    addPipe(solids, 352, 11, 2, "pipe-352");
    addPipe(solids, 398, 10, 3, "pipe-398");

    // This replaces the former tall vertical brick blockage around tile 181-189.
    // The one-tile-rise steps are readable, climbable by small/super/fire forms, and passable from both sides.
    addStair(solids, 181, 12, 6, 1, "fixed-route-up");
    addStair(solids, 193, 12, 6, -1, "fixed-route-down");
    addBlocks(solids, [[188, 6, 2, 1], [190, 6, 2, 1]], "fixed-route-bonus");

    addStair(solids, 232, 12, 4, 1, "vertical-entry");
    addStair(solids, 306, 12, 4, -1, "vertical-exit");
    addStair(solids, 390, 12, 5, 1, "final-entry");
    addStair(solids, 438, 12, 5, -1, "final-exit");

    solids.push(tileRect(434, 3, 1, 10, "flagpole", "flagpole"));
    return solids;
  }

  function buildCoins() {
    var coins = [];
    addCoinArc(coins, "intro-low", 5, 9, 7, 4);
    addCoinArc(coins, "intro-high", 16, 8, 9, 3);
    addCoinArc(coins, "movement-guide-a", 76, 8, 10, 3);
    addCoinArc(coins, "movement-guide-b", 118, 7, 12, 3);
    addCoinArc(coins, "enemy-guide", 166, 8, 12, 3);
    addCoinArc(coins, "fixed-wall-guide", 181, 8, 14, 2);
    addCoinArc(coins, "vertical-upper", 246, 7, 13, 3);
    addCoinArc(coins, "vertical-bonus", 270, 4, 14, 2);
    addCoinArc(coins, "advanced-guide", 318, 7, 18, 3);
    addCoinArc(coins, "final-guide", 404, 7, 20, 4);
    return coins;
  }

  function buildEnemies() {
    var enemies = [];
    function stageAt(tx) {
      var section = LEVEL_SECTIONS.filter(function (item) { return tx >= item.startTile && tx < item.endTile; }).pop() || LEVEL_SECTIONS[0];
      return DIFFICULTY_STAGES[section.difficulty];
    }
    [
      [22, 12, "goomba"], [40, 12, "goomba"], [50, 12, "goomba"], [82, 4, "goomba"],
      [100, 12, "goomba"], [114, 12, "goomba"], [126, 12, "goomba"], [154, 12, "goomba"],
      [170, 12, "goomba"], [176, 12, "koopa"], [206, 12, "goomba"], [218, 9, "koopa"],
      [252, 9, "goomba"], [276, 5, "goomba"], [286, 12, "koopa"], [322, 12, "goomba"],
      [338, 6, "goomba"], [350, 12, "koopa"], [372, 12, "goomba"], [384, 12, "goomba"],
      [406, 12, "koopa"], [418, 7, "goomba"], [426, 12, "goomba"], [428, 12, "goomba"]
    ].forEach(function (e, index) {
      enemies.push(enemyOnSurface("enemy-" + index, e[0], e[1] + 1, e[2], stageAt(e[0]).enemySpeedMultiplier));
    });
    return enemies;
  }

  function buildPowerUps() {
    return [
      { id: "power-0", type: "mushroom", x: 21 * tile, y: 8 * tile, w: 14, h: 14, collectedBy: null },
      { id: "power-1", type: "fireFlower", x: 78 * tile, y: 8 * tile, w: 14, h: 14, collectedBy: null },
      { id: "power-2", type: "star", x: 100 * tile, y: 8 * tile, w: 14, h: 14, collectedBy: null },
      { id: "power-3", type: "mushroom", x: 188 * tile, y: 5 * tile, w: 14, h: 14, collectedBy: null },
      { id: "power-4", type: "fireFlower", x: 282 * tile, y: 7 * tile, w: 14, h: 14, collectedBy: null },
      { id: "power-5", type: "star", x: 414 * tile, y: 7 * tile, w: 14, h: 14, collectedBy: null }
    ];
  }

  function endlessDifficulty(index) {
    if (index < 16) return "medium";
    if (index < 44) return "hard";
    return "expert";
  }

  function addPowerUp(powerUps, id, type, tx, ty) {
    powerUps.push({ id: id, type: type, x: tx * tile, y: ty * tile, w: 14, h: 14, collectedBy: null });
  }

  function addEndlessEnemy(enemies, id, tx, surfaceTopTile, type, difficulty, options) {
    var def = enemyRegistry.typeFor(type);
    var enemyItem = enemyRegistry.createEnemy(id, def.id, tx * tile, surfaceTopTile * tile, Object.assign({
      vx: -def.movementSpeed * DIFFICULTY_STAGES[difficulty].enemySpeedMultiplier
    }, options || {}));
    enemies.push(enemyItem);
    return enemyItem;
  }

  function addPlantEnemy(enemies, id, tx, pipeTopTile, difficulty, cycleOffset) {
    return addEndlessEnemy(enemies, id, tx, pipeTopTile, "plant", difficulty, {
      pipeTopY: pipeTopTile * tile,
      hiddenY: pipeTopTile * tile + 3,
      exposedY: pipeTopTile * tile - enemyRegistry.frameForType("plant").collisionHeight,
      cycleOffset: cycleOffset || 0,
      role: "PIPE_GUARD"
    });
  }

  function addFlyingEnemy(enemies, id, tx, ty, difficulty, patrolTiles) {
    patrolTiles = patrolTiles || 8;
    return addEndlessEnemy(enemies, id, tx, ty, "flying", difficulty, {
      patrolMinX: (tx - 3) * tile,
      patrolMaxX: (tx + patrolTiles) * tile,
      role: "VERTICAL_PRESSURE"
    });
  }

  function addRangedEnemy(enemies, id, tx, surfaceTopTile, difficulty) {
    return addEndlessEnemy(enemies, id, tx, surfaceTopTile, "ranged", difficulty, {
      direction: -1,
      role: "RANGED_PRESSURE",
      fireCooldown: 0.8
    });
  }

  function distanceAtTile(tx) {
    return tx * tile;
  }

  function encounterBudget(distance, activePlayers) {
    var base = distance < 2000 ? 2 : distance < 5000 ? 4 : distance < 10000 ? 6 : distance < 20000 ? 8 : 9;
    if (activePlayers > 1) base = Math.floor(base * 1.3);
    return base;
  }

  function addEndlessCheckpoint(checkpoints, id, tx) {
    checkpoints.push(checkpoint(id, tx, 11, id));
  }

  function addEndlessSection(parts, index) {
    var start = ENDLESS_START_TILE + index * ENDLESS_SECTION_TILES;
    var end = start + ENDLESS_SECTION_TILES;
    var family = ENDLESS_FAMILIES[index % ENDLESS_FAMILIES.length];
    var difficulty = endlessDifficulty(index);
    var distance = distanceAtTile(start);
    var budget = encounterBudget(distance, 1);
    var id = "endless-" + index + "-" + family.toLowerCase();
    var enemyPrefix = "endless-enemy-" + index + "-";
    var variant = Math.floor(index / ENDLESS_FAMILIES.length) % 4;
    parts.sections.push({
      id: id,
      name: family.replace(/_/g, " "),
      startX: start * tile,
      endX: end * tile,
      difficulty: difficulty,
      family: family,
      variant: variant,
      enemyBudget: budget
    });

    if (family === "FLOW_RUN") {
      addGround(parts.solids, [[start, end]]);
      addCoinArc(parts.coins, id + "-rhythm", start + 5, 9, 16, 4);
      addEndlessEnemy(parts.enemies, enemyPrefix + "0", start + 18 + variant, 13, "goomba", difficulty);
      if (distance > 2000) addEndlessEnemy(parts.enemies, enemyPrefix + "1", start + 30, 13, variant % 2 ? "fastWalker" : "goomba", difficulty, { role: "PATROL" });
      if (distance > 12000 && variant === 2) addFlyingEnemy(parts.enemies, enemyPrefix + "2", start + 26, 8, difficulty, 7);
      return;
    }

    if (family === "FLAT_COMBAT") {
      addGround(parts.solids, [[start, end]]);
      addBlocks(parts.solids, [[start + 9, 9, 3, 1], [start + 24, 8, 4, 1]], id + "-block");
      addLineCoins(parts.coins, id + "-coins", start + 10, 7, 5);
      addEndlessEnemy(parts.enemies, enemyPrefix + "0", start + 14, 13, "goomba", difficulty);
      addEndlessEnemy(parts.enemies, enemyPrefix + "1", start + 25, 13, distance > 2000 ? "koopa" : "goomba", difficulty, { role: "SHELL_OPPORTUNITY" });
      if (distance > 5000) addEndlessEnemy(parts.enemies, enemyPrefix + "2", start + 33, 13, variant % 2 ? "spiny" : "fastWalker", difficulty, { role: "LANDING_PRESSURE" });
      if (distance > 10000 && variant === 1) addRangedEnemy(parts.enemies, enemyPrefix + "3", start + 36, 13, difficulty);
      return;
    }

    if (family === "SMALL_GAPS") {
      addGround(parts.solids, [[start, start + 11], [start + 14, start + 26], [start + 29, end]]);
      addCoinArc(parts.coins, id + "-gap-a", start + 7, 8, 9, 3);
      addCoinArc(parts.coins, id + "-gap-b", start + 23, 8, 8, 3);
      addEndlessEnemy(parts.enemies, enemyPrefix + "0", start + 33, 13, "goomba", difficulty);
      if (distance > 5000) addFlyingEnemy(parts.enemies, enemyPrefix + "1", start + 20, 9, difficulty, 6);
      if (distance > 12000 && variant === 3) addEndlessEnemy(parts.enemies, enemyPrefix + "2", start + 20, 13, "spiny", difficulty, { role: "LANDING_PRESSURE" });
      return;
    }

    if (family === "RISING_STAIRS") {
      addGround(parts.solids, [[start, end]]);
      addStair(parts.solids, start + 8, 12, 5, 1, id + "-up");
      addBlocks(parts.solids, [[start + 18, 7, 5, 1]], id + "-upper");
      addStair(parts.solids, start + 30, 12, 5, -1, id + "-down");
      addLineCoins(parts.coins, id + "-upper-coins", start + 18, 5, 5);
      addEndlessEnemy(parts.enemies, enemyPrefix + "0", start + 25, 13, variant % 2 ? "koopa" : "goomba", difficulty, { role: "SHELL_OPPORTUNITY" });
      if (distance > 5000) addEndlessEnemy(parts.enemies, enemyPrefix + "1", start + 19, 7, variant % 2 ? "fastWalker" : "spiny", difficulty, { role: "UPPER_ROUTE_GUARD" });
      return;
    }

    if (family === "PLATFORM_SEQUENCE") {
      addGround(parts.solids, [[start, start + 9], [start + 15, start + 25], [start + 31, end]]);
      addBlocks(parts.solids, [[start + 10, 10, 3, 1], [start + 20, 8, 3, 1], [start + 28, 10, 3, 1]], id + "-platform");
      addCoinArc(parts.coins, id + "-platform-coins", start + 10, 8, 17, 4);
      addEndlessEnemy(parts.enemies, enemyPrefix + "0", start + 22, 8, "goomba", difficulty);
      if (distance > 5000) addFlyingEnemy(parts.enemies, enemyPrefix + "1", start + 28, 8, difficulty, 6);
      if (distance > 9000) addEndlessEnemy(parts.enemies, enemyPrefix + "2", start + 34, 13, "koopa", difficulty, { role: "SHELL_OPPORTUNITY" });
      return;
    }

    if (family === "SPLIT_ROUTE") {
      addGround(parts.solids, [[start, end]]);
      addBlocks(parts.solids, [[start + 8, 9, 5, 1], [start + 16, 7, 5, 1], [start + 24, 9, 5, 1]], id + "-split");
      addLineCoins(parts.coins, id + "-safe", start + 4, 10, 8);
      addLineCoins(parts.coins, id + "-upper", start + 16, 5, 8);
      addEndlessEnemy(parts.enemies, enemyPrefix + "0", start + 18, 7, "goomba", difficulty);
      addEndlessEnemy(parts.enemies, enemyPrefix + "1", start + 31, 13, distance > 2400 ? "koopa" : "goomba", difficulty, { role: "PATROL" });
      if (distance > 6000) addEndlessEnemy(parts.enemies, enemyPrefix + "2", start + 25, 9, variant % 2 ? "fastWalker" : "spiny", difficulty, { role: "UPPER_ROUTE_GUARD" });
      return;
    }

    if (family === "PIPE_SECTION") {
      addGround(parts.solids, [[start, end]]);
      addPipe(parts.solids, start + 10, 11, 2, id + "-pipe-a");
      addPipe(parts.solids, start + 24, 10, 3, id + "-pipe-b");
      addCoinArc(parts.coins, id + "-pipe-coins", start + 4, 8, 10, 3);
      addEndlessEnemy(parts.enemies, enemyPrefix + "0", start + 17, 13, "goomba", difficulty);
      if (distance > 2200) addPlantEnemy(parts.enemies, enemyPrefix + "1", start + 10, 11, difficulty, variant * 0.45);
      if (distance > 4500) addPlantEnemy(parts.enemies, enemyPrefix + "2", start + 24, 10, difficulty, 1.4 + variant * 0.25);
      if (distance > 10000) addRangedEnemy(parts.enemies, enemyPrefix + "3", start + 33, 13, difficulty);
      return;
    }

    addGround(parts.solids, [[start, end]]);
    addLineCoins(parts.coins, id + "-recovery", start + 8, 9, 12);
    if (index % 16 === 7) addPowerUp(parts.powerUps, "endless-power-" + index, index % 32 === 7 ? "mushroom" : "fireFlower", start + 20, 8);
  }

  function addEndlessContent(parts) {
    for (var i = 0; i < ENDLESS_SECTION_COUNT; i += 1) {
      addEndlessSection(parts, i);
      if (i > 0 && i % 8 === 0) addEndlessCheckpoint(parts.checkpoints, "checkpoint-endless-" + i, ENDLESS_START_TILE + i * ENDLESS_SECTION_TILES + 4);
      if (i % 24 === 14) {
        var tx = ENDLESS_START_TILE + i * ENDLESS_SECTION_TILES + 12;
        parts.movingPlatforms.push(movingPlatform("endless-moving-" + i, tx, 9, 4, 8, 28 + Math.min(10, Math.floor(i / 24) * 4), endlessDifficulty(i)));
      }
    }
  }

  function syncSolids(world) {
    world.solids = world.staticSolids.concat(world.movingPlatforms.map(function (platform) {
      return rect(platform.x, platform.y, platform.w, platform.h, platform.id, "movingPlatform");
    }));
    return world.solids;
  }

  function createWorld() {
    var staticSolids = buildStaticSolids();
    var movingPlatforms = [
      movingPlatform("moving-0", 132, 10, 3, 7, 32, "medium"),
      movingPlatform("moving-1", 240, 9, 4, 6, 30, "hard"),
      movingPlatform("moving-2", 366, 8, 3, 8, 38, "hard"),
      movingPlatform("moving-3", 410, 6, 3, 6, 42, "expert")
    ];
    var sections = LEVEL_SECTIONS.map(function (section) {
      return {
        id: section.id,
        name: section.name,
        startX: section.startTile * tile,
        endX: section.endTile * tile,
        difficulty: section.difficulty,
        family: "STORY",
        variant: 0
      };
    });
    var checkpoints = [
      checkpoint("checkpoint-intro", 70, 11, "movement"),
      checkpoint("checkpoint-vertical", 235, 11, "vertical"),
      checkpoint("checkpoint-advanced", 310, 11, "advanced"),
      checkpoint("checkpoint-final", 390, 11, "final")
    ];
    var coins = buildCoins();
    var powerUps = buildPowerUps();
    var enemies = buildEnemies();
    addEndlessContent({
      solids: staticSolids,
      movingPlatforms: movingPlatforms,
      sections: sections,
      checkpoints: checkpoints,
      coins: coins,
      powerUps: powerUps,
      enemies: enemies
    });
    var world = {
      id: "level-1-endless",
      title: "Skyline Sprint Endless",
      theme: "aboveground",
      endless: true,
      width: ENDLESS_WORLD_END_TILE * tile,
      height: constants.LEVEL_HEIGHT,
      spawnPoints: [{ x: 56, y: 192 }, { x: 76, y: 192 }],
      finishX: ENDLESS_WORLD_END_TILE * tile + tile,
      exitX: ENDLESS_WORLD_END_TILE * tile + tile * 2,
      sections: sections,
      difficultyStages: DIFFICULTY_STAGES,
      staticSolids: staticSolids,
      solids: [],
      movingPlatforms: movingPlatforms,
      checkpoints: checkpoints,
      coins: coins,
      powerUps: powerUps,
      enemies: enemies,
      enemyProjectiles: []
    };
    syncSolids(world);
    return world;
  }

  function jumpCapabilities() {
    return {
      walkJumpDistance: 112,
      runJumpDistance: 160,
      maxJumpHeight: 72,
      superPlayerHeight: constants.PLAYER_SUPER_HEIGHT,
      safeLandingWidth: 32,
      movingPlatformSpeed: 56
    };
  }

  function pointInsideAny(rects, box) {
    return rects.some(function (solid) { return physics && physics.overlaps ? physics.overlaps(box, solid) : false; });
  }

  function validateLevel(world) {
    world = world || createWorld();
    var issues = [];
    var caps = jumpCapabilities();
    var allSolids = world.solids || syncSolids(world);

    world.spawnPoints.forEach(function (spawn, index) {
      var small = { x: spawn.x, y: spawn.y, w: constants.PLAYER_WIDTH, h: constants.PLAYER_SMALL_HEIGHT };
      var superBox = { x: spawn.x, y: spawn.y - (constants.PLAYER_SUPER_HEIGHT - constants.PLAYER_SMALL_HEIGHT), w: constants.PLAYER_WIDTH, h: constants.PLAYER_SUPER_HEIGHT };
      if (pointInsideAny(allSolids, small) || pointInsideAny(allSolids, superBox)) issues.push("Spawn " + index + " intersects solid geometry.");
    });

    for (var i = 1; i < world.checkpoints.length; i += 1) {
      if (world.checkpoints[i].x <= world.checkpoints[i - 1].x) issues.push("Checkpoint order is not increasing at " + world.checkpoints[i].id + ".");
    }

    var groundTops = allSolids.filter(function (solid) {
      return solid.type === "ground";
    }).map(function (solid) {
      return { id: solid.id, x: solid.x, y: solid.y, w: solid.w };
    }).sort(function (a, b) { return a.x - b.x; });

    for (i = 1; i < groundTops.length; i += 1) {
      var previous = groundTops[i - 1];
      var current = groundTops[i];
      var gap = current.x - (previous.x + previous.w);
      var rise = previous.y - current.y;
      if (gap > caps.runJumpDistance && current.y <= 208 && previous.y <= 208) {
        issues.push("Potential unreachable gap between " + previous.id + " and " + current.id + " (" + gap + "px).");
      }
      if (gap < constants.PLAYER_WIDTH && gap > 0 && rise > constants.PLAYER_SUPER_HEIGHT) {
        issues.push("Possible trap-width corridor between " + previous.id + " and " + current.id + ".");
      }
    }

    world.checkpoints.forEach(function (cp) {
      var hasLanding = groundTops.some(function (solid) {
        return cp.spawnX >= solid.x - caps.safeLandingWidth && cp.spawnX <= solid.x + solid.w + caps.safeLandingWidth && solid.y >= cp.spawnY + constants.PLAYER_SMALL_HEIGHT - 16;
      });
      if (!hasLanding) issues.push("Checkpoint " + cp.id + " has no nearby landing.");
    });

    if (!world.endless && world.finishX > world.width) issues.push("Finish is outside level width.");
    if (world.sections[world.sections.length - 1].endX !== world.width) issues.push("Final section does not match level width.");
    if (world.endless && world.finishX <= world.width) issues.push("Endless finish marker should remain beyond the generated buffer.");
    world.enemies.forEach(function (enemyItem) {
      var nearSpawn = world.spawnPoints.some(function (spawn) {
        return Math.abs(enemyItem.x - spawn.x) < caps.safeLandingWidth * 3;
      });
      if (nearSpawn) issues.push("Enemy " + enemyItem.id + " is too close to spawn.");
      var insideSolid = enemyItem.behaviour === "pipePlant" ? false : allSolids.some(function (solid) { return physics && physics.overlaps ? physics.overlaps(enemyItem, solid) : false; });
      if (insideSolid) issues.push("Enemy " + enemyItem.id + " intersects solid geometry.");
    });
    world.movingPlatforms.forEach(function (platform) {
      if (platform.w < caps.safeLandingWidth) issues.push("Moving platform " + platform.id + " is narrower than safe landing width.");
      if (Math.abs(platform.vx) > caps.movingPlatformSpeed) issues.push("Moving platform " + platform.id + " exceeds tested platform speed.");
    });

    return {
      ok: issues.length === 0,
      issues: issues,
      capabilities: caps,
      sections: world.sections.map(function (section) { return section.id; }),
      checkpointIds: world.checkpoints.map(function (cp) { return cp.id; })
    };
  }

  return Object.freeze({
    createWorld: createWorld,
    validateLevel: validateLevel,
    syncSolids: syncSolids,
    jumpCapabilities: jumpCapabilities,
    LEVEL_SECTIONS: LEVEL_SECTIONS,
    DIFFICULTY_STAGES: DIFFICULTY_STAGES,
    ENDLESS_FAMILIES: ENDLESS_FAMILIES
  });
});
