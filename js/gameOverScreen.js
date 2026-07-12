(function (root) {
  "use strict";

  function createElement(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function stateLabel(player) {
    var state = player && player.state ? player.state.playerState : "";
    if (state === "spectating") return "Spectating";
    if (state === "dying") return "Down";
    if (state === "finished") return "Finished";
    if (state === "active") return "Still running";
    return "Eliminated";
  }

  function create(options) {
    var parent = options.parent || document.body;
    var constants = options.constants || {};
    var container = createElement("section", "game-over-screen hidden");
    container.setAttribute("role", "dialog");
    container.setAttribute("aria-modal", "true");
    container.setAttribute("aria-live", "assertive");

    var panel = createElement("div", "game-over-panel");
    var title = document.createElement("img");
    title.className = "game-over-title";
    title.src = "sprites/game-over-title.png";
    title.alt = "Game Over";
    var status = createElement("p", "game-over-status");
    var timer = createElement("strong", "game-over-timer", "5");
    var playerGrid = createElement("div", "game-over-players");
    var lastPlayersKey = "";

    panel.appendChild(title);
    panel.appendChild(status);
    panel.appendChild(timer);
    panel.appendChild(playerGrid);
    container.appendChild(panel);
    parent.appendChild(container);

    function renderPlayers(players) {
      var key = (players || []).map(function (player) {
        return [
          player.id,
          player.name,
          player.state && player.state.playerState,
          player.stats && player.stats.score
        ].join(":");
      }).join("|");
      if (key === lastPlayersKey) return;
      lastPlayersKey = key;
      clear(playerGrid);
      (players || []).forEach(function (player) {
        var card = createElement("article", "game-over-player");
        var name = createElement("strong", "", player.name || "Player");
        var badge = createElement("span", "badge", stateLabel(player));
        var score = createElement("span", "muted", "Score " + (player.stats ? player.stats.score : 0));
        card.appendChild(name);
        card.appendChild(badge);
        card.appendChild(score);
        playerGrid.appendChild(card);
      });
    }

    function update(snapshot, roomCode) {
      if (!snapshot || snapshot.roundState !== constants.ROUND_STATES.GAME_OVER && snapshot.roundState !== constants.ROUND_STATES.RESTARTING) {
        hide();
        return;
      }
      container.classList.remove("hidden");
      var serverOffset = snapshot.serverTime ? snapshot.serverTime - Date.now() : 0;
      var remainingMs = Math.max(0, (snapshot.restartAt || Date.now()) - (Date.now() + serverOffset));
      var seconds = Math.ceil(remainingMs / 1000);
      status.textContent = snapshot.roundState === constants.ROUND_STATES.RESTARTING ? "Restarting room " + (roomCode || "------") : "Everybody is out";
      timer.textContent = seconds > 0 ? "Restarting in " + seconds : "Restarting";
      renderPlayers(snapshot.players);
    }

    function hide() {
      container.classList.add("hidden");
      lastPlayersKey = "";
    }

    return {
      update: update,
      hide: hide,
      element: container
    };
  }

  root.PQDGameOverScreen = { create: create };
})(window);
