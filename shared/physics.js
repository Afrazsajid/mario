(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./constants"));
  else root.PQDPhysics = factory(root.PQDConstants);
})(typeof globalThis !== "undefined" ? globalThis : this, function (constants) {
  "use strict";

  var GRAVITY = 900;
  var MOVE_ACCEL = 900;
  var GROUND_DECEL = 1100;
  var AIR_DECEL = 420;
  var WALK_SPEED = 96;
  var RUN_SPEED = 148;
  var JUMP_VELOCITY = -345;
  var HIGH_JUMP_VELOCITY = -405;
  var COYOTE_TIME = 0.1;
  var JUMP_BUFFER = 0.12;

  function createPlayerState(spawn, slot) {
    return {
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      w: constants.PLAYER_WIDTH,
      h: constants.PLAYER_SMALL_HEIGHT,
      facing: slot === 1 ? -1 : 1,
      direction: slot === 1 ? "left" : "right",
      grounded: false,
      coyote: 0,
      jumpBuffer: 0,
      jumpHeld: false,
      dead: false,
      invulnerableUntil: 0,
      playerState: constants.PLAYER_STATES ? constants.PLAYER_STATES.ACTIVE : "active",
      isAlive: true,
      isEliminated: false,
      isSpectating: false,
      deathReason: null,
      deathStartedAt: null,
      deathAnimationEndsAt: null,
      shootingUntil: 0,
      form: "small",
      pendingForm: null,
      temporaryEffect: "none",
      effectExpiresAt: 0,
      isInvulnerable: false,
      animation: "idle",
      animationFrame: 0,
      lastSequence: 0,
      finished: false,
      finishedAt: null,
      isDead: false,
      isFinished: false
    };
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function nearbySolids(box, solids) {
    var out = [];
    for (var i = 0; i < solids.length; i++) {
      var s = solids[i];
      if (box.x < s.x + s.w + 32 && box.x + box.w > s.x - 32 && box.y < s.y + s.h + 32 && box.y + box.h > s.y - 32) out.push(s);
    }
    return out;
  }

  function moveAxis(state, solids, axis) {
    var box = { x: state.x, y: state.y, w: state.w, h: state.h };
    var list = nearbySolids(box, solids);
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (!overlaps(box, s)) continue;
      if (axis === "x") {
        if (state.vx > 0) state.x = s.x - state.w;
        else if (state.vx < 0) state.x = s.x + s.w;
        state.vx = 0;
        box.x = state.x;
      } else {
        if (state.vy > 0) {
          state.y = s.y - state.h;
          state.grounded = true;
          state.coyote = COYOTE_TIME;
        } else if (state.vy < 0) {
          state.y = s.y + s.h;
        }
        state.vy = 0;
        box.y = state.y;
      }
    }
  }

  function stepPlayer(state, input, dt, world) {
    if (state.dead || state.finished || state.playerState && state.playerState !== "active") return state;
    input = input || {};
    var dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    var maxSpeed = input.run ? RUN_SPEED : WALK_SPEED;
    state.lastSequence = Math.max(state.lastSequence || 0, input.sequence || 0);

    if (dir !== 0) {
      state.vx += dir * MOVE_ACCEL * dt;
      state.facing = dir;
      state.direction = dir < 0 ? "left" : "right";
      if (Math.abs(state.vx) > maxSpeed) state.vx = maxSpeed * Math.sign(state.vx);
    } else {
      var decel = state.grounded ? GROUND_DECEL : AIR_DECEL;
      if (Math.abs(state.vx) <= decel * dt) state.vx = 0;
      else state.vx -= Math.sign(state.vx) * decel * dt;
    }

    state.coyote = Math.max(0, state.coyote - dt);
    state.jumpBuffer = input.jump ? JUMP_BUFFER : Math.max(0, state.jumpBuffer - dt);
    if (state.jumpBuffer > 0 && (state.grounded || state.coyote > 0)) {
      state.vy = input.highJump ? HIGH_JUMP_VELOCITY : JUMP_VELOCITY;
      state.grounded = false;
      state.coyote = 0;
      state.jumpBuffer = 0;
      state.jumpHeld = true;
    }
    if (!input.jump && state.jumpHeld && state.vy < -120) {
      state.vy = -120;
      state.jumpHeld = false;
    }

    state.vy += GRAVITY * dt;
    state.vy = Math.min(420, state.vy);
    state.grounded = false;
    state.x += state.vx * dt;
    moveAxis(state, world.solids, "x");
    state.y += state.vy * dt;
    moveAxis(state, world.solids, "y");

    state.x = Math.max(0, Math.min(world.width - state.w, state.x));
    if (state.y > world.height + 40) state.dead = true;
    if (state.x >= world.finishX && !state.finished) state.finished = true;
    state.isDead = !!state.dead;
    state.isFinished = !!state.finished;
    state.isInvulnerable = Date.now() < (state.invulnerableUntil || 0) || state.temporaryEffect === "star";
    if (state.dead) state.animation = "dead";
    else if (state.finished) state.animation = "finished";
    else if (!state.grounded) state.animation = "jump";
    else if (Math.abs(state.vx) > 8) state.animation = "run";
    else state.animation = "idle";
    state.animationFrame = (state.animationFrame || 0) + dt * 10;
    return state;
  }

  function stepEnemy(enemy, dt, world) {
    if (!enemy.alive) return enemy;
    enemy.vy += GRAVITY * dt;
    enemy.vy = Math.min(380, enemy.vy);
    enemy.x += enemy.vx * dt;
    var box = { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h };
    var solids = nearbySolids(box, world.solids);
    for (var i = 0; i < solids.length; i++) {
      if (overlaps(box, solids[i])) {
        enemy.x = enemy.vx > 0 ? solids[i].x - enemy.w : solids[i].x + solids[i].w;
        enemy.vx = -enemy.vx;
        box.x = enemy.x;
      }
    }
    enemy.y += enemy.vy * dt;
    box.y = enemy.y;
    solids = nearbySolids(box, world.solids);
    for (i = 0; i < solids.length; i++) {
      if (overlaps(box, solids[i])) {
        if (enemy.vy > 0) enemy.y = solids[i].y - enemy.h;
        else enemy.y = solids[i].y + solids[i].h;
        enemy.vy = 0;
        box.y = enemy.y;
      }
    }
    if (enemy.y > world.height + 80) enemy.alive = false;
    return enemy;
  }

  return Object.freeze({
    createPlayerState: createPlayerState,
    stepPlayer: stepPlayer,
    stepEnemy: stepEnemy,
    overlaps: overlaps
  });
});
