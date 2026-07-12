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

  var sounds = {};
  var music = {};
  var assetList = [
    "sprites/player.png",
    "sprites/playerl.png",
    "sprites/enemy.png",
    "sprites/enemyr.png",
    "sprites/tiles.png",
    "sprites/items.png"
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

  function toast(message) {
    var node = el("div", "toast", message);
    toastRegion.appendChild(node);
    setTimeout(function () { node.remove(); }, 4200);
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
    ["coin", "stomp", "jump-small", "powerup", "flagpole", "pipe", "kick"].forEach(function (name) {
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
    prediction.clear();
    var me = playerSnapshot(playerId);
    if (me) prediction.setAuthoritative(me.state, me.inputAck || 0);
    clear(screenLayer);
    hud.classList.remove("hidden");
    pauseOverlay.classList.add("hidden");
    countdownEl.classList.add("hidden");
    displayPlayers = {};
    music.overworld.play().catch(function () {});
    toast("GO!");
  }

  function playerSnapshot(id) {
    return snapshot && snapshot.players ? snapshot.players.find(function (player) { return player.id === id; }) : null;
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
    snapshot = next;
    var me = playerSnapshot(playerId);
    if (me) prediction.setAuthoritative(me.state, me.inputAck || 0);
  }

  function handleGameEvent(event) {
    if (event.type === "coin") playSound("coin");
    if (event.type.indexOf("enemy") === 0) playSound("stomp");
    if (event.delta > 0) camera.shake = Math.max(camera.shake, 1.4);
    var player = snapshot && snapshot.players ? snapshot.players.find(function (p) { return p.id === event.playerId; }) : null;
    toast((player ? player.name : "Player") + " +" + event.delta);
  }

  function sendInput(now) {
    if (appState !== "game" || paused || !snapshot || now - lastInputSentAt < 1000 / 60) return;
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
    var p1 = snapshot.players[0];
    var p2 = snapshot.players[1];
    renderHudCard(hudP1, p1, p1 && p2 && p1.stats.score >= p2.stats.score);
    renderHudCard(hudP2, p2, p2 && p1 && p2.stats.score > p1.stats.score);
    var seconds = snapshot.remainingSeconds || 0;
    matchTimer.textContent = Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
    levelTitle.textContent = snapshot.level ? snapshot.level.title : world.title;
    var maxProgress = 0;
    snapshot.players.forEach(function (player) {
      maxProgress = Math.max(maxProgress, Math.min(100, (player.state.x / world.finishX) * 100));
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
    target.appendChild(el("strong", "", player.name + (leader ? " crown" : "")));
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
    var sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#07111F");
    sky.addColorStop(0.45, "#0D1F38");
    sky.addColorStop(1, "#123D38");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(86,199,255,0.14)";
    for (var i = 0; i < 22; i += 1) {
      var x = (i * 173 + performance.now() * 0.014) % (width + 40) - 20;
      var y = 40 + (i * 47) % Math.max(120, height - 120);
      ctx.fillRect(x, y, 2, 2);
    }
  }

  function worldX(x) { return Math.round(x - camera.x); }
  function worldY(y) { return Math.round(y - camera.y); }

  function drawTile(img, sx, sy, x, y) {
    if (img) ctx.drawImage(img, sx, sy, 16, 16, worldX(x), worldY(y), 16, 16);
    else {
      ctx.fillStyle = "#2f9f54";
      ctx.fillRect(worldX(x), worldY(y), 16, 16);
    }
  }

  function drawWorld() {
    ctx.fillStyle = "#122747";
    ctx.fillRect(0, 0, constants.LOGICAL_WIDTH, constants.LOGICAL_HEIGHT);
    ctx.fillStyle = "rgba(86,199,255,0.28)";
    for (var h = 0; h < 9; h += 1) {
      var hx = worldX(h * 420 - camera.x * 0.12);
      ctx.beginPath();
      ctx.arc(hx, 188, 64, Math.PI, 0);
      ctx.fill();
    }
    var tiles = resources.get("sprites/tiles.png");
    world.solids.forEach(function (solid) {
      if (solid.x + solid.w < camera.x || solid.x > camera.x + constants.LOGICAL_WIDTH) return;
      for (var x = solid.x; x < solid.x + solid.w; x += 16) {
        for (var y = solid.y; y < solid.y + solid.h; y += 16) {
          drawTile(tiles, solid.id.indexOf("pipe") === 0 ? 0 : 0, solid.id.indexOf("ground") === 0 ? 0 : 16, x, y);
        }
      }
    });
    ctx.fillStyle = "rgba(53,228,208,0.2)";
    ctx.fillRect(worldX(world.finishX), worldY(45), 4, 150);
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
      if (items) ctx.drawImage(items, power.type === "star" ? 0 : 0, power.type === "star" ? 48 : 0, 16, 16, worldX(power.x), worldY(power.y), 16, 16);
    });
    var enemyImg = resources.get("sprites/enemy.png");
    world.enemies.forEach(function (enemy) {
      var current = enemyUpdates[enemy.id] || enemy;
      if (!current.alive) return;
      var sx = current.type === "koopa" ? 96 : 0;
      var sy = current.type === "koopa" ? 0 : 16;
      var h = current.type === "koopa" ? 32 : 16;
      if (enemyImg) ctx.drawImage(enemyImg, sx, sy, 16, h, worldX(current.x), worldY(current.y), 16, h);
    });
    if (!snapshot || !snapshot.players) return;
    snapshot.players.forEach(drawPlayer);
    drawRemoteIndicator();
  }

  function drawPlayer(player) {
    var target = player.state;
    if (!target) return;
    var existing = displayPlayers[player.id];
    displayPlayers[player.id] = existing ? interpolation.smoothPlayer(existing, target, player.id === playerId ? 0.8 : 0.24) : JSON.parse(JSON.stringify(target));
    var state = displayPlayers[player.id];
    var character = constants.CHARACTERS[player.character] || constants.CHARACTERS.nova;
    var img = resources.get(state.facing < 0 ? character.leftSprite : character.sprite);
    if (!img) return;
    var frame = 80;
    if (!state.grounded) frame = 160;
    else if (Math.abs(state.vx) > 8) frame = 96 + (Math.floor(performance.now() / 90) % 3) * 16;
    ctx.drawImage(img, frame, 32, 16, 16, worldX(state.x - 1), worldY(state.y), 16, 16);
    ctx.save();
    ctx.globalAlpha = player.id === playerId ? 0.42 : 0.28;
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = character.primary;
    ctx.fillRect(worldX(state.x - 1), worldY(state.y), 16, 16);
    ctx.restore();
    ctx.font = "700 8px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = player.id === playerId ? "#FFD85A" : "#F7FBFF";
    ctx.strokeStyle = "rgba(7,17,31,0.9)";
    ctx.lineWidth = 3;
    ctx.strokeText(player.name, worldX(state.x + 7), worldY(state.y - 6));
    ctx.fillText(player.name, worldX(state.x + 7), worldY(state.y - 6));
  }

  function drawRemoteIndicator() {
    if (!snapshot || !snapshot.players) return;
    var remote = snapshot.players.find(function (player) { return player.id !== playerId; });
    if (!remote || !remote.state) return;
    var x = worldX(remote.state.x);
    if (x >= 0 && x <= constants.LOGICAL_WIDTH) return;
    ctx.fillStyle = "#FFD85A";
    ctx.beginPath();
    if (x < 0) {
      ctx.moveTo(10, 108); ctx.lineTo(24, 98); ctx.lineTo(24, 118);
    } else {
      ctx.moveTo(constants.LOGICAL_WIDTH - 10, 108); ctx.lineTo(constants.LOGICAL_WIDTH - 24, 98); ctx.lineTo(constants.LOGICAL_WIDTH - 24, 118);
    }
    ctx.fill();
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
