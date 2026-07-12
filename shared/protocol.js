(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PQDProtocol = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var CLIENT_EVENTS = Object.freeze({
    CREATE_ROOM: "room:create",
    JOIN_ROOM: "room:join",
    LEAVE_ROOM: "room:leave",
    READY: "room:ready",
    CHARACTER: "room:character",
    START: "room:start",
    INPUT: "game:input",
    RESTART_VOTE: "game:restartVote",
    RETURN_TO_LOBBY: "game:returnToLobby",
    PING: "connection:ping"
  });

  var SERVER_EVENTS = Object.freeze({
    ROOM_CREATED: "room:created",
    ROOM_JOINED: "room:joined",
    ROOM_STATE: "room:state",
    PLAYER_JOINED: "room:playerJoined",
    PLAYER_LEFT: "room:playerLeft",
    PLAYER_READY: "room:playerReady",
    ERROR: "room:error",
    COUNTDOWN: "game:countdown",
    GAME_START: "game:start",
    SNAPSHOT: "game:snapshot",
    GAME_EVENT: "game:event",
    PLAYER_FINISHED: "game:playerFinished",
    GAME_OVER: "game:over",
    ROUND_GAME_OVER: "round:gameOver",
    ROUND_RESET: "round:reset",
    ROUND_START: "round:start",
    RESTART_STATUS: "game:restartStatus",
    QUALITY: "connection:quality",
    PONG: "connection:pong"
  });

  var PAYLOADS = Object.freeze({
    "room:create": "{ name, character } -> room:created { roomCode, inviteUrl, playerId, reconnectToken }",
    "room:join": "{ roomCode, name, character, reconnectToken?, playerId? } -> room:joined",
    "room:ready": "{ ready }",
    "room:character": "{ character }",
    "room:start": "{} host only, both players ready",
    "game:input": "{ sequence, left, right, jump, run, action, interact, clientTime }",
    "game:restartVote": "{ wantsRestart }",
    "game:returnToLobby": "{}",
    "connection:ping": "{ clientTime }"
  });

  return Object.freeze({
    CLIENT_EVENTS: CLIENT_EVENTS,
    SERVER_EVENTS: SERVER_EVENTS,
    PAYLOADS: PAYLOADS
  });
});
