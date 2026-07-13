(function (root) {
  "use strict";

  function lerp(a, b, t) {
    return a + (b - a) * Math.max(0, Math.min(1, t));
  }

  function smoothPlayer(display, target, amount) {
    if (!display || !target) return target;
    var previousHeight = display.h || target.h || 0;
    var nextHeight = target.h || previousHeight;
    var previousFeetY = (display.y || 0) + previousHeight;
    display.x = lerp(display.x, target.x, amount);
    display.y = lerp(display.y, target.y, amount);
    display.w = target.w;
    display.h = nextHeight;
    if (previousHeight !== nextHeight) display.y = previousFeetY - nextHeight;
    display.vx = target.vx;
    display.vy = target.vy;
    display.facing = target.facing;
    display.direction = target.direction;
    display.grounded = target.grounded;
    display.finished = target.finished;
    display.dead = target.dead;
    display.isDead = target.isDead;
    display.isFinished = target.isFinished;
    display.form = target.form;
    display.pendingForm = target.pendingForm;
    display.temporaryEffect = target.temporaryEffect;
    display.effectExpiresAt = target.effectExpiresAt;
    display.shootingUntil = target.shootingUntil;
    display.shootingUntilLocal = target.shootingUntilLocal;
    display.isInvulnerable = target.isInvulnerable;
    display.animation = target.animation;
    display.animationFrame = target.animationFrame;
    return display;
  }

  root.PQDInterpolation = { lerp: lerp, smoothPlayer: smoothPlayer };
})(window);
