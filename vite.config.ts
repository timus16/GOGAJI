import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

const nodeBuiltins = [
  "node:fs", "node:path", "node:url", "node:module", "node:crypto",
  "node:stream", "node:util", "node:events", "node:buffer",
  "node:assert", "node:constants", "node:os", "node:process",
  "node:querystring", "node:zlib", "node:http", "node:https",
  "node:net", "node:tls", "node:dns", "node:child_process",
  "node:cluster", "node:worker_threads", "node:perf_hooks",
  "node:async_hooks", "node:inspector", "node:trace_events",
  "node:v8", "node:vm", "node:readline", "node:repl",
  "node:string_decoder", "node:timers", "node:tty",
];

export default defineConfig({
  server: {
    port: 3000,
    host: true,
    allowedHosts: true,
    hmr: process.env.HMR_CLIENT_PORT ? { clientPort: Number(process.env.HMR_CLIENT_PORT) } : undefined,
    fs: {
      strict: true,
      allow: [import.meta.dirname],
      deny: [".env", ".env.*", "*.{crt,pem,key}", "**/.run/**", "**/.git/**"],
    },
  },
  build: {
    rollupOptions: {
      external: ["@neondatabase/serverless", "cloudflare:workers", ...nodeBuiltins],
    },
  },
  builder: {
    esbuild: true,
  },
  resolve: { alias: { "react-dom/server": "react-dom/server.edge" }, conditions: ["workerd", "edge", "worker", "browser"] },
  plugins: [
    tailwindcss(),
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart({
      server: {
        entry: "server.tsx",
      },
    }),
    viteReact(),
  ],
});
