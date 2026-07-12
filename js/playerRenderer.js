(function (root) {
  "use strict";

  function drawPlayer(options) {
    var ctx = options.ctx;
    var player = options.player;
    var state = options.state;
    var atlas = root.PQDSpriteAtlas;
    var direction = state.direction || (state.facing < 0 ? "left" : "right");
    var frame = atlas.getPlayerFrame({
      characterId: player.characterId || player.character,
      direction: direction,
      form: state.form,
      animation: state.animation,
      frameIndex: state.animationFrame || options.elapsedTime * 10,
      temporaryEffect: state.temporaryEffect,
      isDead: state.isDead || state.dead,
      isFinished: state.isFinished || state.finished
    });
    if (frame.hidden) return null;
    var img = options.resources.get(frame.image);
    if (!img) return null;
    var drawX = Math.round(state.x + state.w / 2 - frame.dw / 2 + frame.drawOffsetX - options.cameraX);
    var feetY = state.y + state.h;
    var drawY = Math.round(feetY - frame.dh + frame.drawOffsetY - options.cameraY);
    ctx.drawImage(img, frame.sx, frame.sy, frame.sw, frame.sh, drawX, drawY, frame.dw, frame.dh);
    if (atlas.DEBUG_HITBOXES) {
      ctx.strokeStyle = player.id === options.localPlayerId ? "#FFD85A" : "#F7FBFF";
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(state.x - options.cameraX), Math.round(state.y - options.cameraY), state.w, state.h);
    }
    return {
      id: player.id,
      name: player.name,
      screenX: drawX + frame.dw / 2,
      screenY: drawY,
      x: drawX,
      y: drawY,
      w: frame.dw,
      h: frame.dh
    };
  }

  root.PQDPlayerRenderer = { drawPlayer: drawPlayer };
})(window);
