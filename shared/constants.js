(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PQDConstants = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var ROOM_STATUS = Object.freeze({
    WAITING: "WAITING",
    READY: "READY",
    COUNTDOWN: "COUNTDOWN",
    PLAYING: "PLAYING",
    RESULTS: "RESULTS",
    CLOSED: "CLOSED"
  });

  var ROUND_STATES = Object.freeze({
    WAITING: "waiting",
    COUNTDOWN: "countdown",
    PLAYING: "playing",
    PLAYER_ELIMINATED: "player_eliminated",
    LEVEL_COMPLETE: "level_complete",
    GAME_OVER: "game_over",
    RESTARTING: "restarting",
    RESULTS: "results"
  });

  var PLAYER_STATES = Object.freeze({
    ACTIVE: "active",
    DYING: "dying",
    ELIMINATED: "eliminated",
    SPECTATING: "spectating",
    FINISHED: "finished",
    DISCONNECTED: "disconnected"
  });

  var CHARACTERS = Object.freeze({
    nova: {
      id: "nova",
      name: "Mario",
      atlasId: "mario",
      primary: "#35E4D0",
      accent: "#FFD85A",
      sprite: "sprites/player.png",
      leftSprite: "sprites/playerl.png"
    },
    bolt: {
      id: "bolt",
      name: "Luigi",
      atlasId: "luigi",
      primary: "#FF6B6B",
      accent: "#56C7FF",
      sprite: "sprites/player.png",
      leftSprite: "sprites/playerl.png"
    }
  });

  return Object.freeze({
    GAME_TITLE: "Pixel Quest Duo",
    ROOM_STATUS: ROOM_STATUS,
    ROUND_STATES: ROUND_STATES,
    PLAYER_STATES: PLAYER_STATES,
    ROOM_CODE_LENGTH: 6,
    ROOM_CODE_ALPHABET: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
    ROOM_CAPACITY: 2,
    RECONNECT_GRACE_MS: 20000,
    WAITING_ROOM_TTL_MS: 30 * 60 * 1000,
    SERVER_TICK_RATE: 30,
    SNAPSHOT_RATE: 20,
    MATCH_SECONDS: 240,
    DEATH_ANIMATION_MS: 1200,
    GAME_OVER_PRESENTATION_MS: 2000,
    GAME_OVER_RESTART_MS: 5000,
    ROUND_RESTART_COUNTDOWN_MS: 3000,
    LASER_COOLDOWN_MS: 400,
    LASER_LIFETIME_MS: 850,
    LASER_SPEED: 430,
    LASER_WIDTH: 12,
    LASER_HEIGHT: 3,
    MAX_ACTIVE_LASERS_PER_PLAYER: 2,
    SHOOT_ANIMATION_MS: 180,
    LOGICAL_WIDTH: 384,
    LOGICAL_HEIGHT: 216,
    TILE_SIZE: 16,
    LEVEL_WIDTH: 7200,
    LEVEL_HEIGHT: 240,
    PLAYER_WIDTH: 14,
    PLAYER_HEIGHT: 16,
    PLAYER_SMALL_HEIGHT: 16,
    PLAYER_SUPER_HEIGHT: 32,
    CHARACTERS: CHARACTERS,
    DEFAULT_CHARACTER: "nova"
  });
});
