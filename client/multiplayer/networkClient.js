(function (root) {
  "use strict";

  function NetworkClient(protocol) {
    this.protocol = protocol;
    this.socket = null;
    this.connected = false;
  }

  NetworkClient.prototype.connect = function () {
    if (this.socket) return this.socket;
    this.socket = io({ transports: ["websocket", "polling"] });
    this.socket.on("connect", function () {
      this.connected = true;
    }.bind(this));
    this.socket.on("disconnect", function () {
      this.connected = false;
    }.bind(this));
    return this.socket;
  };

  NetworkClient.prototype.emit = function (event, payload) {
    this.connect().emit(event, payload || {});
  };

  NetworkClient.prototype.on = function (event, handler) {
    this.connect().on(event, handler);
  };

  root.PQDNetworkClient = NetworkClient;
})(window);
