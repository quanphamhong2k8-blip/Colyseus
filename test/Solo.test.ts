import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";

import appConfig from "../src/app.config.js";

describe("Solo relay room", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  before(async () => colyseus = await boot(appConfig));
  after(async () => colyseus.shutdown());

  beforeEach(async () => {
    await colyseus.cleanup();
  });

  it("relays and sends the latest player position to a joining client", async () => {
    const room = await colyseus.createRoom("Solo", {});
    const player1 = await colyseus.connectTo(room);
    player1.onMessage("leave", () => {});
    const player2 = await colyseus.connectTo(room);
    player2.onMessage("leave", () => {});
    const liveUpdate = new Promise<{ id: string; x: number; y: number }>((resolve) => {
      player2.onMessage("p", resolve);
    });

    player1.send("p", { x: 120, y: 240 });
    await room.waitForNextMessage();
    assert.deepStrictEqual(await liveUpdate, {
      id: player1.sessionId,
      x: 120,
      y: 240,
    });

    const player3 = await colyseus.connectTo(room);
    player3.onMessage("leave", () => {});
    const initialUpdate = new Promise<{ id: string; x: number; y: number }>((resolve) => {
      player3.onMessage("p", resolve);
    });
    player3.send("ready");
    await room.waitForNextMessage();

    assert.deepStrictEqual(await initialUpdate, {
      id: player1.sessionId,
      x: 120,
      y: 240,
    });
  });

  it("acknowledges sequenced movement snapshots to their sender", async () => {
    const room = await colyseus.createRoom("Solo", {});
    const player = await colyseus.connectTo(room);
    const ack = new Promise<{ seq: number; x: number; z: number }>((resolve) => {
      player.onMessage("ack", resolve);
    });

    player.send("p", { seq: 3, x: 120, z: 240 });
    await room.waitForNextMessage();

    assert.deepStrictEqual(await ack, { seq: 3, x: 110, z: 110 });
  });
});
