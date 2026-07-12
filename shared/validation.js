(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./constants"));
  else root.PQDValidation = factory(root.PQDConstants);
})(typeof globalThis !== "undefined" ? globalThis : this, function (constants) {
  "use strict";

  function normalizeName(name) {
    return String(name || "").replace(/\s+/g, " ").trim();
  }

  function validateName(name) {
    var value = normalizeName(name);
    if (value.length < 2 || value.length > 16) return { ok: false, error: "Name must be 2 to 16 characters." };
    if (!/^[A-Za-z0-9 _-]+$/.test(value)) return { ok: false, error: "Use letters, numbers, spaces, underscores or hyphens." };
    return { ok: true, value: value };
  }

  function validateRoomCode(code) {
    var value = String(code || "").toUpperCase().replace(/\s+/g, "");
    var pattern = new RegExp("^[" + constants.ROOM_CODE_ALPHABET + "]{" + constants.ROOM_CODE_LENGTH + "}$");
    return pattern.test(value) ? { ok: true, value: value } : { ok: false, error: "Enter a valid six-character room code." };
  }

  function validateCharacter(character) {
    return constants.CHARACTERS[character] ? { ok: true, value: character } : { ok: false, error: "Choose an available character." };
  }

  function sanitizeInputPacket(payload) {
    if (!payload || typeof payload !== "object") return { ok: false, error: "Malformed input packet." };
    var allowed = ["sequence", "left", "right", "jump", "run", "action", "interact", "clientTime"];
    for (var key in payload) {
      if (allowed.indexOf(key) === -1) return { ok: false, error: "Unknown input property." };
    }
    var sequence = Number(payload.sequence);
    if (!Number.isFinite(sequence) || sequence < 0 || sequence > 1000000000) return { ok: false, error: "Invalid input sequence." };
    return {
      ok: true,
      value: {
        sequence: Math.floor(sequence),
        left: !!payload.left,
        right: !!payload.right,
        jump: !!payload.jump,
        run: !!payload.run,
        action: !!payload.action,
        interact: !!payload.interact,
        clientTime: Number(payload.clientTime) || Date.now()
      }
    };
  }

  return Object.freeze({
    normalizeName: normalizeName,
    validateName: validateName,
    validateRoomCode: validateRoomCode,
    validateCharacter: validateCharacter,
    sanitizeInputPacket: sanitizeInputPacket
  });
});
