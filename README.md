# Welcome to Colyseus!

This project was created with [⚔️ `create-colyseus-app`](https://github.com/colyseus/create-colyseus-app/).

[Documentation](https://docs.colyseus.io/)

## :crossed_swords: Usage

```
npm start
```

Then open http://localhost:2567 for the game, /solo.html to open it directly,
or /playground for the Colyseus playground.

## Structure

- `src/app.config.ts`: server configuration — rooms, HTTP routes, express middleware
- `src/rooms/MyRoom.ts`: your room handler
- `src/rooms/Solo.ts`: relay room for the Lua/game client
- `src/rooms/schema/MyRoomState.ts`: the state synchronized to every client in the room
- `test/MyRoom.test.ts`: boots the real server and connects a real client
- `loadtest/example.ts`: scriptable client for `npm run loadtest`
- `ecosystem.config.cjs`: pm2 configuration, used when deploying to Colyseus Cloud

## Scripts

- `npm start`: run Vite — client, server and playground on one port, with HMR
- `npm test`: run the mocha test suite
- `npm run build`: build client (`dist/client/`) and server (`dist/server/`)
- `npm run loadtest`: connect N simulated clients with [`@colyseus/loadtest`](https://github.com/colyseus/colyseus-loadtest/)

The 3D game and `src/client/client.lua` use the `Solo` relay room. Player
positions use the `p` message; `e` and `m` carry game events and mob state.
The 3D client predicts its own movement locally, then reconciles sequenced
position snapshots acknowledged by the room; the room clamps these snapshots
to the arena bounds, and the client blends corrections over about 85 ms. Other
players are interpolated from their snapshots. The Lua example sends a starting position;
connect its `p` updates to the game's actual player coordinates for live
movement. The separate `my_room` browser client demonstrates schema-based
server prediction and is used by the automated movement tests.
Open `/prediction.html` to try the predicted `my_room` browser client; the
root page continues to launch the 3D game.
For local development, the server binds to `0.0.0.0:2567`, allowing connections
from other devices on the network. Open the game using this computer's LAN IP
address (for example, `http://192.168.1.20:2567`); `0.0.0.0` is the bind
address, not the address clients should connect to. The Windows firewall must
also allow inbound connections on port `2567`.

## What's included

### Single Vite project

Client, server and shared code live in one project on one port. `npm start`
runs Vite with the `colyseus/vite` plugin: it boots the server in-process and
hot-reloads your rooms when you edit them, so there is no second terminal and no
build step in development.

```
index.html
src/app.config.ts    server config (the plugin's `serverEntry`)
src/rooms/           your rooms
src/client/          browser code
```

`npm run build` produces both halves — `dist/client/` and `dist/server/server.mjs`.
`npm run build:client` skips the server, for deploying the client to a static
host while the server runs elsewhere.

Express runs *in front of* Vite in development, so `/` belongs to the client and
the playground moved to `/playground`. The direct `@colyseus/playground`
dependency floors the version at 0.18.3, which redirects the slash-less
`/playground` itself — older versions render it blank.

- https://docs.colyseus.io/server/vite

### Fixed tick + client prediction

The room advances on `setFixedTimestep()`: a framework-owned accumulator runs
`step()` a whole number of times per frame, each advancing exactly `1/TICK_RATE`
seconds. A constant `dt` is what makes the client able to replay the same steps
— with `setTimestep()`'s measured delta it could not.

`defineInput(MoveInput, …)` gives each client a server-side input buffer.
`sanitize` clamps every field as it arrives, because nothing off the wire is
trustworthy. The input schema is deliberately flat and carries no `seq`, no `dt`
and no timestamp: the engine's own counter is the sequence, one input advances
exactly one step, and the SDK stamps lag-comp timing on the wire envelope.

`src/shared/movement.ts` holds the one function both sides run. It is typed
structurally so the same code steps a server Schema instance and the client
reconciler's plain predicted copy, and it is pure — no clocks, no randomness, no
reads outside its arguments. Keep it that way, or prediction and server will
disagree.

The client-side prediction wiring lives in `src/client/index.ts`; see the
netcode guide for details:

- https://docs.colyseus.io/netcode/server-input
- https://docs.colyseus.io/netcode/client-prediction

### Client-side prediction

`src/client/index.ts` runs the same `stepEntity` the server runs. Every input is
applied locally the instant it is sent, so your own square responds with zero
latency; when the server's next patch acknowledges input *N*, the reconciler
rewinds to the authoritative state and replays inputs *N+1…* through that same
function.

One `predict.tick(now)` per frame drives everything, and it returns how many
fixed steps are due — that is the loop that decides how many inputs to send, so
input rate follows the simulation rate rather than your monitor's refresh rate.

Other players are not yours to predict, so they are interpolated (`mode: "lerp"`)
from buffered snapshots with a 65 ms render delay. The controlled player's
correction offset decays over 65 ms to hide reconciliation errors. Read every position through
`predict.value(player, "x")`: it returns the predicted value for your own
entity and the interpolated one for everyone else.

- https://docs.colyseus.io/netcode/client-prediction

### Lobby room

A `LobbyRoom` is registered as `lobby`, and the sample room is chained with
`.enableRealtimeListing()` so the lobby receives create/update/dispose events for
it. Clients join the lobby to render a live room browser:

```ts
const lobby = await client.joinOrCreate("lobby");
lobby.onMessage("rooms", (rooms) => { /* full list on join */ });
lobby.onMessage("+", ([roomId, room]) => { /* added or updated */ });
lobby.onMessage("-", (roomId) => { /* removed */ });
```

- https://docs.colyseus.io/matchmaker/lobby

### Reconnection

`MyRoom.onDrop()` holds a dropped client's seat for 30 seconds via
`allowReconnection()`. The SDK retries automatically with exponential backoff;
`onReconnect()` fires if it gets back in time, `onLeave()` if it does not.

- https://docs.colyseus.io/room/reconnection
