(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./constants"));
  else root.PQDLevelData = factory(root.PQDConstants);
})(typeof globalThis !== "undefined" ? globalThis : this, function (constants) {
  "use strict";

  function rect(x, y, w, h, id) {
    return { id: id || ("solid-" + x + "-" + y), x: x, y: y, w: w, h: h };
  }

  var ground = [[0, 69], [71, 86], [89, 153], [155, 212]];
  var blocks = [
    [16, 9], [20, 9], [21, 9], [22, 9], [22, 5], [23, 9], [24, 9], [77, 9], [78, 9], [79, 9],
    [80, 5], [81, 5], [82, 5], [83, 5], [84, 5], [85, 5], [86, 5], [87, 5], [91, 5], [92, 5],
    [93, 5], [94, 5], [94, 9], [100, 9], [101, 9], [105, 9], [108, 9], [108, 5], [111, 9],
    [117, 9], [120, 5], [121, 5], [122, 5], [123, 5], [128, 5], [129, 5], [129, 9],
    [130, 5], [130, 9], [131, 5], [168, 9], [169, 9], [170, 9], [171, 9]
  ];
  var walls = [[134, 13, 1], [135, 13, 2], [136, 13, 3], [137, 13, 4], [140, 13, 4], [141, 13, 3],
    [142, 13, 2], [143, 13, 1], [148, 13, 1], [149, 13, 2], [150, 13, 3], [151, 13, 4],
    [152, 13, 4], [155, 13, 4], [156, 13, 3], [157, 13, 2], [158, 13, 1], [181, 13, 1],
    [182, 13, 2], [183, 13, 3], [184, 13, 4], [185, 13, 5], [186, 13, 6], [187, 13, 7],
    [188, 13, 8], [189, 13, 8]];
  var pipes = [[28, 13, 2], [38, 13, 3], [46, 13, 4], [57, 9, 4], [163, 13, 2], [179, 13, 2]];

  function buildSolids() {
    var tile = constants.TILE_SIZE;
    var solids = [];
    ground.forEach(function (span, index) {
      solids.push(rect(span[0] * tile, 13 * tile, (span[1] - span[0]) * tile, 2 * tile, "ground-" + index));
    });
    blocks.forEach(function (b) { solids.push(rect(b[0] * tile, b[1] * tile, tile, tile, "block-" + b[0] + "-" + b[1])); });
    walls.forEach(function (w) {
      for (var y = w[1] - w[2]; y < w[1]; y++) solids.push(rect(w[0] * tile, y * tile, tile, tile, "wall-" + w[0] + "-" + y));
    });
    pipes.forEach(function (p) { solids.push(rect(p[0] * tile, (p[1] - p[2]) * tile, tile * 2, p[2] * tile, "pipe-" + p[0])); });
    solids.push(rect(198 * tile, 3 * tile, tile, 10 * tile, "flagpole"));
    return solids;
  }

  var coinTiles = [[16, 9], [22, 5], [23, 9], [94, 5], [105, 9], [108, 9], [111, 9], [129, 5], [130, 5], [170, 9],
    [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7],
    [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9]];
  var enemyTiles = [[22, 12, "goomba"], [40, 12, "goomba"], [50, 12, "goomba"], [51, 12, "goomba"], [82, 4, "goomba"],
    [84, 4, "goomba"], [100, 12, "goomba"], [102, 12, "goomba"], [114, 12, "goomba"], [115, 12, "goomba"],
    [122, 12, "goomba"], [123, 12, "goomba"], [125, 12, "goomba"], [126, 12, "goomba"], [170, 12, "goomba"],
    [172, 12, "goomba"], [35, 11, "koopa"]];

  function createWorld() {
    var tile = constants.TILE_SIZE;
    return {
      id: "level-1-1",
      title: "Skyline Sprint 1-1",
      width: constants.LEVEL_WIDTH,
      height: constants.LEVEL_HEIGHT,
      spawnPoints: [{ x: 56, y: 192 }, { x: 76, y: 192 }],
      finishX: 198 * tile,
      exitX: 204 * tile,
      solids: buildSolids(),
      coins: coinTiles.map(function (c, index) {
        return { id: "coin-" + index, x: c[0] * tile + 4, y: c[1] * tile + 4, w: 8, h: 8, collectedBy: null };
      }),
      powerUps: [
        { id: "power-0", type: "mushroom", x: 21 * tile, y: 8 * tile, w: 14, h: 14, collectedBy: null },
        { id: "power-1", type: "star", x: 100 * tile, y: 8 * tile, w: 14, h: 14, collectedBy: null },
        { id: "power-2", type: "mushroom", x: 108 * tile, y: 4 * tile, w: 14, h: 14, collectedBy: null }
      ],
      enemies: enemyTiles.map(function (e, index) {
        return { id: "enemy-" + index, type: e[2], x: e[0] * tile, y: e[1] * tile, w: 14, h: e[2] === "koopa" ? 24 : 14, vx: -28, vy: 0, alive: true };
      })
    };
  }

  return Object.freeze({ createWorld: createWorld });
});
