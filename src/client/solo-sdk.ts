import { Client } from "@colyseus/sdk";

declare global {
  interface Window {
    Colyseus?: { Client: typeof Client };
  }
}

window.Colyseus = { Client };
