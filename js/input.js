(function () {
  "use strict";

  var pressedKeys = {};
  var aliases = {
    ArrowLeft: "LEFT",
    KeyA: "LEFT",
    ArrowRight: "RIGHT",
    KeyD: "RIGHT",
    ArrowUp: "UP",
    KeyW: "UP",
    ArrowDown: "DOWN",
    KeyS: "DOWN",
    Space: "JUMP",
    KeyX: "JUMP",
    ShiftLeft: "RUN",
    ShiftRight: "RUN",
    KeyZ: "RUN",
    KeyF: "ACTION",
    KeyE: "INTERACT",
    KeyV: "FIRE",
    ControlLeft: "CONTROL",
    ControlRight: "CONTROL",
    Escape: "PAUSE",
    KeyM: "MUTE",
    F11: "FULLSCREEN"
  };

  function keyFor(event) {
    if (aliases[event.code]) return aliases[event.code];
    if (event.key && event.key.length === 1) return event.key.toUpperCase();
    return event.key || "";
  }

  function shouldBlockScroll(key) {
    return ["LEFT", "RIGHT", "UP", "DOWN", "JUMP", "RUN"].indexOf(key) !== -1;
  }

  function shouldBlockDefault(key) {
    if (shouldBlockScroll(key)) return true;
    return key === "FIRE" && typeof window.PQDCanCaptureGameplayInput === "function" && window.PQDCanCaptureGameplayInput();
  }

  function setKey(event, status) {
    var key = keyFor(event);
    if (!key) return;
    pressedKeys[key] = status;
    if (status && shouldBlockDefault(key)) event.preventDefault();
    if (status && key === "FULLSCREEN") {
      window.dispatchEvent(new CustomEvent("pqd:fullscreen-shortcut"));
    }
    if (status && key === "PAUSE") {
      window.dispatchEvent(new CustomEvent("pqd:pause-shortcut"));
      event.preventDefault();
    }
    if (status && key === "MUTE" && !event.repeat) {
      window.dispatchEvent(new CustomEvent("pqd:mute-shortcut"));
    }
  }

  document.addEventListener("keydown", function (event) { setKey(event, true); }, { passive: false });
  document.addEventListener("keyup", function (event) { setKey(event, false); }, { passive: false });
  window.addEventListener("blur", function () { pressedKeys = {}; });

  window.input = {
    isDown: function (key) {
      return !!pressedKeys[String(key).toUpperCase()];
    },
    snapshot: function () {
      return {
        left: !!pressedKeys.LEFT,
        right: !!pressedKeys.RIGHT,
        jump: !!pressedKeys.JUMP,
        run: !!pressedKeys.RUN,
        action: !!pressedKeys.ACTION,
        interact: !!pressedKeys.INTERACT,
        fire: !!pressedKeys.FIRE,
        highJump: !!pressedKeys.JUMP && !!pressedKeys.CONTROL
      };
    },
    reset: function () {
      pressedKeys = {};
    }
  };
})();
