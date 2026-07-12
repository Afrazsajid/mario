"use strict";

const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const constants = require("../shared/constants");
const { RoomManager } = require("./roomManager");
const { registerSocketHandlers } = require("./socketHandlers");

function parseOrigins(value) {
  if (!value) return true;
  return value.split(",").map((origin) => origin.trim()).filter(Boolean);
}

function createApp() {
  const app = express();
  const publicDir = path.resolve(__dirname, "..");
  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.get("/health", (_req, res) => res.json({ ok: true, title: constants.GAME_TITLE, time: new Date().toISOString() }));
  app.use(express.static(publicDir, {
    extensions: ["html"],
    setHeaders(res) {
      res.setHeader("X-Content-Type-Options", "nosniff");
    }
  }));
  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  return app;
}

function startServer() {
  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: parseOrigins(process.env.ALLOWED_ORIGINS) },
    maxHttpBufferSize: 16 * 1024
  });
  const roomManager = new RoomManager({
    emitRoom(roomCode, event, data) {
      io.to(roomCode).emit(event, data);
    }
  });

  registerSocketHandlers(io, roomManager, { publicUrl: process.env.PUBLIC_URL || "" });

  const tickInterval = setInterval(() => {
    roomManager.tickAll(1 / constants.SERVER_TICK_RATE);
    roomManager.snapshotsDue().forEach(({ code, snapshot }) => io.to(code).emit("game:snapshot", snapshot));
  }, 1000 / constants.SERVER_TICK_RATE);

  const port = Number(process.env.PORT || 3000);
  server.listen(port, () => console.log(`${constants.GAME_TITLE} server listening on ${port}`));

  function shutdown(signal) {
    console.log(`${signal} received, shutting down`);
    clearInterval(tickInterval);
    roomManager.closeAll();
    io.close(() => server.close(() => process.exit(0)));
    setTimeout(() => process.exit(1), 8000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  return { app, server, io, roomManager };
}

if (require.main === module) startServer();

module.exports = { createApp, startServer };
