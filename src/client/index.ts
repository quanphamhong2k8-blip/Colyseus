import { ColyseusSDK, Predict } from "@colyseus/sdk";
import type { default as server } from "../app.config.js";
import { MoveInput } from "../rooms/schema/MyRoomState.js";
import { ARENA_HEIGHT, ARENA_WIDTH } from "../shared/constants.js";
import { stepEntity, type EntityState } from "../shared/movement.js";

const statusEl = document.getElementById("status")!;
const arenaEl = document.getElementById("arena")!;

const client = new ColyseusSDK<typeof server>(
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`
);

const nodes = new Map<string, HTMLElement>();
const held = new Set<string>();

addEventListener("keydown", (event) => held.add(event.key.toLowerCase()));
addEventListener("keyup", (event) => held.delete(event.key.toLowerCase()));
addEventListener("blur", () => held.clear());

function axis(negative: string[], positive: string[]): -1 | 0 | 1 {
  const back = negative.some((key) => held.has(key));
  const forward = positive.some((key) => held.has(key));
  if (back === forward) { return 0; }
  return back ? -1 : 1;
}

function ensurePlayerNode(sessionId: string, selfId: string): HTMLElement {
  let node = nodes.get(sessionId);
  if (!node) {
    node = document.createElement("div");
    node.className = sessionId === selfId ? "player self" : "player";
    arenaEl.appendChild(node);
    nodes.set(sessionId, node);
  }
  return node;
}

async function main() {
  const room = await client.joinOrCreate("my_room");
  const selfId = room.sessionId;
  const predict = Predict.get(room, { mode: "lerp", delay: 65 });
  predict.attachAll("players", { fields: ["x", "y"], mode: "lerp" });
  const input = room.input({ type: MoveInput, mode: "reliable" });
  let self: EntityState | undefined;
  let reconciler: ReturnType<typeof predict.reconciler> | undefined;

  statusEl.textContent = `Connected to MyRoom as ${selfId}`;

  room.onLeave(() => {
    statusEl.textContent = "Disconnected";
    reconciler?.dispose();
    nodes.forEach((node) => node.remove());
    nodes.clear();
  });

  function frame(now: number) {
    const steps = predict.tick(now);
    self ??= room.state.players.get(selfId);

    if (self && !reconciler) {
      reconciler = predict.reconciler(self, {
        input,
        fields: ["x", "y", "vx", "vy"],
        step: (ctx, state, command) => stepEntity(state, command, ctx.dt),
        smoothMs: 65,
      });
    }

    if (self && reconciler) {
      for (let i = 0; i < steps; i++) {
        input.data.moveX = axis(["a", "arrowleft"], ["d", "arrowright"]);
        input.data.moveY = axis(["w", "arrowup"], ["s", "arrowdown"]);
        input.send();
      }
    }

    for (const [sessionId, player] of room.state.players) {
      const node = ensurePlayerNode(sessionId, selfId);
      const x = predict.value(player, "x") * arenaEl.clientWidth / ARENA_WIDTH;
      const y = predict.value(player, "y") * arenaEl.clientHeight / ARENA_HEIGHT;
      node.style.transform = `translate(${x}px, ${y}px)`;
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

main().catch((error) => {
  console.error(error);
  statusEl.textContent = "Could not connect to MyRoom";
});
