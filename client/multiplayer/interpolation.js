(function (root) {
  "use strict";

  function lerp(a, b, t) {
    return a + (b - a) * Math.max(0, Math.min(1, t));
  }

  function smoothPlayer(display, target, amount) {
    if (!display || !target) return target;
    display.x = lerp(display.x, target.x, amount);
    display.y = lerp(display.y, target.y, amount);
    display.vx = target.vx;
    display.vy = target.vy;
    display.facing = target.facing;
    display.grounded = target.grounded;
    display.finished = target.finished;
    return display;
  }

  root.PQDInterpolation = { lerp: lerp, smoothPlayer: smoothPlayer };
})(window);
