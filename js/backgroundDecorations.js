(function (root) {
  "use strict";

  root.PQDBackgroundDecorations = {
    aboveground: {
      skyColor: "#5C84FC",
      clouds: [
        { x: 250, y: 28, scale: 1, parallax: 0.1, variant: "tile" },
        { x: 520, y: 48, scale: 1, parallax: 0.12, variant: "tile" },
        { x: 930, y: 22, scale: 1, parallax: 0.1, variant: "tile" },
        { x: 1380, y: 34, scale: 0.08, parallax: 0.18, variant: "large" },
        { x: 1960, y: 24, scale: 1, parallax: 0.1, variant: "tile" },
        { x: 2560, y: 42, scale: 1, parallax: 0.14, variant: "tile" },
        { x: 3060, y: 20, scale: 0.07, parallax: 0.16, variant: "large" }
      ],
      hills: [
        { x: 20, y: 176, variant: "small", parallax: 0.3 },
        { x: 700, y: 176, variant: "large", parallax: 0.3 },
        { x: 1420, y: 176, variant: "large", parallax: 0.3 },
        { x: 2200, y: 176, variant: "small", parallax: 0.3 },
        { x: 3000, y: 176, variant: "large", parallax: 0.3 }
      ],
      bushes: [
        { x: 180, y: 192, width: 3, parallax: 0.6 },
        { x: 640, y: 192, width: 2, parallax: 0.6 },
        { x: 1120, y: 192, width: 3, parallax: 0.6 },
        { x: 1760, y: 192, width: 2, parallax: 0.6 },
        { x: 2380, y: 192, width: 3, parallax: 0.6 },
        { x: 3180, y: 192, width: 2, parallax: 0.6 }
      ]
    },
    underground: {
      skyColor: "#05070F",
      clouds: [],
      hills: [],
      bushes: []
    }
  };
})(window);
