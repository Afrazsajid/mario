(function (root) {
  "use strict";

  function cloneState(state) {
    return state ? JSON.parse(JSON.stringify(state)) : null;
  }

  function createPrediction(world, physics) {
    var pending = [];
    var predicted = null;

    return {
      setAuthoritative: function (state, ack) {
        predicted = cloneState(state);
        pending = pending.filter(function (input) { return input.sequence > ack; });
        pending.forEach(function (input) {
          physics.stepPlayer(predicted, input, 1 / 60, world);
        });
      },
      applyInput: function (input) {
        if (!predicted) return null;
        pending.push(input);
        physics.stepPlayer(predicted, input, 1 / 60, world);
        return cloneState(predicted);
      },
      state: function () {
        return cloneState(predicted);
      },
      clear: function () {
        pending = [];
        predicted = null;
      }
    };
  }

  root.PQDPrediction = { createPrediction: createPrediction };
})(window);
