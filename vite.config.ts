import { defineConfig } from "vite";
import { colyseus } from "colyseus/vite";

export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT || 2567),
    strictPort: true,
    allowedHosts: ["solo-wxyc.onrender.com"],
  },
  build: { outDir: "dist/client" },
  environments: {
    client: {
      build: { rollupOptions: { input: ["index.html", "solo.html", "prediction.html"] } },
    },
  },
  plugins: [
    // The plugin declares a second build environment (dist/server), so every
    // `vite build` builds both halves. `--mode client` drops it when you only
    // want the static client — e.g. deploying it separately from the server.
    // That mode also swaps which .env.* file Vite loads: .env.client, not
    // .env.production. Only matters once you add a VITE_-prefixed var.
    ...(mode === "client" ? [] : [colyseus({ serverEntry: "/src/app.config.ts" })]),
  ],
}));
