(function (root) {
  "use strict";

  function drawTile(ctx, img, frame, x, y, scale) {
    ctx.drawImage(img, frame.sx, frame.sy, frame.sw, frame.sh, Math.round(x), Math.round(y), frame.sw * scale, frame.sh * scale);
  }

  function drawComposedCloud(ctx, img, frames, x, y, scale) {
    drawTile(ctx, img, frames.cloudLeft, x, y, scale);
    drawTile(ctx, img, frames.cloudMiddle, x + 16 * scale, y, scale);
    drawTile(ctx, img, frames.cloudRight, x + 32 * scale, y, scale);
  }

  function drawHill(ctx, img, frames, x, y, variant) {
    if (variant === "large") {
      drawTile(ctx, img, frames.hillLeft, x, y + 16, 1);
      drawTile(ctx, img, frames.hillBody, x + 16, y + 16, 1);
      drawTile(ctx, img, frames.hillBody, x + 32, y + 16, 1);
      drawTile(ctx, img, frames.hillRight, x + 48, y + 16, 1);
      drawTile(ctx, img, frames.hillTop, x + 16, y, 1);
      drawTile(ctx, img, frames.hillTop, x + 32, y, 1);
    } else {
      drawTile(ctx, img, frames.hillLeft, x, y + 16, 1);
      drawTile(ctx, img, frames.hillRight, x + 16, y + 16, 1);
      drawTile(ctx, img, frames.hillTop, x + 8, y, 1);
    }
  }

  function drawBush(ctx, img, frames, x, y, width) {
    drawTile(ctx, img, frames.bushLeft, x, y, 1);
    for (var i = 1; i < width - 1; i += 1) drawTile(ctx, img, frames.bushMiddle, x + i * 16, y, 1);
    drawTile(ctx, img, frames.bushRight, x + (width - 1) * 16, y, 1);
  }

  function draw(options) {
    var ctx = options.ctx;
    var resources = options.resources;
    var atlas = root.PQDSpriteAtlas;
    var decorations = root.PQDBackgroundDecorations[options.theme] || root.PQDBackgroundDecorations.aboveground;
    var tiles = resources.get("sprites/tiles.png");
    var cloud = resources.get("sprites/cloud-transparent.png");
    ctx.fillStyle = decorations.skyColor;
    ctx.fillRect(0, 0, options.viewportWidth, options.viewportHeight);

    if (options.theme !== "aboveground" || !tiles) return;

    decorations.clouds.forEach(function (item) {
      var x = item.x - options.cameraX * item.parallax;
      if (x > options.viewportWidth + 180 || x < -220) return;
      if (item.variant === "large" && cloud) {
        var w = cloud.naturalWidth * item.scale;
        var h = cloud.naturalHeight * item.scale;
        ctx.drawImage(cloud, 0, 0, cloud.naturalWidth, cloud.naturalHeight, Math.round(x), Math.round(item.y), Math.round(w), Math.round(h));
      } else {
        drawComposedCloud(ctx, tiles, atlas.TILE_FRAMES, x, item.y, item.scale);
      }
    });

    decorations.hills.forEach(function (item) {
      var x = item.x - options.cameraX * item.parallax;
      if (x > options.viewportWidth + 80 || x < -120) return;
      drawHill(ctx, tiles, atlas.TILE_FRAMES, x, item.y, item.variant);
    });

    decorations.bushes.forEach(function (item) {
      var x = item.x - options.cameraX * item.parallax;
      if (x > options.viewportWidth + 80 || x < -120) return;
      drawBush(ctx, tiles, atlas.TILE_FRAMES, x, item.y, item.width);
    });
  }

  root.PQDBackgroundRenderer = { draw: draw };
})(window);
