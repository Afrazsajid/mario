(function (root) {
  "use strict";

  var DEBUG_HITBOXES = false;
  var FRAME_X = {
    idle: 80,
    run: [96, 112, 128],
    jump: 160,
    hurt: 144,
    dead: 176,
    finished: 192
  };

  var BASE_FRAMES = {
    mario: {
      small: { sy: 32, sh: 16, dh: 16 },
      super: { sy: 0, sh: 32, dh: 32 },
      fire: { sy: 96, sh: 32, dh: 32 }
    },
    luigi: {
      small: { sy: 80, sh: 16, dh: 16 },
      super: { sy: 48, sh: 32, dh: 32 },
      fire: { sy: 96, sh: 32, dh: 32 }
    }
  };

  var STAR_ROWS = {
    mario: {
      small: [176, 224, 272],
      super: [144, 192, 240],
      fire: [144, 192, 240]
    },
    luigi: {
      small: [320, 368, 416],
      super: [288, 336, 384],
      fire: [288, 336, 384]
    }
  };

  var TILE_FRAMES = {
    groundBrown: { sx: 0, sy: 0, sw: 16, sh: 16 },
    brickBrown: { sx: 16, sy: 0, sw: 16, sh: 16 },
    usedBrown: { sx: 48, sy: 0, sw: 16, sh: 16 },
    questionBrown: { sx: 384, sy: 0, sw: 16, sh: 16 },
    pipeGreenTopLeft: { sx: 0, sy: 128, sw: 16, sh: 16 },
    pipeGreenTopRight: { sx: 16, sy: 128, sw: 16, sh: 16 },
    pipeGreenMidLeft: { sx: 0, sy: 144, sw: 16, sh: 16 },
    pipeGreenMidRight: { sx: 16, sy: 144, sw: 16, sh: 16 },
    hillTop: { sx: 144, sy: 128, sw: 16, sh: 16 },
    hillLeft: { sx: 128, sy: 144, sw: 16, sh: 16 },
    hillBody: { sx: 144, sy: 144, sw: 16, sh: 16 },
    hillRight: { sx: 160, sy: 144, sw: 16, sh: 16 },
    bushLeft: { sx: 176, sy: 144, sw: 16, sh: 16 },
    bushMiddle: { sx: 192, sy: 144, sw: 16, sh: 16 },
    bushRight: { sx: 208, sy: 144, sw: 16, sh: 16 },
    cloudLeft: { sx: 0, sy: 320, sw: 16, sh: 32 },
    cloudMiddle: { sx: 16, sy: 320, sw: 16, sh: 32 },
    cloudRight: { sx: 32, sy: 320, sw: 16, sh: 32 },
    underground: { sx: 0, sy: 32, sw: 16, sh: 16 }
  };

  function characterAtlasId(characterId) {
    var def = root.PQDConstants && root.PQDConstants.CHARACTERS[characterId];
    return def && def.atlasId ? def.atlasId : characterId === "bolt" ? "luigi" : "mario";
  }

  function frameBandFor(atlasId, form, temporaryEffect, frameIndex) {
    var safeForm = form === "fire" || form === "super" ? form : "small";
    var band = BASE_FRAMES[atlasId][safeForm] || BASE_FRAMES[atlasId].small;
    if (temporaryEffect === "star") {
      var rows = STAR_ROWS[atlasId][safeForm] || STAR_ROWS[atlasId].small;
      return {
        sy: rows[Math.floor(frameIndex / 4) % rows.length],
        sh: band.sh,
        dh: band.dh
      };
    }
    return band;
  }

  function getPlayerFrame(options) {
    var atlasId = characterAtlasId(options.characterId);
    var form = options.form || "small";
    var direction = options.direction === "left" ? "left" : "right";
    var animation = options.isDead ? "dead" : options.isFinished ? "finished" : options.animation || "idle";
    var frameIndex = options.frameIndex || 0;
    var sx = FRAME_X.idle;
    if (animation === "run") {
      var run = FRAME_X.run;
      sx = run[Math.floor(frameIndex) % run.length];
    } else if (animation === "jump") sx = FRAME_X.jump;
    else if (animation === "hurt") sx = FRAME_X.hurt;
    else if (animation === "dead") sx = FRAME_X.dead;
    else if (animation === "finished") sx = FRAME_X.finished;

    var band = frameBandFor(atlasId, form, options.temporaryEffect, frameIndex);
    return {
      image: direction === "left" ? "sprites/playerl.png" : "sprites/player.png",
      sx: sx,
      sy: band.sy,
      sw: 16,
      sh: band.sh,
      dw: 16,
      dh: band.dh,
      drawOffsetX: -1,
      drawOffsetY: 0,
      hidden: options.temporaryEffect === "damageInvulnerability" && Math.floor(frameIndex * 2) % 4 === 0
    };
  }

  root.PQDSpriteAtlas = {
    DEBUG_HITBOXES: DEBUG_HITBOXES,
    PLAYER_FRAMES: { baseFrames: BASE_FRAMES, starRows: STAR_ROWS, frameX: FRAME_X },
    TILE_FRAMES: TILE_FRAMES,
    getPlayerFrame: getPlayerFrame,
    characterAtlasId: characterAtlasId
  };
})(window);
