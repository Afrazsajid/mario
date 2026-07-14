(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./constants"), require("./enemyRegistry"));
  else root.PQDEndlessDirector = factory(root.PQDConstants, root.PQDEnemyRegistry);
})(typeof globalThis !== "undefined" ? globalThis : this, function (constants, enemyRegistry) {
  "use strict";

  var tile = constants.TILE_SIZE;
  var DEBUG_GAME_DIRECTOR = false;

  var PLAYER_CAPABILITIES = Object.freeze({
    maxJumpHeight: 78,
    comfortableJumpHeight: 62,
    maxWalkJumpDistance: 128,
    comfortableWalkJumpDistance: 96,
    maxRunJumpDistance: 176,
    comfortableRunJumpDistance: 144,
    minimumLandingWidth: 32,
    maximumPlayerHeight: constants.PLAYER_SUPER_HEIGHT,
    maximumSafeVerticalTransition: 64,
    coyoteTimeSeconds: 0.1,
    jumpBufferSeconds: 0.12
  });

  var PACING = Object.freeze(["build", "challenge", "escalate", "peak", "reward"]);
  var FAMILIES = Object.freeze([
    "FLOW_RUN",
    "FLAT_COMBAT",
    "SMALL_GAPS",
    "RISING_STAIRS",
    "DESCENDING_STAIRS",
    "PLATFORM_SEQUENCE",
    "VERTICAL_CLIMB",
    "SPLIT_ROUTE",
    "MOVING_PLATFORM_ROUTE",
    "PIPE_SECTION",
    "RISK_REWARD_ROUTE",
    "SPEED_SECTION",
    "ENEMY_GAUNTLET",
    "RECOVERY_SECTION",
    "CHECKPOINT_SECTION",
    "MILESTONE_ARENA"
  ]);

  function hashSeed(seed) {
    var text = String(seed || "pixel-quest-duo");
    var h = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function createRng(seed) {
    var state = hashSeed(seed);
    return {
      next: function () {
        state += 0x6D2B79F5;
        var t = state;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      },
      int: function (min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
      },
      pick: function (items) {
        return items[Math.floor(this.next() * items.length)];
      }
    };
  }

  function makeVariant(family, index) {
    var lengthTiles = 18 + index % 5 * 3 + (family === "MILESTONE_ARENA" ? 14 : 0);
    var safeStartTiles = family === "ENEMY_GAUNTLET" ? 5 : 7;
    var safeEndTiles = family === "SPEED_SECTION" ? 5 : 7;
    var difficultyBias = Math.floor(index / 3);
    return Object.freeze({
      id: family.toLowerCase() + "-" + String(index + 1).padStart(2, "0"),
      family: family,
      lengthTiles: lengthTiles,
      safeStartTiles: safeStartTiles,
      safeEndTiles: safeEndTiles,
      difficultyBias: difficultyBias,
      maxGapTiles: family === "SMALL_GAPS" || family === "PLATFORM_SEQUENCE" ? 3 + index % 2 : 1,
      elevationTiles: family === "VERTICAL_CLIMB" ? 4 + index % 3 : family === "RISING_STAIRS" || family === "DESCENDING_STAIRS" ? 3 + index % 3 : 0,
      optionalRoute: family === "SPLIT_ROUTE" || family === "RISK_REWARD_ROUTE" || index % 6 === 0,
      movingPlatforms: family === "MOVING_PLATFORM_ROUTE" ? 1 + index % 2 : 0,
      checkpoint: family === "CHECKPOINT_SECTION",
      milestone: family === "MILESTONE_ARENA"
    });
  }

  var TRAVERSAL_VARIANTS = Object.freeze(FAMILIES.reduce(function (out, family) {
    var count = family === "MILESTONE_ARENA" ? 4 : 4;
    for (var i = 0; i < count; i += 1) out.push(makeVariant(family, i));
    return out;
  }, []));

  function encounter(id, min, max, budget, roles, enemyTypes) {
    return Object.freeze({
      id: id,
      minimumDifficulty: min,
      maximumDifficulty: max,
      requiredGeometry: "grounded-main-route",
      enemyBudgetCost: budget,
      roles: roles,
      enemyTypes: enemyTypes,
      safeEntryDistance: 64 + budget * 4,
      safeExitDistance: 40,
      rewardMultiplier: 1 + Math.min(0.75, budget * 0.05)
    });
  }

  var ENCOUNTER_TEMPLATES = Object.freeze([
    encounter("single_patrol", 1, 10, 1, ["patrol"], ["basicWalker"]),
    encounter("double_patrol", 1, 10, 2, ["patrol"], ["basicWalker", "basicWalker"]),
    encounter("opposing_walkers", 2, 10, 3, ["pressure"], ["basicWalker", "basicWalker"]),
    encounter("staggered_pressure", 2, 10, 4, ["pressure"], ["basicWalker", "fastWalker"]),
    encounter("upper_route_guard", 2, 10, 3, ["route_guard"], ["koopa"]),
    encounter("reward_guard", 2, 10, 3, ["reward_guard"], ["koopa"]),
    encounter("koopa_setup", 2, 10, 3, ["reward_guard"], ["koopa"]),
    encounter("platform_guard", 3, 10, 3, ["landing_threat"], ["basicWalker"]),
    encounter("vertical_pressure_low", 3, 10, 4, ["vertical_pressure"], ["koopa"]),
    encounter("pipe_patrol", 3, 10, 4, ["reward_guard"], ["plant"]),
    encounter("fast_pair", 3, 10, 4, ["pressure"], ["fastWalker", "fastWalker"]),
    encounter("mixed_intro", 3, 10, 5, ["pressure", "reward_guard"], ["basicWalker", "koopa"]),
    encounter("spiny_route_guard", 4, 10, 4, ["route_guard"], ["spiny"]),
    encounter("spiny_and_walker", 4, 10, 5, ["route_guard", "pressure"], ["spiny", "basicWalker"]),
    encounter("jumper_platform", 4, 10, 5, ["vertical_pressure"], ["jumper"]),
    encounter("jumper_pair", 4, 10, 7, ["vertical_pressure"], ["jumper", "basicWalker"]),
    encounter("plant_and_patrol", 4, 10, 7, ["reward_guard", "patrol"], ["plant", "basicWalker"]),
    encounter("aerial_crossing", 5, 10, 5, ["aerial_pressure"], ["aerial"]),
    encounter("aerial_plus_patrol", 5, 10, 7, ["aerial_pressure", "patrol"], ["aerial", "basicWalker"]),
    encounter("moving_platform_pressure", 5, 10, 7, ["landing_threat"], ["fastWalker", "koopa"]),
    encounter("mini_gauntlet_a", 5, 10, 8, ["pressure"], ["basicWalker", "fastWalker", "koopa"]),
    encounter("mini_gauntlet_b", 5, 10, 8, ["pressure"], ["spiny", "basicWalker", "fastWalker"]),
    encounter("split_route_reward", 5, 10, 7, ["route_guard", "reward_guard"], ["koopa", "spiny"]),
    encounter("vertical_combo", 6, 10, 9, ["vertical_pressure", "aerial_pressure"], ["jumper", "aerial"]),
    encounter("hard_mixed_formation", 6, 10, 10, ["pressure", "route_guard"], ["fastWalker", "spiny", "koopa"]),
    encounter("elite_intro", 7, 10, 8, ["elite"], ["elite"]),
    encounter("elite_escort", 7, 10, 11, ["elite", "pressure"], ["elite", "basicWalker"]),
    encounter("elite_spiny_support", 8, 10, 12, ["elite", "route_guard"], ["elite", "spiny"]),
    encounter("milestone_battle_a", 7, 10, 12, ["elite"], ["elite", "koopa"]),
    encounter("milestone_battle_b", 8, 10, 14, ["elite", "aerial_pressure"], ["elite", "aerial", "basicWalker"])
  ]);

  function makeBag(items, rng) {
    var bag = [];
    function refill() {
      bag = items.slice();
      for (var i = bag.length - 1; i > 0; i -= 1) {
        var j = rng.int(0, i);
        var tmp = bag[i];
        bag[i] = bag[j];
        bag[j] = tmp;
      }
    }
    refill();
    return {
      next: function () {
        if (!bag.length) refill();
        return bag.pop();
      }
    };
  }

  function createDirector(seed) {
    var rng = createRng(seed || "pqd-endless");
    var familyBag = makeBag(FAMILIES, rng);
    var state = {
      worldSeed: seed || "pqd-endless",
      runId: "run-" + hashSeed(seed || "pqd-endless").toString(36),
      nextSectionIndex: 0,
      generatedWorldEndX: 0,
      difficultyState: { tier: 1, act: 1, distance: 0 },
      directorState: {
        intensity: 0,
        pacingBeat: "build",
        recentFamilies: [],
        recentVariants: [],
        recentEncounters: [],
        recentEnemyCombos: [],
        recentPacingBeats: [],
        rejectedCandidates: []
      }
    };

    function difficultyFor(index) {
      return Math.min(10, 1 + Math.floor(index / 8));
    }

    function pacingFor(index, intensity) {
      var recent = state.directorState.recentPacingBeats;
      if (intensity >= 85 && recent[recent.length - 1] !== "recover") return "recover";
      return PACING[index % PACING.length];
    }

    function remember(list, value, max) {
      list.push(value);
      while (list.length > max) list.shift();
    }

    function familyAllowed(family) {
      var recent = state.directorState.recentFamilies;
      var countInFive = recent.slice(-5).filter(function (item) { return item === family; }).length;
      return countInFive < 2;
    }

    function chooseVariant(family, tier) {
      var candidates = TRAVERSAL_VARIANTS.filter(function (variant) {
        return variant.family === family &&
          state.directorState.recentVariants.indexOf(variant.id) === -1 &&
          tier + variant.difficultyBias >= 1;
      });
      if (!candidates.length) {
        var previousVariant = state.directorState.recentVariants[state.directorState.recentVariants.length - 1];
        candidates = TRAVERSAL_VARIANTS.filter(function (variant) {
          return variant.family === family && variant.id !== previousVariant;
        });
      }
      if (!candidates.length) candidates = TRAVERSAL_VARIANTS.filter(function (variant) { return variant.family === family; });
      return rng.pick(candidates);
    }

    function chooseEncounter(tier, beat) {
      var budget = Math.min(14, 1 + tier * 1.35 + (beat === "peak" ? 3 : beat === "recover" ? -2 : 0));
      var candidates = ENCOUNTER_TEMPLATES.filter(function (enc) {
        return enc.minimumDifficulty <= tier &&
          enc.maximumDifficulty >= tier &&
          enc.enemyBudgetCost <= budget &&
          state.directorState.recentEncounters.indexOf(enc.id) === -1;
      });
      if (!candidates.length) candidates = ENCOUNTER_TEMPLATES.filter(function (enc) {
        return enc.minimumDifficulty <= tier && enc.maximumDifficulty >= tier;
      });
      return rng.pick(candidates);
    }

    function nextFamily(beat) {
      if (beat === "recover") return "RECOVERY_SECTION";
      if (beat === "reward") return rng.pick(["RISK_REWARD_ROUTE", "SPLIT_ROUTE", "CHECKPOINT_SECTION"]);
      for (var attempts = 0; attempts < 12; attempts += 1) {
        var family = familyBag.next();
        if (familyAllowed(family)) return family;
      }
      return "FLOW_RUN";
    }

    function nextSection() {
      var index = state.nextSectionIndex;
      var tier = difficultyFor(index);
      var beat = pacingFor(index, state.directorState.intensity);
      var family = nextFamily(beat);
      if (index > 0 && index % 25 === 0) family = "MILESTONE_ARENA";
      if (index > 0 && index % 10 === 0) family = "CHECKPOINT_SECTION";
      var variant = chooseVariant(family, tier);
      var selectedEncounter = family === "RECOVERY_SECTION" ? encounter("recovery_none", 1, 10, 0, [], []) : chooseEncounter(tier, beat);
      var combo = selectedEncounter.enemyTypes.join("+") || "none";
      var section = {
        index: index,
        id: "section-" + index,
        startX: state.generatedWorldEndX,
        endX: state.generatedWorldEndX + variant.lengthTiles * tile,
        family: family,
        variantId: variant.id,
        pacingBeat: beat,
        difficultyTier: tier,
        encounterId: selectedEncounter.id,
        enemyBudget: selectedEncounter.enemyBudgetCost,
        enemyTypes: selectedEncounter.enemyTypes.slice(),
        intensity: Math.max(0, Math.min(100, beat === "recover"
          ? state.directorState.intensity - 55
          : state.directorState.intensity + selectedEncounter.enemyBudgetCost * 4 + tier - (beat === "reward" ? 12 : 0))),
        milestone: family === "MILESTONE_ARENA",
        checkpoint: family === "CHECKPOINT_SECTION" || index % 10 === 0
      };
      state.nextSectionIndex += 1;
      state.generatedWorldEndX = section.endX;
      state.difficultyState = { tier: tier, act: 1 + Math.floor(index / 18), distance: section.endX };
      state.directorState.intensity = section.intensity;
      state.directorState.pacingBeat = beat;
      remember(state.directorState.recentFamilies, family, 8);
      remember(state.directorState.recentVariants, variant.id, 15);
      remember(state.directorState.recentEncounters, selectedEncounter.id, 12);
      remember(state.directorState.recentEnemyCombos, combo, 5);
      remember(state.directorState.recentPacingBeats, beat, 4);
      return { section: section, variant: variant, encounter: selectedEncounter };
    }

    return {
      state: state,
      rng: rng,
      nextSection: nextSection
    };
  }

  function analyzeVariety(sections) {
    function countBy(key) {
      return sections.reduce(function (out, section) {
        var value = section[key];
        out[value] = (out[value] || 0) + 1;
        return out;
      }, {});
    }
    return {
      sectionCount: sections.length,
      uniqueTraversalVariants: Object.keys(countBy("variantId")).length,
      uniqueEnemyEncounters: Object.keys(countBy("encounterId")).length,
      challengeFamilyDistribution: countBy("family"),
      recoverySectionCount: sections.filter(function (section) { return section.family === "RECOVERY_SECTION"; }).length,
      maxDifficultyTier: Math.max.apply(null, sections.map(function (section) { return section.difficultyTier; }))
    };
  }

  return Object.freeze({
    DEBUG_GAME_DIRECTOR: DEBUG_GAME_DIRECTOR,
    PLAYER_CAPABILITIES: PLAYER_CAPABILITIES,
    FAMILIES: FAMILIES,
    TRAVERSAL_VARIANTS: TRAVERSAL_VARIANTS,
    ENCOUNTER_TEMPLATES: ENCOUNTER_TEMPLATES,
    createRng: createRng,
    createDirector: createDirector,
    analyzeVariety: analyzeVariety
  });
});
