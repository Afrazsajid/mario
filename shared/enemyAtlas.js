(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PQDEnemyAtlas = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var SHEET_SIZE = Object.freeze({ width: 808, height: 128 });

  function frame(family, sx, sy, sw, sh, dw, dh, offsetX, offsetY) {
    return Object.freeze({
      enemyFamily: family,
      sourceX: sx,
      sourceY: sy,
      sourceWidth: sw,
      sourceHeight: sh,
      drawWidth: dw || sw,
      drawHeight: dh || sh,
      drawOffsetX: offsetX || 0,
      drawOffsetY: offsetY || 0
    });
  }

  var FAMILIES = Object.freeze({
    basicWalker: Object.freeze({
      id: "basicWalker",
      label: "Goomba-style walker",
      gameplaySupported: true,
      palettes: [0, 32, 64, 96],
      right: [frame("basicWalker", 0, 0, 16, 16), frame("basicWalker", 16, 0, 16, 16)],
      left: [frame("basicWalker", 0, 0, 16, 16), frame("basicWalker", 16, 0, 16, 16)],
      defeated: frame("basicWalker", 32, 0, 16, 16)
    }),
    fastWalker: Object.freeze({
      id: "fastWalker",
      label: "Fast palette walker",
      gameplaySupported: true,
      palettes: [32],
      right: [frame("fastWalker", 0, 32, 16, 16), frame("fastWalker", 16, 32, 16, 16)],
      left: [frame("fastWalker", 0, 32, 16, 16), frame("fastWalker", 16, 32, 16, 16)]
    }),
    koopa: Object.freeze({
      id: "koopa",
      label: "Koopa-style walker",
      gameplaySupported: true,
      palettes: [0, 32, 64, 96],
      right: [frame("koopa", 80, 0, 16, 32), frame("koopa", 96, 0, 16, 32)],
      left: [frame("koopa", 80, 0, 16, 32), frame("koopa", 96, 0, 16, 32)],
      shell: [frame("koopa", 160, 16, 16, 16), frame("koopa", 176, 16, 16, 16)]
    }),
    plant: Object.freeze({
      id: "plant",
      label: "Pipe plant",
      gameplaySupported: true,
      palettes: [0, 32, 64, 96],
      right: [frame("plant", 224, 0, 16, 24), frame("plant", 240, 0, 16, 24)],
      left: [frame("plant", 224, 0, 16, 24), frame("plant", 240, 0, 16, 24)]
    }),
    spiny: Object.freeze({
      id: "spiny",
      label: "Armoured spiny",
      gameplaySupported: true,
      palettes: [0, 32, 64, 96],
      right: [frame("spiny", 256, 0, 16, 16), frame("spiny", 272, 0, 16, 16)],
      left: [frame("spiny", 256, 0, 16, 16), frame("spiny", 272, 0, 16, 16)]
    }),
    jumper: Object.freeze({
      id: "jumper",
      label: "Jumping turtle",
      gameplaySupported: true,
      palettes: [0, 32, 64, 96],
      right: [frame("jumper", 320, 0, 16, 32), frame("jumper", 336, 0, 16, 32)],
      left: [frame("jumper", 320, 0, 16, 32), frame("jumper", 336, 0, 16, 32)]
    }),
    projectileThrower: Object.freeze({
      id: "projectileThrower",
      label: "Projectile thrower",
      gameplaySupported: false,
      palettes: [0, 32, 64, 96],
      right: [frame("projectileThrower", 480, 0, 16, 24), frame("projectileThrower", 496, 0, 16, 24)],
      left: [frame("projectileThrower", 480, 0, 16, 24), frame("projectileThrower", 496, 0, 16, 24)]
    }),
    aerial: Object.freeze({
      id: "aerial",
      label: "Flying fish / aerial crossing",
      gameplaySupported: true,
      palettes: [0, 32, 64, 96],
      right: [frame("aerial", 592, 0, 16, 16), frame("aerial", 608, 0, 16, 16)],
      left: [frame("aerial", 592, 0, 16, 16), frame("aerial", 608, 0, 16, 16)]
    }),
    aquatic: Object.freeze({
      id: "aquatic",
      label: "Squid/aquatic enemy",
      gameplaySupported: false,
      palettes: [0, 32, 64, 96],
      right: [frame("aquatic", 544, 0, 16, 24), frame("aquatic", 560, 0, 16, 24)],
      left: [frame("aquatic", 544, 0, 16, 24), frame("aquatic", 560, 0, 16, 24)]
    }),
    bullet: Object.freeze({
      id: "bullet",
      label: "Fast projectile/bullet",
      gameplaySupported: false,
      palettes: [0, 32, 64, 96],
      right: [frame("bullet", 432, 16, 16, 16)],
      left: [frame("bullet", 432, 16, 16, 16)]
    }),
    elite: Object.freeze({
      id: "elite",
      label: "Large elite / boss-scale enemy",
      gameplaySupported: true,
      palettes: [0, 32, 64, 96],
      right: [frame("elite", 736, 0, 32, 32), frame("elite", 768, 0, 32, 32)],
      left: [frame("elite", 736, 0, 32, 32), frame("elite", 768, 0, 32, 32)]
    }),
    fireEffect: Object.freeze({
      id: "fireEffect",
      label: "Fire/projectile effect",
      gameplaySupported: false,
      palettes: [0],
      right: [frame("fireEffect", 784, 96, 16, 16), frame("fireEffect", 800, 96, 8, 16)],
      left: [frame("fireEffect", 784, 96, 16, 16), frame("fireEffect", 800, 96, 8, 16)]
    })
  });

  function family(id) {
    return FAMILIES[id] || FAMILIES.basicWalker;
  }

  function getFrame(options) {
    var fam = family(options.enemyFamily || options.type);
    var direction = options.direction === "right" ? "right" : "left";
    var frames = fam[direction] || fam.right;
    return frames[Math.floor(options.frameIndex || 0) % frames.length];
  }

  return Object.freeze({
    SHEET_SIZE: SHEET_SIZE,
    FAMILIES: FAMILIES,
    getFrame: getFrame
  });
});
