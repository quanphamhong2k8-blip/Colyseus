import { Client, Room } from "@colyseus/sdk";
import { cli, Options } from "@colyseus/loadtest";
import { ARENA_HEIGHT, ARENA_WIDTH } from "../src/shared/constants.js";

export async function main(options: Options) {
  const client = new Client(options.endpoint);
  const room: Room = await client.joinOrCreate(options.roomName, {
    // your join options here...
  });

  console.log("joined successfully!");

  room.onMessage("p", (payload: unknown) => {
    console.log("player update:", payload);
  });

  room.onMessage("e", (payload: unknown) => {
    console.log("game event:", payload);
  });

  room.onMessage("m", (payload: unknown) => {
    console.log("mob update:", payload);
  });

  room.onMessage("leave", (sessionId: string) => {
    console.log("player left:", sessionId);
  });

  room.send("ready");
  room.send("p", {
    x: ARENA_WIDTH / 2,
    y: ARENA_HEIGHT / 2,
    vx: 0,
    vy: 0,
  });

  room.onLeave(() => console.log("left"));
}

cli(main);
