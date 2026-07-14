"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const enemyAtlas = require("../shared/enemyAtlas");
const enemyRegistry = require("../shared/enemyRegistry");
const endlessDirector = require("../shared/endlessDirector");
const levelData = require("../shared/levelData");

function generate(seed, count) {
  const director = endlessDirector.createDirector(seed);
  const sections = [];
  for (let i = 0; i < count; i += 1) sections.push(director.nextSection().section);
  return sections;
}

test("enemy atlas catalogs usable sheet families with exact source frames", () => {
  assert.equal(enemyAtlas.SHEET_SIZE.width, 808);
  assert.equal(enemyAtlas.SHEET_SIZE.height, 128);
  const families = Object.keys(enemyAtlas.FAMILIES);
  ["basicWalker", "fastWalker", "koopa", "plant", "spiny", "jumper", "aerial", "aquatic", "bullet", "elite", "fireEffect"].forEach((id) => {
    assert.ok(families.includes(id), id);
    const frame = enemyAtlas.FAMILIES[id].right[0];
    assert.ok(Number.isInteger(frame.sourceX));
    assert.ok(Number.isInteger(frame.sourceY));
    assert.ok(frame.sourceWidth > 0);
    assert.ok(frame.sourceHeight > 0);
  });
});

test("enemy registry assigns roles, budgets and progressive unlocks", () => {
  const supported = Object.keys(enemyRegistry.ENEMY_TYPES);
  assert.deepEqual(supported.sort(), ["aerial", "basicWalker", "elite", "fastWalker", "jumper", "koopa", "plant", "spiny"].sort());
  assert.ok(enemyRegistry.UNSUPPORTED_ATLAS_FAMILIES.includes("projectileThrower"));
  assert.ok(enemyRegistry.unlockedForTier(1).includes("basicWalker"));
  assert.equal(enemyRegistry.unlockedForTier(1).includes("elite"), false);
  assert.ok(enemyRegistry.unlockedForTier(8).includes("elite"));
});

test("same seed produces the same section sequence and different seeds vary", () => {
  const a = generate("seed-a", 80).map((section) => [section.family, section.variantId, section.encounterId]);
  const b = generate("seed-a", 80).map((section) => [section.family, section.variantId, section.encounterId]);
  const c = generate("seed-b", 80).map((section) => [section.family, section.variantId, section.encounterId]);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test("director provides authored variety and limits exact repetition", () => {
  const sections = generate("variety", 100);
  const report = endlessDirector.analyzeVariety(sections);
  assert.ok(endlessDirector.TRAVERSAL_VARIANTS.length >= 40);
  assert.ok(endlessDirector.ENCOUNTER_TEMPLATES.length >= 30);
  assert.ok(report.uniqueTraversalVariants >= 40, JSON.stringify(report));
  assert.ok(report.uniqueEnemyEncounters >= 24, JSON.stringify(report));
  assert.ok(report.recoverySectionCount >= 8);
  assert.ok(report.recoverySectionCount <= 35);
  for (let i = 1; i < sections.length; i += 1) {
    assert.notEqual(sections[i].variantId, sections[i - 1].variantId);
    const five = sections.slice(Math.max(0, i - 4), i + 1).filter((section) => section.family === sections[i].family);
    assert.ok(five.length <= 2 || sections[i].family === "CHECKPOINT_SECTION" || sections[i].family === "RECOVERY_SECTION");
  }
});

test("large director stress run preserves route assumptions and unlocks supported enemies", () => {
  const seenEnemies = new Set();
  ["stress-a", "stress-b", "stress-c"].forEach((seed) => {
    const sections = generate(seed, 10000);
    sections.forEach((section) => section.enemyTypes.forEach((type) => seenEnemies.add(type)));
    for (let i = 1; i < sections.length; i += 1) {
      assert.ok(sections[i].startX >= sections[i - 1].endX);
      assert.notEqual(sections[i].variantId, sections[i - 1].variantId);
    }
  });
  Object.keys(enemyRegistry.ENEMY_TYPES).forEach((type) => assert.ok(seenEnemies.has(type), type));
});

test("generated directed worlds validate across multiple seeds", () => {
  ["world-a", "world-b", "world-c"].forEach((seed) => {
    const world = levelData.createWorld({ seed, sectionCount: 160 });
    const report = levelData.validateLevel(world);
    assert.equal(report.ok, true, report.issues.join("\n"));
    assert.equal(world.sections.length, 160);
    assert.ok(world.width > 50000);
  });
});
