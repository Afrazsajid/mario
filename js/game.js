(function () {
  "use strict";

  var constants = window.PQDConstants;
  var protocol = window.PQDProtocol;
  var validation = window.PQDValidation;
  var levelData = window.PQDLevelData;
  var physics = window.PQDPhysics;
  var interpolation = window.PQDInterpolation;
  var NetworkClient = window.PQDNetworkClient;
  var C = protocol.CLIENT_EVENTS;
  var S = protocol.SERVER_EVENTS;

  var canvas = document.getElementById("gameCanvas");
  var ctx = canvas.getContext("2d");
  var screenLayer = document.getElementById("screenLayer");
  var hud = document.getElementById("hud");
  var pauseOverlay = document.getElementById("pauseOverlay");
  var countdownEl = document.getElementById("countdown");
  var toastRegion = document.getElementById("toastRegion");
  var srStatus = document.getElementById("srStatus");
  var hudP1 = document.getElementById("hudP1");
  var hudP2 = document.getElementById("hudP2");
  var matchTimer = document.getElementById("matchTimer");
  var levelTitle = document.getElementById("levelTitle");
  var teamProgress = document.getElementById("teamProgress");
  var roomHud = document.getElementById("roomHud");

  var world = levelData.createWorld();
  var network = new NetworkClient(protocol);
  var socket = network.connect();
  var prediction = window.PQDPrediction.createPrediction(world, physics);
  var displayPlayers = {};
  var snapshot = null;
  var room = null;
  if (new URLSearchParams(window.location.search).get("fresh") === "1") {
    sessionStorage.removeItem("pqd.playerId");
    sessionStorage.removeItem("pqd.reconnectToken");
    sessionStorage.removeItem("pqd.roomCode");
  }
  var playerId = sessionStorage.getItem("pqd.playerId") || "";
  var reconnectToken = sessionStorage.getItem("pqd.reconnectToken") || "";
  var roomCode = sessionStorage.getItem("pqd.roomCode") || "";
  var selectedCharacter = localStorage.getItem("pqd.character") || constants.DEFAULT_CHARACTER;
  var playerName = localStorage.getItem("pqd.name") || "Player";
  var muted = localStorage.getItem("pqd.muted") === "true";
  var musicVolume = Number(localStorage.getItem("pqd.musicVolume") || 0.42);
  var effectsVolume = Number(localStorage.getItem("pqd.effectsVolume") || 0.68);
  var lastFrame = performance.now();
  var accumulator = 0;
  var inputSequence = 0;
  var camera = { x: 0, y: 0, shake: 0 };
  var renderScale = 1;
  var renderOffset = { x: 0, y: 0 };
  var loadingProgress = 0;
  var appState = "loading";
  var resultState = null;
  var paused = false;
  var lastInputSentAt = 0;
  var lastRoundId = null;
  var gameOverScreen = null;
  var spectatorBanner = null;

  var sounds = {};
  var music = {};
  var assetList = [
    "sprites/player.png",
    "sprites/playerl.png",
    "sprites/enemy.png",
    "sprites/enemyr.png",
    "sprites/tiles.png",
    "sprites/items.png",
    "sprites/cloud-transparent.png",
    "sprites/game-over-title.png"
  ];

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function icon(kind) {
    var paths = {
      sound: "M4 9v6h4l5 4V5L8 9H4Zm12 1.5c1.1 1.1 1.1 2.9 0 4",
      full: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
      copy: "M8 8h10v12H8z M6 16H4V4h12v2",
      play: "M8 5v14l11-7z",
      back: "M19 12H5M12 5l-7 7 7 7"
    };
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "22");
    svg.setAttribute("height", "22");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    path.setAttribute("d", paths[kind] || paths.play);
    svg.appendChild(path);
    return svg;
  }

  function makeButton(label, className, onClick, iconName) {
    var button = el("button", "btn " + (className || ""));
    button.type = "button";
    if (iconName) button.appendChild(icon(iconName));
    if (label) button.appendChild(document.createTextNode((iconName ? " " : "") + label));
    button.addEventListener("click", onClick);
    return button;
  }

  function announce(message) {
    srStatus.textContent = message;
  }

  function toast(message, tone) {
    var node = el("div", "toast" + (tone ? " toast-" + tone : ""), message);
    toastRegion.appendChild(node);
    while (toastRegion.children.length > 3) {
      toastRegion.removeChild(toastRegion.firstChild);
    }
    setTimeout(function () {
      node.classList.add("toast-exit");
      setTimeout(function () { node.remove(); }, 260);
    }, 2600);
    announce(message);
  }

  function savePrefs() {
    localStorage.setItem("pqd.name", playerName);
    localStorage.setItem("pqd.character", selectedCharacter);
    localStorage.setItem("pqd.muted", String(muted));
    localStorage.setItem("pqd.musicVolume", String(musicVolume));
    localStorage.setItem("pqd.effectsVolume", String(effectsVolume));
  }

  function initAudio() {
    music.overworld = new Audio("sounds/aboveground_bgm.ogg");
    music.underground = new Audio("sounds/underground_bgm.ogg");
    music.clear = new Audio("sounds/stage_clear.wav");
    Object.keys(music).forEach(function (key) {
      music[key].loop = key !== "clear";
      music[key].volume = muted ? 0 : musicVolume;
    });
    ["coin", "stomp", "jump-small", "powerup", "flagpole", "pipe", "kick", "mariodie", "fireball"].forEach(function (name) {
      sounds[name] = new Audio("sounds/" + name + (name.indexOf("jump") === 0 ? ".wav" : ".wav"));
      sounds[name].volume = muted ? 0 : effectsVolume;
    });
  }

  function unlockAudio() {
    if (music.overworld && appState === "game") {
      music.overworld.volume = muted ? 0 : musicVolume;
      music.overworld.play().catch(function () {});
    }
  }

  function playSound(name) {
    var sound = sounds[name];
    if (!sound || muted) return;
    sound.currentTime = 0;
    sound.volume = effectsVolume;
    sound.play().catch(function () {});
  }

  function applyAudioPrefs() {
    Object.keys(music).forEach(function (key) { music[key].volume = muted ? 0 : musicVolume; });
    Object.keys(sounds).forEach(function (key) { sounds[key].volume = muted ? 0 : effectsVolume; });
    savePrefs();
  }

  function resizeCanvas() {
    var dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    var width = window.innerWidth;
    var height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderScale = Math.min(width / constants.LOGICAL_WIDTH, height / constants.LOGICAL_HEIGHT);
    renderOffset.x = (width - constants.LOGICAL_WIDTH * renderScale) / 2;
    renderOffset.y = (height - constants.LOGICAL_HEIGHT * renderScale) / 2;
  }

  function showLoading() {
    appState = "loading";
    hud.classList.add("hidden");
    clear(screenLayer);
    var panel = el("section", "shell-panel");
    var logo = el("div", "logo");
    logo.appendChild(el("h1", "", constants.GAME_TITLE));
    logo.appendChild(el("p", "", "Loading world, sounds and network..."));
    var bar = el("div", "loading-bar");
    bar.appendChild(el("span"));
    var status = el("p", "muted", "Loading world");
    panel.appendChild(logo);
    panel.appendChild(bar);
    panel.appendChild(status);
    screenLayer.appendChild(panel);

    var timer = setInterval(function () {
      loadingProgress = Math.min(100, loadingProgress + 14);
      status.textContent = loadingProgress < 45 ? "Loading world" : loadingProgress < 80 ? "Loading sounds" : "Connecting";
      if (resources.isReady() && loadingProgress >= 100) {
        clearInterval(timer);
        var inviteCode = new URLSearchParams(window.location.search).get("room");
        if (inviteCode) showJoin(inviteCode.toUpperCase());
        else showMenu();
      }
    }, 160);
  }

  function characterButtons(onChange) {
    var wrap = el("div", "character-list");
    Object.keys(constants.CHARACTERS).forEach(function (id) {
      var character = constants.CHARACTERS[id];
      var button = el("button", "character-option");
      button.type = "button";
      button.setAttribute("aria-pressed", String(selectedCharacter === id));
      var dot = el("span", "avatar-dot");
      dot.style.background = "linear-gradient(135deg, " + character.primary + ", " + character.accent + ")";
      button.appendChild(dot);
      button.appendChild(document.createTextNode(character.name));
      button.addEventListener("click", function () {
        selectedCharacter = id;
        savePrefs();
        if (onChange) onChange(id);
        Array.from(wrap.children).forEach(function (child) { child.setAttribute("aria-pressed", "false"); });
        button.setAttribute("aria-pressed", "true");
      });
      wrap.appendChild(button);
    });
    return wrap;
  }

  function profileForm() {
    var stack = el("div", "stack");
    var nameField = el("label", "field");
    nameField.appendChild(el("span", "", "Player name"));
    var nameInput = el("input", "input");
    nameInput.maxLength = 16;
    nameInput.value = playerName;
    nameInput.autocomplete = "nickname";
    nameInput.addEventListener("change", function () {
      var result = validation.validateName(nameInput.value);
      if (result.ok) {
        playerName = result.value;
        nameInput.value = result.value;
        savePrefs();
      } else {
        toast(result.error);
      }
    });
    nameField.appendChild(nameInput);
    stack.appendChild(nameField);
    stack.appendChild(el("div", "section-label", "Character"));
    stack.appendChild(characterButtons(function (id) {
      if (room) network.emit(C.CHARACTER, { character: id });
    }));
    return stack;
  }

  function settingsControls() {
    var stack = el("div", "stack");
    var actions = el("div", "actions");
    actions.appendChild(makeButton(muted ? "Unmute" : "Mute", "ghost", function () {
      muted = !muted;
      applyAudioPrefs();
      showMenu();
    }, "sound"));
    actions.appendChild(makeButton("Fullscreen", "ghost", toggleFullscreen, "full"));
    actions.appendChild(makeButton("Controls", "ghost", showControlsModal));
    stack.appendChild(actions);

    [["Music volume", "music"], ["Effects volume", "effects"]].forEach(function (config) {
      var field = el("label", "field");
      field.appendChild(el("span", "", config[0]));
      var input = el("input", "input");
      input.type = "range";
      input.min = "0";
      input.max = "1";
      input.step = "0.05";
      input.value = config[1] === "music" ? musicVolume : effectsVolume;
      input.addEventListener("input", function () {
        if (config[1] === "music") musicVolume = Number(input.value);
        else effectsVolume = Number(input.value);
        applyAudioPrefs();
      });
      field.appendChild(input);
      stack.appendChild(field);
    });
    return stack;
  }

  function showMenu() {
    appState = "menu";
    paused = false;
    hud.classList.add("hidden");
    pauseOverlay.classList.add("hidden");
    clear(screenLayer);
    var panel = el("section", "shell-panel");
    var brand = el("div", "brand");
    var logo = el("div", "logo");
    logo.appendChild(el("h1", "", constants.GAME_TITLE));
    logo.appendChild(el("p", "", "Private-room platforming for two friends."));
    brand.appendChild(logo);
    panel.appendChild(brand);
    var grid = el("div", "menu-grid");
    var left = profileForm();
    var actionGroup = el("div", "actions");
    actionGroup.appendChild(makeButton("Create Private Game", "", createRoom));
    actionGroup.appendChild(makeButton("Join Game", "secondary", function () { showJoin(""); }));
    left.appendChild(actionGroup);
    var right = settingsControls();
    var notice = el("p", "muted", "Desktop keyboard play is recommended. Invite links use this page origin plus ?room=ROOMCODE.");
    right.appendChild(notice);
    grid.appendChild(left);
    grid.appendChild(right);
    panel.appendChild(grid);
    screenLayer.appendChild(panel);
  }

  function showJoin(prefill) {
    appState = "join";
    clear(screenLayer);
    var panel = el("section", "shell-panel");
    var logo = el("div", "logo");
    logo.appendChild(el("h2", "", "Join Game"));
    logo.appendChild(el("p", "", "Enter the private room code from your teammate."));
    panel.appendChild(logo);
    var grid = el("div", "menu-grid");
    var left = profileForm();
    var codeField = el("label", "field");
    codeField.appendChild(el("span", "", "Room code"));
    var inputCode = el("input", "input");
    inputCode.maxLength = 6;
    inputCode.value = prefill || "";
    inputCode.autocapitalize = "characters";
    codeField.appendChild(inputCode);
    left.appendChild(codeField);
    var actions = el("div", "actions");
    actions.appendChild(makeButton("Join Room", "", function () { joinRoom(inputCode.value); }));
    actions.appendChild(makeButton("Back", "ghost", showMenu, "back"));
    left.appendChild(actions);
    grid.appendChild(left);
    grid.appendChild(settingsControls());
    panel.appendChild(grid);
    screenLayer.appendChild(panel);
    inputCode.focus();
  }

  function validProfile() {
    var name = validation.validateName(playerName);
    if (!name.ok) {
      toast(name.error);
      return null;
    }
    playerName = name.value;
    savePrefs();
    return { name: playerName, character: selectedCharacter };
  }

  function createRoom() {
    var profile = validProfile();
    if (!profile) return;
    unlockAudio();
    network.emit(C.CREATE_ROOM, profile);
  }

  function joinRoom(code) {
    var profile = validProfile();
    if (!profile) return;
    var validCode = validation.validateRoomCode(code);
    if (!validCode.ok) return toast(validCode.error);
    unlockAudio();
    network.emit(C.JOIN_ROOM, {
      roomCode: validCode.value,
      name: profile.name,
      character: profile.character,
      playerId: playerId,
      reconnectToken: reconnectToken
    });
  }

  function showCreateRoom(created) {
    room = created.room;
    playerId = created.playerId;
    reconnectToken = created.reconnectToken;
    roomCode = created.roomCode;
    sessionStorage.setItem("pqd.playerId", playerId);
    sessionStorage.setItem("pqd.reconnectToken", reconnectToken);
    sessionStorage.setItem("pqd.roomCode", roomCode);
    showLobby(room);
    toast("Private room created.");
  }

  function inviteLink() {
    return window.location.origin + "/?room=" + (room ? room.roomCode : roomCode);
  }

  function copyText(text, label) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { toast(label + " copied."); }).catch(function () { toast("Copy failed."); });
    } else {
      toast(text);
    }
  }

  function showLobby(state) {
    appState = "lobby";
    room = state;
    hud.classList.add("hidden");
    clear(screenLayer);
    var panel = el("section", "shell-panel");
    var brand = el("div", "brand");
    var logo = el("div", "logo");
    logo.appendChild(el("h2", "", "Lobby"));
    logo.appendChild(el("p", "", "Ready up, then the host starts the countdown."));
    brand.appendChild(logo);
    panel.appendChild(brand);
    var grid = el("div", "lobby-grid");
    var left = el("div", "stack");
    var codeBox = el("div", "code-box");
    codeBox.appendChild(el("span", "section-label", "Room code"));
    codeBox.appendChild(el("strong", "room-code", state.roomCode));
    var codeActions = el("div", "actions");
    codeActions.appendChild(makeButton("Copy Invite", "ghost", function () { copyText(inviteLink(), "Invite link"); }, "copy"));
    codeActions.appendChild(makeButton("Copy Code", "ghost", function () { copyText(state.roomCode, "Room code"); }, "copy"));
    if (navigator.share) codeActions.appendChild(makeButton("Share", "ghost", function () { navigator.share({ title: constants.GAME_TITLE, url: inviteLink() }).catch(function () {}); }));
    codeBox.appendChild(codeActions);
    left.appendChild(codeBox);
    var playerCards = el("div", "stack");
    for (var i = 0; i < constants.ROOM_CAPACITY; i += 1) playerCards.appendChild(lobbyPlayerCard(state.players[i], i));
    left.appendChild(playerCards);

    var right = el("div", "stack");
    right.appendChild(el("div", "section-label", "Change character"));
    right.appendChild(characterButtons(function (id) { network.emit(C.CHARACTER, { character: id }); }));
    var me = currentPlayer();
    var ready = me && me.ready;
    var actions = el("div", "actions");
    actions.appendChild(makeButton(ready ? "Unready" : "Ready", ready ? "ghost" : "", function () { network.emit(C.READY, { ready: !ready }); }));
    var start = makeButton("Start Match", "secondary", function () { network.emit(C.START, {}); }, "play");
    start.disabled = !(me && me.host && state.canStart);
    actions.appendChild(start);
    actions.appendChild(makeButton("Leave Lobby", "danger", leaveRoom));
    actions.appendChild(makeButton("Fullscreen", "ghost", toggleFullscreen, "full"));
    right.appendChild(actions);
    right.appendChild(el("p", "muted", state.players.length < 2 ? "Waiting for teammate..." : "Both players are connected. Ready status decides when the match can start."));
    grid.appendChild(left);
    grid.appendChild(right);
    panel.appendChild(grid);
    screenLayer.appendChild(panel);
  }

  function lobbyPlayerCard(player, slot) {
    var card = el("article", "player-card stack");
    if (!player) {
      card.appendChild(el("strong", "", "Player " + (slot + 1)));
      card.appendChild(el("p", "muted", "Waiting for teammate"));
      return card;
    }
    var character = constants.CHARACTERS[player.character] || constants.CHARACTERS.nova;
    var title = el("strong");
    var dot = el("span", "avatar-dot");
    dot.style.background = "linear-gradient(135deg, " + character.primary + ", " + character.accent + ")";
    title.appendChild(dot);
    title.appendChild(document.createTextNode(player.name));
    card.appendChild(title);
    var meta = el("div", "actions");
    if (player.host) meta.appendChild(el("span", "badge", "Host"));
    meta.appendChild(el("span", "badge", player.connected ? "Connected" : "Reconnecting"));
    meta.appendChild(el("span", "badge", player.ready ? "Ready" : "Not ready"));
    card.appendChild(meta);
    card.appendChild(el("p", "muted", character.name + " · ping " + (player.ping || 0) + "ms"));
    return card;
  }

  function currentPlayer() {
    return room && room.players ? room.players.find(function (player) { return player.id === playerId; }) : null;
  }

  function leaveRoom() {
    network.emit(C.LEAVE_ROOM, {});
    sessionStorage.removeItem("pqd.roomCode");
    room = null;
    snapshot = null;
    showMenu();
  }

  function enterGame(initialSnapshot) {
    appState = "game";
    paused = false;
    snapshot = initialSnapshot;
    lastRoundId = initialSnapshot && initialSnapshot.roundId ? initialSnapshot.roundId : lastRoundId;
    world = levelData.createWorld();
    prediction = window.PQDPrediction.createPrediction(world, physics);
    prediction.clear();
    var me = playerSnapshot(playerId);
    if (me && isControllablePlayer(me)) prediction.setAuthoritative(me.state, me.inputAck || 0);
    clear(screenLayer);
    hud.classList.remove("hidden");
    pauseOverlay.classList.add("hidden");
    countdownEl.classList.add("hidden");
    if (gameOverScreen) gameOverScreen.hide();
    if (spectatorBanner) spectatorBanner.classList.add("hidden");
    displayPlayers = {};
    music.overworld.play().catch(function () {});
    toast("GO!");
  }

  function playerSnapshot(id) {
    return snapshot && snapshot.players ? snapshot.players.find(function (player) { return player.id === id; }) : null;
  }

  function isRoundPlaying() {
    return snapshot && snapshot.roundState === constants.ROUND_STATES.PLAYING;
  }

  function isControllablePlayer(player) {
    return player && player.state && player.state.playerState === constants.PLAYER_STATES.ACTIVE;
  }

  function localPlayerCanControl() {
    return appState === "game" && !paused && isRoundPlaying() && isControllablePlayer(playerSnapshot(playerId));
  }

  function activePlayerToWatch() {
    if (!snapshot || !snapshot.players) return null;
    return snapshot.players.find(function (player) {
      return player.state && player.state.playerState === constants.PLAYER_STATES.ACTIVE;
    }) || null;
  }

  function resetClientRound(next) {
    world = levelData.createWorld();
    prediction = window.PQDPrediction.createPrediction(world, physics);
    prediction.clear();
    displayPlayers = {};
    input.reset();
    inputSequence = 0;
    lastRoundId = next.roundId || lastRoundId;
    if (gameOverScreen) gameOverScreen.hide();
    if (spectatorBanner) spectatorBanner.classList.add("hidden");
  }

  function createSpectatorBanner() {
    var banner = el("div", "spectator-banner hidden");
    banner.appendChild(el("strong", "", "Spectating"));
    banner.appendChild(el("span", "muted", "Watching the run"));
    document.getElementById("app").appendChild(banner);
    return banner;
  }

  function updateSpectatorBanner() {
    if (!spectatorBanner || !snapshot || !snapshot.players) return;
    var me = playerSnapshot(playerId);
    var spectating = me && me.state && me.state.playerState === constants.PLAYER_STATES.SPECTATING;
    spectatorBanner.classList.toggle("hidden", !spectating);
    if (!spectating) return;
    var watched = activePlayerToWatch();
    spectatorBanner.children[1].textContent = watched ? "Watching " + watched.name : "Waiting for restart";
  }

  function updateRoundPresentation() {
    if (gameOverScreen) gameOverScreen.update(snapshot, room ? room.roomCode : roomCode);
    updateSpectatorBanner();
  }

  function showResults(result) {
    appState = "results";
    resultState = result;
    hud.classList.add("hidden");
    clear(screenLayer);
    var panel = el("section", "shell-panel");
    var logo = el("div", "logo");
    var winnerText = result.winner && result.winner.draw ? "It is a draw!" : "Winner";
    if (result.winner && result.winner.winnerId) {
      var winner = result.players.find(function (player) { return player.id === result.winner.winnerId; });
      winnerText = winner ? winner.name + " wins!" : "Winner decided";
    }
    logo.appendChild(el("h2", "", winnerText));
    logo.appendChild(el("p", "", "Match ended: " + result.reason));
    panel.appendChild(logo);
    var grid = el("div", "results-grid");
    result.players.forEach(function (player) { grid.appendChild(summaryCard(player, result.winner && result.winner.winnerId === player.id)); });
    panel.appendChild(grid);
    var actions = el("div", "actions");
    actions.appendChild(makeButton("Play Again", "", function () { network.emit(C.RESTART_VOTE, { wantsRestart: true }); }));
    actions.appendChild(makeButton("Return to Lobby", "secondary", function () { network.emit(C.RETURN_TO_LOBBY, {}); }));
    actions.appendChild(makeButton("Copy Invite Link", "ghost", function () { copyText(inviteLink(), "Invite link"); }, "copy"));
    actions.appendChild(makeButton("Leave Room", "danger", leaveRoom));
    panel.appendChild(actions);
    screenLayer.appendChild(panel);
    playSound("flagpole");
    music.overworld.pause();
    music.clear.play().catch(function () {});
  }

  function summaryCard(player, winner) {
    var card = el("article", "summary-card stack");
    if (winner) card.classList.add("leader");
    card.appendChild(el("strong", "", player.name));
    card.appendChild(el("span", "badge", winner ? "Winner" : "Final"));
    [
      ["Score", player.stats.score],
      ["Coins", player.stats.coins],
      ["Enemies", player.stats.enemiesDefeated],
      ["Power-ups", player.stats.powerUps],
      ["Deaths", player.stats.deaths],
      ["Highest combo", "x" + player.stats.highestCombo]
    ].forEach(function (row) {
      var line = el("div", "hud-line");
      line.appendChild(el("span", "", row[0]));
      line.appendChild(el("strong", "", String(row[1])));
      card.appendChild(line);
    });
    return card;
  }

  function showControlsModal() {
    pauseOverlay.classList.remove("hidden");
    clear(pauseOverlay);
    var modal = el("section", "modal stack");
    modal.appendChild(el("h2", "", "Controls"));
    ["Move: A/D or Arrow Keys", "Jump: Space or X", "Run: Shift or Z", "Action: F", "Interact: E", "Pause: Escape", "Mute: M", "Fullscreen: F11 or button"].forEach(function (text) {
      modal.appendChild(el("p", "muted", text));
    });
    modal.appendChild(makeButton("Close", "", function () {
      pauseOverlay.classList.add("hidden");
      if (appState === "game") paused = false;
    }));
    pauseOverlay.appendChild(modal);
  }

  function togglePause() {
    if (appState !== "game") {
      if (!pauseOverlay.classList.contains("hidden")) pauseOverlay.classList.add("hidden");
      return;
    }
    paused = !paused;
    if (!paused) {
      pauseOverlay.classList.add("hidden");
      input.reset();
      return;
    }
    clear(pauseOverlay);
    pauseOverlay.classList.remove("hidden");
    var modal = el("section", "modal stack");
    modal.appendChild(el("h2", "", "Paused"));
    var actions = el("div", "actions");
    actions.appendChild(makeButton("Resume", "", togglePause));
    actions.appendChild(makeButton("Controls", "ghost", showControlsModal));
    actions.appendChild(makeButton("Fullscreen", "ghost", toggleFullscreen, "full"));
    actions.appendChild(makeButton("Leave Match", "danger", leaveRoom));
    modal.appendChild(actions);
    modal.appendChild(settingsControls());
    pauseOverlay.appendChild(modal);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(function () { toast("Fullscreen permission was denied."); });
    } else {
      document.exitFullscreen().catch(function () {});
    }
  }

  function setupNetwork() {
    network.on(S.ROOM_CREATED, showCreateRoom);
    network.on(S.ROOM_JOINED, function (joined) {
      playerId = joined.playerId;
      reconnectToken = joined.reconnectToken;
      roomCode = joined.roomCode;
      room = joined.room;
      sessionStorage.setItem("pqd.playerId", playerId);
      sessionStorage.setItem("pqd.reconnectToken", reconnectToken);
      sessionStorage.setItem("pqd.roomCode", roomCode);
      if (joined.snapshot) {
        snapshot = joined.snapshot;
        enterGame(joined.snapshot);
      } else {
        showLobby(room);
      }
      toast("Joined room " + roomCode + ".");
    });
    network.on(S.ROOM_STATE, function (state) {
      room = state;
      if (appState === "lobby" || appState === "join" || appState === "menu" || appState === "results") showLobby(state);
    });
    network.on(S.ERROR, function (error) {
      toast(error.message || "Something went wrong.");
    });
    network.on(S.COUNTDOWN, function (data) {
      countdownEl.classList.remove("hidden");
      countdownEl.textContent = data.remaining > 0 ? String(data.remaining) : "GO";
      if (data.remaining <= 0) setTimeout(function () { countdownEl.classList.add("hidden"); }, 700);
    });
    network.on(S.GAME_START, enterGame);
    network.on(S.ROUND_RESET, function (next) {
      handleSnapshot(next);
    });
    network.on(S.ROUND_GAME_OVER, function (event) {
      if (snapshot && event.roundId && event.roundId !== snapshot.roundId) return;
      if (gameOverScreen) gameOverScreen.update(snapshot, room ? room.roomCode : roomCode);
    });
    network.on(S.SNAPSHOT, handleSnapshot);
    network.on(S.GAME_EVENT, handleGameEvent);
    network.on(S.GAME_OVER, showResults);
    network.on(S.RESTART_STATUS, function () { toast("Rematch vote updated."); });
    network.on(S.PLAYER_LEFT, function (data) { toast(data.reconnecting ? "Player reconnecting..." : "Player left."); });
    setInterval(function () {
      if (socket.connected) network.emit(C.PING, { clientTime: Date.now() });
    }, 2000);
  }

  function handleSnapshot(next) {
    var previousRoundId = snapshot && snapshot.roundId;
    stampLocalShootingWindows(next);
    snapshot = next;
    if (next && next.roundId && previousRoundId && next.roundId !== previousRoundId) resetClientRound(next);
    else if (next && next.roundId && !lastRoundId) lastRoundId = next.roundId;
    var me = playerSnapshot(playerId);
    if (me && localPlayerCanControl()) prediction.setAuthoritative(me.state, me.inputAck || 0);
    else {
      prediction.clear();
      input.reset();
    }
    updateRoundPresentation();
  }

  function stampLocalShootingWindows(next) {
    if (!next || !next.players || !next.serverTime) return;
    var now = Date.now();
    next.players.forEach(function (player) {
      if (!player.state || !player.state.shootingUntil) return;
      player.state.shootingUntilLocal = now + Math.max(0, player.state.shootingUntil - next.serverTime);
    });
  }

  function handleGameEvent(event) {
    if (snapshot && event.roundId && event.roundId !== snapshot.roundId) return;
    var player = snapshot && snapshot.players ? snapshot.players.find(function (p) { return p.id === event.playerId; }) : null;
    if (event.type === "player:dying") {
      playSound("mariodie");
      toast((player ? player.name : "Player") + " " + deathReasonText(event.reason), "warning");
      return;
    }
    if (event.type === "player:spectating") return;
    if (event.type === "round:lastPlayer") {
      toast((player ? player.name : "Player") + " is the last runner.", "warning");
      return;
    }
    if (event.type === "round:gameOver" || event.type === "round:restarting") {
      updateRoundPresentation();
      return;
    }
    if (event.type === "checkpoint:activated") {
      playSound("powerup");
      camera.shake = Math.max(camera.shake, 1);
      toast((player ? player.name : "Player") + " reached a checkpoint.", "score");
      return;
    }
    if (event.type === "laser:fire") {
      playSound("fireball");
      return;
    }
    if (event.type === "laser:hit") {
      playSound("stomp");
      camera.shake = Math.max(camera.shake, 1.2);
      return;
    }
    if (event.type === "enemy:shellHit") {
      playSound("stomp");
      camera.shake = Math.max(camera.shake, 1.4);
      toast("Shell chain!", "score");
      return;
    }
    if (event.type === "coin") playSound("coin");
    if (event.type.indexOf("enemy") === 0) playSound("stomp");
    if (typeof event.delta !== "number") return;
    if (event.delta > 0) camera.shake = Math.max(camera.shake, 1.4);
    toast((player ? player.name : "Player") + " +" + event.delta, event.delta > 0 ? "score" : "warning");
  }

  function deathReasonText(reason) {
    if (reason === "fall") return "fell.";
    if (reason === "enemy") return "was hit.";
    if (reason === "timer") return "ran out of time.";
    return "is out.";
  }

  function sendInput(now) {
    if (!localPlayerCanControl() || now - lastInputSentAt < 1000 / 60) return;
    lastInputSentAt = now;
    var packet = input.snapshot();
    packet.sequence = ++inputSequence;
    packet.clientTime = Date.now();
    network.emit(C.INPUT, packet);
    var predicted = prediction.applyInput(packet);
    var me = playerSnapshot(playerId);
    if (me && predicted) me.state = predicted;
  }

  function updateHud() {
    if (!snapshot || !snapshot.players) return;
    updateRoundPresentation();
    var p1 = snapshot.players[0];
    var p2 = snapshot.players[1];
    renderHudCard(hudP1, p1, p1 && p2 && p1.stats.score >= p2.stats.score);
    renderHudCard(hudP2, p2, p2 && p1 && p2.stats.score > p1.stats.score);
    var seconds = snapshot.remainingSeconds || 0;
    matchTimer.textContent = seconds > 0 ? Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0") : "ENDLESS";
    levelTitle.textContent = snapshot.level ? snapshot.level.title : world.title;
    var maxProgress = 0;
    snapshot.players.forEach(function (player) {
      if (player.state) {
        var targetDistance = snapshot.level && snapshot.level.endless ? 5000 : world.finishX;
        maxProgress = Math.max(maxProgress, Math.min(100, (player.state.x / targetDistance) * 100));
      }
    });
    teamProgress.style.width = maxProgress + "%";
    roomHud.textContent = "Room " + (room ? room.roomCode : roomCode || "------");
  }

  function renderHudCard(target, player, leader) {
    clear(target);
    if (!player) {
      target.appendChild(el("strong", "", "Waiting"));
      target.appendChild(el("span", "muted", "No teammate"));
      return;
    }
    target.classList.toggle("leader", !!leader);
    var title = el("strong", "hud-player-name");
    title.appendChild(document.createTextNode(player.name));
    if (leader) title.appendChild(el("span", "leader-mark", "CROWN"));
    target.appendChild(title);
    target.appendChild(el("span", "badge", player.state && player.state.playerState ? player.state.playerState : "active"));
    [
      ["Score", player.stats.score],
      ["Coins", player.stats.coins],
      ["Combo", "x" + player.stats.combo],
      ["Ping", (player.ping || 0) + "ms"]
    ].forEach(function (row) {
      var line = el("div", "hud-line");
      line.appendChild(el("span", "", row[0]));
      line.appendChild(el("span", "", String(row[1])));
      target.appendChild(line);
    });
  }

  function cameraTarget() {
    var me = playerSnapshot(playerId);
    if (!me) return { x: 0, y: 0, facing: 1, vx: 0 };
    if (me.state && (
      me.state.playerState === constants.PLAYER_STATES.ACTIVE ||
      me.state.playerState === constants.PLAYER_STATES.DYING ||
      me.state.playerState === constants.PLAYER_STATES.FINISHED
    )) return me.state;
    var watched = activePlayerToWatch();
    if (watched && watched.state) return watched.state;
    var visible = snapshot && snapshot.players ? snapshot.players.find(function (player) {
      return player.state && player.state.playerState !== constants.PLAYER_STATES.SPECTATING;
    }) : null;
    if (visible) return visible.state;
    return me.state;
  }

  function updateCamera(dt) {
    var target = cameraTarget();
    var lookAhead = Math.max(-50, Math.min(50, target.vx * 0.32 + target.facing * 22));
    var desiredX = target.x - constants.LOGICAL_WIDTH * 0.42 + lookAhead;
    var desiredY = target.y - constants.LOGICAL_HEIGHT * 0.58;
    camera.x = interpolation.lerp(camera.x, desiredX, 1 - Math.pow(0.001, dt));
    camera.y = interpolation.lerp(camera.y, desiredY, 1 - Math.pow(0.002, dt));
    camera.x = Math.max(0, Math.min(world.width - constants.LOGICAL_WIDTH, camera.x));
    camera.y = Math.max(0, Math.min(world.height - constants.LOGICAL_HEIGHT + 20, camera.y));
    camera.shake = Math.max(0, camera.shake - dt * 6);
  }

  function draw() {
    var width = window.innerWidth;
    var height = window.innerHeight;
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
    drawAtmosphere(width, height);
    ctx.save();
    ctx.translate(renderOffset.x, renderOffset.y);
    ctx.scale(renderScale, renderScale);
    ctx.beginPath();
    ctx.rect(0, 0, constants.LOGICAL_WIDTH, constants.LOGICAL_HEIGHT);
    ctx.clip();
    if (camera.shake > 0) ctx.translate((Math.random() - 0.5) * camera.shake * 2, (Math.random() - 0.5) * camera.shake * 2);
    drawWorld();
    drawEntities();
    ctx.restore();
  }

  function drawAtmosphere(width, height) {
    var theme = currentTheme();
    var sky = theme === "underground" ? "#05070F" : "#5C84FC";
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
  }

  function worldX(x) { return Math.round(x - camera.x); }
  function worldY(y) { return Math.round(y - camera.y); }

  function currentTheme() {
    return snapshot && snapshot.level && snapshot.level.theme ? snapshot.level.theme : world.theme || "aboveground";
  }

  function drawTile(img, frame, x, y) {
    if (!img || !frame) return;
    ctx.drawImage(img, frame.sx, frame.sy, frame.sw, frame.sh, worldX(x), worldY(y), 16, 16);
  }

  function tileFrameFor(solid, x, y) {
    var frames = window.PQDSpriteAtlas.TILE_FRAMES;
    if (solid.id.indexOf("pipe") === 0) {
      var left = x === solid.x;
      var top = y === solid.y;
      if (top && left) return frames.pipeGreenTopLeft;
      if (top) return frames.pipeGreenTopRight;
      return left ? frames.pipeGreenMidLeft : frames.pipeGreenMidRight;
    }
    if (currentTheme() === "underground") return frames.underground;
    if (solid.id.indexOf("block") === 0) return frames.brickBrown;
    return frames.groundBrown;
  }

  function drawWorld() {
    window.PQDBackgroundRenderer.draw({
      ctx: ctx,
      resources: resources,
      cameraX: camera.x,
      cameraY: camera.y,
      viewportWidth: constants.LOGICAL_WIDTH,
      viewportHeight: constants.LOGICAL_HEIGHT,
      levelWidth: world.width,
      theme: currentTheme(),
      elapsedTime: performance.now() / 1000
    });
    var tiles = resources.get("sprites/tiles.png");
    world.solids.forEach(function (solid) {
      if (solid.type === "movingPlatform") return;
      if (solid.x + solid.w < camera.x || solid.x > camera.x + constants.LOGICAL_WIDTH) return;
      for (var x = solid.x; x < solid.x + solid.w; x += 16) {
        for (var y = solid.y; y < solid.y + solid.h; y += 16) {
          drawTile(tiles, tileFrameFor(solid, x, y), x, y);
        }
      }
    });
    drawMovingPlatforms(tiles);
    drawCheckpoints(tiles);
    ctx.fillStyle = "#35E4D0";
    ctx.fillRect(worldX(world.finishX), worldY(45), 2, 150);
  }

  function drawMovingPlatforms(tiles) {
    if (!tiles || !snapshot || !snapshot.movingPlatforms) return;
    var frame = window.PQDSpriteAtlas.TILE_FRAMES.usedBrown;
    snapshot.movingPlatforms.forEach(function (platform) {
      if (platform.x + platform.w < camera.x || platform.x > camera.x + constants.LOGICAL_WIDTH) return;
      for (var x = platform.x; x < platform.x + platform.w; x += 16) {
        drawTile(tiles, frame, x, platform.y);
      }
    });
  }

  function drawCheckpoints(tiles) {
    if (!snapshot || !snapshot.checkpoints) return;
    snapshot.checkpoints.forEach(function (checkpoint) {
      if (checkpoint.x + 24 < camera.x || checkpoint.x > camera.x + constants.LOGICAL_WIDTH) return;
      var x = worldX(checkpoint.x);
      var y = worldY(checkpoint.y);
      ctx.fillStyle = checkpoint.activated ? "#FFD85A" : "#F7FBFF";
      ctx.fillRect(x + 6, y, 2, 32);
      ctx.fillStyle = checkpoint.activated ? "#35E4D0" : "#FF6B6B";
      ctx.fillRect(x + 8, y + 2, 14, 8);
      if (tiles) drawTile(tiles, window.PQDSpriteAtlas.TILE_FRAMES.usedBrown, checkpoint.x - 1, checkpoint.y + 32);
    });
  }

  function drawEntities() {
    var collectedCoins = {};
    var collectedPowers = {};
    var enemyUpdates = {};
    if (snapshot) {
      (snapshot.coins || []).forEach(function (coin) { collectedCoins[coin.id] = true; });
      (snapshot.powerUps || []).forEach(function (power) { collectedPowers[power.id] = true; });
      (snapshot.enemies || []).forEach(function (enemy) { enemyUpdates[enemy.id] = enemy; });
    }
    var items = resources.get("sprites/items.png");
    world.coins.forEach(function (coin, index) {
      if (collectedCoins[coin.id]) return;
      var frame = Math.floor(performance.now() / 120 + index) % 4;
      if (items) ctx.drawImage(items, frame * 16, 96, 16, 16, worldX(coin.x - 4), worldY(coin.y - 4), 16, 16);
    });
    world.powerUps.forEach(function (power) {
      if (collectedPowers[power.id]) return;
      var sy = power.type === "star" ? 48 : power.type === "fireFlower" ? 32 : 0;
      if (items) ctx.drawImage(items, 0, sy, 16, 16, worldX(power.x), worldY(power.y), 16, 16);
    });
    var enemyImg = resources.get("sprites/enemy.png");
    var enemyImgR = resources.get("sprites/enemyr.png");
    world.enemies.forEach(function (enemy) {
      var current = enemyUpdates[enemy.id] || enemy;
      if (!current.alive) return;
      drawEnemySprite(enemyImg, enemyImgR, current);
    });
    drawEnemyProjectiles(enemyImg);
    drawLasers();
    if (!snapshot || !snapshot.players) return;
    drawPlayersAndLabels();
  }

  function drawEnemySprite(enemyImg, enemyImgR, enemy) {
    if (!window.PQDEnemyRegistry || !enemyImg) return;
    var frameSet = window.PQDEnemyRegistry.frameForType(enemy.type);
    var frames;
    var sourceImage = enemy.direction > 0 ? enemyImgR || enemyImg : enemyImg;
    if (enemy.type === "koopa" && (enemy.state === "shellStationary" || enemy.state === "shellMoving")) {
      frames = frameSet.shell || frameSet.enemy;
      sourceImage = enemyImg;
    } else {
      frames = enemy.direction > 0 && frameSet.enemyr ? frameSet.enemyr : frameSet.enemy;
    }
    var frame = frames[Math.floor(performance.now() / 180) % frames.length] || frames[0];
    var drawW = frameSet.drawWidth || frame.sw;
    var drawH = enemy.type === "koopa" && (enemy.state === "shellStationary" || enemy.state === "shellMoving") ? 16 : frameSet.drawHeight || frame.sh;
    var drawX = currentDrawX(enemy, drawW);
    var drawY = enemy.y + enemy.h - drawH;
    if (drawX + drawW < camera.x || drawX > camera.x + constants.LOGICAL_WIDTH) return;
    ctx.drawImage(sourceImage, frame.sx, frame.sy, frame.sw, frame.sh, worldX(drawX), worldY(drawY), drawW, drawH);
  }

  function currentDrawX(entity, drawW) {
    return entity.x + entity.w / 2 - drawW / 2;
  }

  function drawEnemyProjectiles(enemyImg) {
    if (!enemyImg || !snapshot || !snapshot.enemyProjectiles || !window.PQDEnemyRegistry) return;
    var projectileFrame = window.PQDEnemyRegistry.ENEMY_FRAMES.ranged.projectile;
    snapshot.enemyProjectiles.forEach(function (projectile) {
      if (projectile.x + projectile.w < camera.x || projectile.x > camera.x + constants.LOGICAL_WIDTH) return;
      ctx.drawImage(enemyImg, projectileFrame.sx, projectileFrame.sy, projectileFrame.sw, projectileFrame.sh, worldX(projectile.x - 3), worldY(projectile.y - 4), 16, 16);
    });
  }

  function drawLasers() {
    if (!snapshot || !snapshot.lasers) return;
    snapshot.lasers.forEach(function (laser) {
      var x = worldX(laser.x);
      var y = worldY(laser.y);
      var length = laser.w || constants.LASER_WIDTH || 12;
      var height = laser.h || constants.LASER_HEIGHT || 3;
      if (x + length < 0 || x > constants.LOGICAL_WIDTH || y + height < 0 || y > constants.LOGICAL_HEIGHT) return;
      ctx.save();
      ctx.fillStyle = "rgba(255, 216, 90, 0.55)";
      ctx.fillRect(Math.round(x - 2), Math.round(y - 1), length + 4, height + 2);
      ctx.fillStyle = "#fff7a8";
      ctx.fillRect(Math.round(x), Math.round(y), length, height);
      ctx.fillStyle = "#ff6b3d";
      ctx.fillRect(Math.round(x), Math.round(y + 1), length, 1);
      ctx.restore();
    });
  }

  function drawPlayersAndLabels() {
    var visible = [];
    var ordered = snapshot.players.slice().sort(function (a, b) {
      if (a.id === playerId) return 1;
      if (b.id === playerId) return -1;
      return 0;
    });
    ordered.forEach(function (player, index) {
      var target = player.state;
      if (!target) return;
      var existing = displayPlayers[player.id];
      displayPlayers[player.id] = existing ? interpolation.smoothPlayer(existing, target, player.id === playerId ? 0.8 : 0.24) : JSON.parse(JSON.stringify(target));
      var state = displayPlayers[player.id];
      if (state.x + state.w < camera.x || state.x > camera.x + constants.LOGICAL_WIDTH) return;
      var label = window.PQDPlayerRenderer.drawPlayer({
        ctx: ctx,
        resources: resources,
        player: player,
        state: state,
        cameraX: camera.x,
        cameraY: camera.y,
        localPlayerId: playerId,
        elapsedTime: performance.now() / 1000
      });
      if (label) {
        label.name = player.name || ("Player " + (index + 1));
        visible.push(label);
      }
    });
    window.PQDNameplateRenderer.draw(ctx, visible, { width: constants.LOGICAL_WIDTH, height: constants.LOGICAL_HEIGHT }, playerId);
    drawRemoteIndicator(visible);
  }

  function drawRemoteIndicator(visiblePlayers) {
    if (!snapshot || !snapshot.players) return;
    var remote = snapshot.players.find(function (player) { return player.id !== playerId; });
    if (!remote || !remote.state) return;
    if (remote.state.playerState === constants.PLAYER_STATES.SPECTATING || remote.state.playerState === constants.PLAYER_STATES.ELIMINATED) return;
    if (visiblePlayers.some(function (player) { return player.id === remote.id; })) return;
    var x = worldX(remote.state.x);
    var safeY = 54;
    var left = x < 0;
    var label = remote.name || "Player 2";
    ctx.fillStyle = "#FFD85A";
    ctx.beginPath();
    if (left) {
      ctx.moveTo(10, safeY); ctx.lineTo(22, safeY - 8); ctx.lineTo(22, safeY + 8);
    } else {
      ctx.moveTo(constants.LOGICAL_WIDTH - 10, safeY); ctx.lineTo(constants.LOGICAL_WIDTH - 22, safeY - 8); ctx.lineTo(constants.LOGICAL_WIDTH - 22, safeY + 8);
    }
    ctx.fill();
    ctx.font = "700 8px Trebuchet MS, sans-serif";
    ctx.textAlign = left ? "left" : "right";
    ctx.strokeStyle = "rgba(7,17,31,0.92)";
    ctx.lineWidth = 3;
    var textX = left ? 27 : constants.LOGICAL_WIDTH - 27;
    var text = label.length > 10 ? label.slice(0, 9) + "..." : label;
    ctx.strokeText(text, textX, safeY + 3);
    ctx.fillText(text, textX, safeY + 3);
  }

  function loop(now) {
    var dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    accumulator += dt;
    while (accumulator >= 1 / 60) {
      sendInput(now);
      accumulator -= 1 / 60;
    }
    if (appState === "game") {
      updateCamera(dt);
      updateHud();
    }
    draw();
    requestAnimationFrame(loop);
  }

  function init() {
    resizeCanvas();
    initAudio();
    window.PQDCanCaptureGameplayInput = function () {
      return appState === "game" && !paused;
    };
    gameOverScreen = window.PQDGameOverScreen.create({ parent: document.getElementById("app"), constants: constants });
    spectatorBanner = createSpectatorBanner();
    setupNetwork();
    showLoading();
    resources.load(assetList);
    resources.onReady(function () { loadingProgress = Math.max(loadingProgress, 100); });
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("pqd:pause-shortcut", togglePause);
    window.addEventListener("pqd:fullscreen-shortcut", toggleFullscreen);
    window.addEventListener("pqd:mute-shortcut", function () {
      muted = !muted;
      applyAudioPrefs();
      toast(muted ? "Muted." : "Sound on.");
    });
    document.addEventListener("pointerdown", unlockAudio, { once: true });
    document.addEventListener("keydown", unlockAudio, { once: true });
    requestAnimationFrame(loop);
  }

  init();
})();
