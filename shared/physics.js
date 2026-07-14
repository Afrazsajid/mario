(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./constants"), require("./enemyRegistry"));
  else root.PQDPhysics = factory(root.PQDConstants, root.PQDEnemyRegistry);
})(typeof globalThis !== "undefined" ? globalThis : this, function (constants, enemyRegistry) {
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

  function activePlayersFromContext(context) {
    if (!context || !context.players) return [];
    return context.players.filter(function (player) {
      return player && player.state && player.state.playerState === "active";
    });
  }

  function nearestPlayer(enemy, players, maxDistance) {
    var best = null;
    var bestDistance = maxDistance || Infinity;
    players.forEach(function (player) {
      var state = player.state;
      var dx = state.x + state.w / 2 - (enemy.x + enemy.w / 2);
      var dy = state.y + state.h / 2 - (enemy.y + enemy.h / 2);
      var distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < bestDistance) {
        best = state;
        bestDistance = distance;
      }
    });
    return best;
  }

  function stepWalkerEnemy(enemy, dt, world, gravityEnabled) {
    if (gravityEnabled !== false) {
      enemy.vy += GRAVITY * dt;
      enemy.vy = Math.min(380, enemy.vy);
    }
    enemy.x += enemy.vx * dt;
    var box = { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h };
    var solids = nearbySolids(box, world.solids);
    for (var i = 0; i < solids.length; i++) {
      if (overlaps(box, solids[i])) {
        enemy.x = enemy.vx > 0 ? solids[i].x - enemy.w : solids[i].x + solids[i].w;
        enemy.vx = -enemy.vx;
        enemy.direction = enemy.vx < 0 ? -1 : 1;
        box.x = enemy.x;
      }
    }
    if (enemy.patrolMinX !== undefined && enemy.x < enemy.patrolMinX) {
      enemy.x = enemy.patrolMinX;
      enemy.vx = Math.abs(enemy.vx);
      enemy.direction = 1;
    } else if (enemy.patrolMaxX !== undefined && enemy.x > enemy.patrolMaxX) {
      enemy.x = enemy.patrolMaxX;
      enemy.vx = -Math.abs(enemy.vx);
      enemy.direction = -1;
    }
    if (gravityEnabled !== false) {
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
    }
    if (enemy.y > world.height + 80) enemy.alive = false;
    return enemy;
  }

  function stepPlant(enemy, dt, players) {
    enemy.vx = 0;
    enemy.vy = 0;
    enemy.stateTime = (enemy.stateTime || 0) + dt;
    var cycleSpeed = Math.max(1, Math.min(1.32, enemy.cycleSpeed || 1));
    var close = players.some(function (player) {
      var state = player.state;
      return Math.abs((state.x + state.w / 2) - (enemy.x + enemy.w / 2)) < 44 &&
        state.y + state.h > enemy.pipeTopY - 8;
    });
    if (enemy.state !== "hidden") {
      enemy.animationFrame = Math.floor((enemy.stateTime + (enemy.cycleOffset || 0)) * 7) % 2;
    } else {
      enemy.animationFrame = 0;
    }
    if (enemy.state === "hidden") {
      enemy.y = enemy.hiddenY;
      if (close) {
        enemy.stateTime = 0;
      } else if (enemy.stateTime + (enemy.cycleOffset || 0) >= Math.max(0.75, 1.15 / cycleSpeed)) {
        enemy.state = "rising";
        enemy.stateTime = 0;
      }
    } else if (enemy.state === "rising") {
      enemy.y = Math.max(enemy.exposedY, enemy.y - 26 * cycleSpeed * dt);
      if (enemy.y <= enemy.exposedY) {
        enemy.y = enemy.exposedY;
        enemy.state = "attacking";
        enemy.stateTime = 0;
      }
    } else if (enemy.state === "attacking") {
      enemy.y = enemy.exposedY;
      if (enemy.stateTime >= Math.max(0.82, 1.25 / cycleSpeed)) {
        enemy.state = "lowering";
        enemy.stateTime = 0;
      }
    } else if (enemy.state === "lowering") {
      enemy.y = Math.min(enemy.hiddenY, enemy.y + 30 * cycleSpeed * dt);
      if (enemy.y >= enemy.hiddenY) {
        enemy.y = enemy.hiddenY;
        enemy.state = "hidden";
        enemy.stateTime = 0;
      }
    }
    return enemy;
  }

  function stepFlying(enemy, dt) {
    enemy.phase = (enemy.phase || 0) + dt * 3;
    enemy.x += enemy.vx * dt;
    if (enemy.x <= enemy.patrolMinX) {
      enemy.x = enemy.patrolMinX;
      enemy.vx = Math.abs(enemy.vx);
      enemy.direction = 1;
    } else if (enemy.x >= enemy.patrolMaxX) {
      enemy.x = enemy.patrolMaxX;
      enemy.vx = -Math.abs(enemy.vx);
      enemy.direction = -1;
    }
    enemy.y = enemy.baseY + Math.sin(enemy.phase) * 10;
    return enemy;
  }

  function stepCrossingFish(enemy, dt) {
    enemy.phase = (enemy.phase || 0) + dt * 2.7;
    enemy.x += enemy.vx * dt;
    if (enemy.x <= enemy.patrolMinX) {
      enemy.x = enemy.patrolMinX;
      enemy.vx = Math.abs(enemy.vx);
      enemy.direction = 1;
    } else if (enemy.x >= enemy.patrolMaxX) {
      enemy.x = enemy.patrolMaxX;
      enemy.vx = -Math.abs(enemy.vx);
      enemy.direction = -1;
    }
    enemy.y = enemy.baseY - Math.abs(Math.sin(enemy.phase)) * (enemy.arcHeight || 22);
    return enemy;
  }

  function stepRanged(enemy, dt, players, context) {
    enemy.vx = 0;
    enemy.vy += GRAVITY * dt;
    enemy.vy = Math.min(380, enemy.vy);
    stepWalkerEnemy(enemy, dt, { solids: context.worldSolids || [], height: Infinity }, true);
    enemy.cooldown = Math.max(0, (enemy.cooldown || 0) - dt);
    enemy.stateTime = (enemy.stateTime || 0) + dt;
    var target = nearestPlayer(enemy, players, 220);
    if (!target) {
      enemy.state = "idle";
      return enemy;
    }
    enemy.direction = target.x < enemy.x ? -1 : 1;
    if (enemy.cooldown > 0) {
      enemy.state = "cooldown";
      return enemy;
    }
    if (enemy.state !== "telegraph") {
      enemy.state = "telegraph";
      enemy.stateTime = 0;
      return enemy;
    }
    if (enemy.stateTime >= 0.55 && context && context.spawnEnemyProjectile) {
      context.spawnEnemyProjectile(enemy);
      enemy.cooldown = 2.2;
      enemy.state = "cooldown";
      enemy.stateTime = 0;
    }
    return enemy;
  }

  function stepEnemy(enemy, dt, world, context) {
    if (!enemy.alive) return enemy;
    context = context || {};
    context.worldSolids = world.solids;
    var players = activePlayersFromContext(context);
    if (enemy.behaviour === "pipePlant") return stepPlant(enemy, dt, players);
    if (enemy.behaviour === "aerialPatrol") return stepFlying(enemy, dt);
    if (enemy.behaviour === "crossingFish") return stepCrossingFish(enemy, dt);
    if (enemy.behaviour === "projectileThrower") return stepRanged(enemy, dt, players, context);
    if (enemy.behaviour === "shellWalker" && enemy.state === "shellStationary") {
      enemy.vx = 0;
      enemy.vy += GRAVITY * dt;
      return stepWalkerEnemy(enemy, dt, world, true);
    }
    return stepWalkerEnemy(enemy, dt, world, true);
  }

  return Object.freeze({
    createPlayerState: createPlayerState,
    stepPlayer: stepPlayer,
    stepEnemy: stepEnemy,
    overlaps: overlaps
  });
});
