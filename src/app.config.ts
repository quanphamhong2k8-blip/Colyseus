// src/app.config.ts
import config from "@colyseus/tools";
import { defineRoom } from "colyseus";
import { MyRoom } from "./rooms/MyRoom.js";
import { Solo } from "./rooms/Solo.js";

export const rooms = {
  my_room: defineRoom(MyRoom),
  Solo: defineRoom(Solo).filterBy(["code"]),
};

export default config({
  initializeGameServer: (gameServer) => {
    gameServer.define("my_room", MyRoom);
    gameServer.define("Solo", Solo).filterBy(["code"]);
  },
});
