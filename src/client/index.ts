import { ColyseusSDK } from "@colyseus/sdk";
import type { default as server } from "../app.config.js";
import { ARENA_HEIGHT, ARENA_WIDTH, TICK_RATE } from "../shared/constants.js";
import { stepEntity, type EntityState } from "../shared/movement.js";

const statusEl = document.getElementById("status")!;
const arenaEl = document.getElementById("arena")!;

const client = new ColyseusSDK<typeof server>(
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`
);

type PlayerMessage = {
  id: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
};

const players = new Map<string, EntityState>();
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

function isPlayerMessage(data: unknown): data is PlayerMessage {
  if (typeof data !== "object" || data === null) { return false; }
  const player = data as Partial<PlayerMessage>;
  return typeof player.id === "string"
    && typeof player.x === "number"
    && typeof player.y === "number";
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
  const room = await client.joinOrCreate("Solo");
  const selfId = room.sessionId;
  const self: EntityState = {
    x: ARENA_WIDTH / 2 + (Math.random() - 0.5) * 160,
    y: ARENA_HEIGHT / 2 + (Math.random() - 0.5) * 160,
    vx: 0,
    vy: 0,
  };
  players.set(selfId, self);
  ensurePlayerNode(selfId, selfId);

  room.onMessage("p", (data: PlayerMessage) => {
    if (!isPlayerMessage(data) || data.id === selfId) { return; }
    players.set(data.id, {
      x: data.x,
      y: data.y,
      vx: data.vx ?? 0,
      vy: data.vy ?? 0,
    });
    ensurePlayerNode(data.id, selfId);
  });

  room.onMessage("leave", (sessionId: string) => {
    players.delete(sessionId);
    nodes.get(sessionId)?.remove();
    nodes.delete(sessionId);
  });

  room.onMessage("e", (payload: unknown) => {
    dispatchEvent(new CustomEvent("colyseus:e", { detail: payload }));
  });

  room.onMessage("m", (payload: unknown) => {
    dispatchEvent(new CustomEvent("colyseus:m", { detail: payload }));
  });

  room.onMessage("pong", (payload: { c: number; s: number }) => {
    dispatchEvent(new CustomEvent("colyseus:pong", { detail: payload }));
  });

  room.send("ready");
  statusEl.textContent = `Connected to Solo as ${selfId}`;

  room.onLeave(() => {
    statusEl.textContent = "Disconnected";
    players.clear();
    nodes.forEach((node) => node.remove());
    nodes.clear();
  });

  const stepSeconds = 1 / TICK_RATE;
  let previousFrame = 0;
  let accumulator = 0;
  let lastPing = 0;

  function frame(now: number) {
    if (previousFrame === 0) { previousFrame = now; }
    accumulator += Math.min((now - previousFrame) / 1000, 0.25);
    previousFrame = now;

    while (accumulator >= stepSeconds) {
      stepEntity(self, {
        moveX: axis(["a", "arrowleft"], ["d", "arrowright"]),
        moveY: axis(["w", "arrowup"], ["s", "arrowdown"]),
      }, stepSeconds);
      room.send("p", self);
      accumulator -= stepSeconds;
    }

    if (now - lastPing >= 5000) {
      room.send("ping", now);
      lastPing = now;
    }

    for (const [sessionId, player] of players) {
      const node = ensurePlayerNode(sessionId, selfId);
      node.style.transform = `translate(${player.x}px, ${player.y}px)`;
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

main().catch((error) => {
  console.error(error);
  statusEl.textContent = "Could not connect to Solo";
});
