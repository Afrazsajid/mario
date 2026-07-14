(function () {
  "use strict";

  var DEBUG_ENEMY_INSPECTOR = false;

  function init() {
    if (!DEBUG_ENEMY_INSPECTOR || !window.PQDEnemyRegistry) return;
    var panel = document.createElement("aside");
    panel.style.cssText = "position:fixed;right:8px;top:8px;z-index:9999;max-height:92vh;overflow:auto;background:#07111f;color:#f7fbff;border:2px solid #ffd85a;padding:8px;font:12px monospace;pointer-events:auto";
    panel.appendChild(document.createTextNode("Enemy atlas inspector"));
    Object.keys(window.PQDEnemyRegistry.ENEMY_FRAMES).forEach(function (family) {
      var block = document.createElement("pre");
      block.textContent = family + " " + JSON.stringify(window.PQDEnemyRegistry.ENEMY_FRAMES[family], null, 2);
      panel.appendChild(block);
    });
    document.body.appendChild(panel);
  }

  window.PQDEnemyInspector = { init: init };
})();
