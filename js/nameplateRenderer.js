(function (root) {
  "use strict";

  function truncate(ctx, name, maxTextWidth) {
    if (ctx.measureText(name).width <= maxTextWidth) return name;
    var out = name;
    while (out.length > 1 && ctx.measureText(out + "...").width > maxTextWidth) out = out.slice(0, -1);
    return out + "...";
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function layoutPlayerNameplates(ctx, players, viewport, localPlayerId) {
    ctx.font = "700 8px Trebuchet MS, sans-serif";
    var padding = 4;
    var maxWidth = 72;
    var labels = players.map(function (player, index) {
      var fallback = "Player " + (index + 1);
      var name = player.name || fallback;
      var displayName = truncate(ctx, name, maxWidth - padding * 2);
      var width = Math.min(maxWidth, Math.ceil(ctx.measureText(displayName).width + padding * 2));
      var height = 13;
      var x = clamp(Math.round(player.screenX - width / 2), 2, viewport.width - width - 2);
      var y = clamp(Math.round(player.screenY - 18), 22, viewport.height - height - 2);
      return { player: player, text: displayName, x: x, y: y, w: width, h: height, local: player.id === localPlayerId };
    });

    labels.sort(function (a, b) { return a.local === b.local ? 0 : a.local ? -1 : 1; });
    for (var i = 0; i < labels.length; i += 1) {
      for (var j = 0; j < i; j += 1) {
        if (overlaps(labels[i], labels[j])) {
          labels[i].y = clamp(labels[j].y - labels[i].h - 2, 22, viewport.height - labels[i].h - 2);
          if (overlaps(labels[i], labels[j])) {
            labels[i].x = clamp(labels[i].x + (labels[i].x >= labels[j].x ? 12 : -12), 2, viewport.width - labels[i].w - 2);
          }
        }
      }
    }
    return labels;
  }

  function draw(ctx, visiblePlayers, viewport, localPlayerId) {
    var labels = layoutPlayerNameplates(ctx, visiblePlayers, viewport, localPlayerId);
    ctx.save();
    ctx.font = "700 8px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    labels.forEach(function (label) {
      var cx = label.x + label.w / 2;
      var cy = label.y + label.h / 2;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(7,17,31,0.92)";
      ctx.fillStyle = label.local ? "#FFD85A" : "#F7FBFF";
      ctx.strokeText(label.text, cx, cy);
      ctx.fillText(label.text, cx, cy);
    });
    ctx.restore();
  }

  root.PQDNameplateRenderer = {
    layoutPlayerNameplates: layoutPlayerNameplates,
    draw: draw
  };
})(window);
