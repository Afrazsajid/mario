# Pixel Quest Duo

Pixel Quest Duo is a full-screen two-player online platform game built with vanilla HTML, CSS and JavaScript on the client, plus Node.js, Express and Socket.IO on the server.

The original canvas/entity code and level assets are preserved where useful, but online play is now server-authoritative: browsers send input intentions, and the server owns room membership, positions, collectibles, enemies, scoring, timers, reconnect state and winner calculation.

## Important Asset Note

Some existing sprite and audio files are still present as temporary development assets. Before public or commercial deployment, replace every sprite and sound with original or properly licensed assets. Asset references are centralized through the existing `sprites/`, `sounds/`, `shared/levelData.js` and browser renderer paths to make that replacement straightforward.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Production-style local run:

```bash
npm start
```

Health check:

```bash
curl http://localhost:3000/health
```

## Test

```bash
npm test
```

Current automated coverage uses Node's built-in test runner and covers room creation/joining, rejecting a third player, invalid names/input, ready/start state, score changes, duplicate coin/enemy prevention, winner tie-breaking, disconnect/reconnect, room cleanup, rate limiting and restart reset behavior.

## Manual Multiplayer Checklist

1. Run `npm run dev`.
2. Open `http://localhost:3000` in one browser window.
3. Enter a 2-16 character player name and choose Nova or Bolt.
4. Select **Create Private Game**.
5. Copy the invite link or room code.
6. Open a second browser window, private window, or another computer on the same reachable host.
7. Open the invite link or choose **Join Game** and enter the room code.
8. Confirm a third window is rejected if it tries to join the same full room.
9. Ready both players.
10. Start from the host window.
11. Confirm both players appear in the same world, Space jumps, Shift runs, coins score once, enemies are shared, the timer matches and results declare the correct winner.
12. Refresh one browser during play and re-open the invite URL quickly to verify reconnect during the grace period.
13. On results, vote **Play Again** from both windows and confirm the room returns to a reset lobby.

## Controls

- Move: `A` / `D` or Left / Right Arrow
- Jump: `Space`, with temporary `X` fallback
- Run: Left or Right `Shift`, with temporary `Z` fallback
- Action: `F`
- Interact: `E`
- Pause: `Escape`
- Fullscreen: `F11` or the UI button
- Mute: `M`

## Architecture

`server/server.js` serves the static game and Socket.IO from the same HTTP server. `server/socketHandlers.js` validates socket messages and delegates room/game logic to `server/roomManager.js` and `server/gameSession.js`.

Shared modules in `shared/` run in both Node and the browser:

- `constants.js`: room states, character definitions, tick rates and dimensions.
- `protocol.js`: documented socket event names and payload summaries.
- `scoring.js`: score values, combo handling and winner tie-breaking.
- `validation.js`: player name, room code, character and input packet validation.
- `levelData.js`: deterministic level geometry, coins, power-ups and enemies.
- `physics.js`: reusable platformer movement, collision and enemy stepping.

The client keeps rendering and UI local. It predicts local movement immediately, reconciles to server snapshots, smooths remote players and never sends score or arbitrary positions.

## Socket Events

Client to server:

- `room:create`
- `room:join`
- `room:leave`
- `room:ready`
- `room:character`
- `room:start`
- `game:input`
- `game:restartVote`
- `game:returnToLobby`
- `connection:ping`

Server to client:

- `room:created`
- `room:joined`
- `room:state`
- `room:playerJoined`
- `room:playerLeft`
- `room:playerReady`
- `room:error`
- `game:countdown`
- `game:start`
- `game:snapshot`
- `game:event`
- `game:playerFinished`
- `game:over`
- `game:restartStatus`
- `connection:quality`
- `connection:pong`

## Invite Links

Invite links use the current page origin:

```text
https://your-domain.example/?room=ROOM_CODE
```

Reconnect tokens are stored in `sessionStorage` and are never placed in invite URLs.

## Deployment

Required environment variables are documented in `.env.example`:

```text
PORT=
NODE_ENV=
PUBLIC_URL=
ALLOWED_ORIGINS=
```

For production:

- Serve behind HTTPS so WebSockets use WSS.
- Configure reverse proxies to forward WebSocket upgrade headers.
- Set `ALLOWED_ORIGINS` to trusted origins, comma-separated.
- Set `PUBLIC_URL` to the public HTTPS origin used for invite links.
- Use sticky WebSocket sessions if running more than one server instance.
- Move room state to shared storage and add a Socket.IO Redis adapter or equivalent before horizontal scaling.

Docker:

```bash
docker build -t pixel-quest-duo .
docker run -p 3000:3000 --env-file .env pixel-quest-duo
```

## Known Limitations

- The server-authoritative simulation currently mirrors the main level geometry and core entities, while the older tunnel transition remains preserved in the legacy files for future deeper integration.
- Temporary development sprites/audio must be replaced before public release.
- In-memory rooms are designed for a single server instance.
