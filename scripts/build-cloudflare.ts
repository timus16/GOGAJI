import { $ } from "bun";
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync, cpSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
process.chdir(root);

const OUT_DIR = "dist/cloudflare-worker";
const SSR_DIR = "dist/server";

console.log("[1/2] bun run build  (vite: client + SSR)");
await $`bun run build`;

// Post-process server.js to move astro_exports before router dynamic import
const serverJsPath = resolve(SSR_DIR, "server.js");
let serverJs = readFileSync(serverJsPath, "utf-8");

// Find the astro_exports definition
const astroExportsMatch = serverJs.match(/var astro_exports = \/\* @__PURE__ \*\/ __exportAll\(\{[\s\S]*?\n\}\);/);
if (astroExportsMatch) {
  const astroExportsBlock = astroExportsMatch[0];
  // Remove it from current position
  serverJs = serverJs.replace(astroExportsBlock, "");
  // Find the loadEntries function and insert before it
  const loadEntriesIndex = serverJs.indexOf("async function loadEntries()");
  if (loadEntriesIndex !== -1) {
    serverJs = serverJs.slice(0, loadEntriesIndex) + astroExportsBlock + "\n\n" + serverJs.slice(loadEntriesIndex);
  }
  writeFileSync(serverJsPath, serverJs);
  console.log("[post-process] Moved astro_exports before router dynamic import");
}


if (!existsSync(SSR_DIR)) {
  console.error(`build:cloudflare: ${SSR_DIR} was not produced by \`bun run build\``);
  process.exit(1);
}

console.log(`[2/2] copying SSR output to ${OUT_DIR}`);
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

cpSync(SSR_DIR, OUT_DIR, { recursive: true });

cpSync(resolve(root, "polyfill.ts"), resolve(OUT_DIR, "polyfill.ts"));

const workerEntry = `// Cloudflare Workers entry for the Nakshatra Canvas app.
// Imports the Vite SSR handler and adds Cloudflare-specific handlers.

import "./polyfill.ts";
import { processWallpaperJob } from "./server.js";


import { JobsDurableObject } from "./server.js";

interface AssetsBinding {
  fetch: (input: Request) => Promise<Response>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(data: ArrayBuffer): Promise<ArrayBuffer>;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  exec(query: string): Promise<D1Result>;
}

interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = any>(): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = any>(): Promise<D1Result<T>>;
}

interface D1Result<T = any> {
  results: T[];
  success: boolean;
  error?: string;
  meta: {
    duration: number;
    rows_read: number;
    rows_written: number;
    changed_db: boolean;
    last_row_id?: number;
    changed_rows?: number;
  };
}

interface Env {
  SENTRY_DSN?: string;
  NODE_ENV?: string;
  SESSION_SECRET?: string;
  PREMIUM_BYPASS_CODE?: string;
  GEMINI_API_KEY?: string;
  NVIDIA_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  ASSETS: AssetsBinding;
  JOBS_DO: DurableObjectNamespace;
  WALLPAPER_QUEUE: Queue;
  DB: D1Database;
}

import handler from "./server.js";

const fetchHandler = handler as {
  fetch: (request: Request) => Response | Promise<Response>;
};

const CSP_HEADER = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.workers.dev https://api.nvidia.com https://api.openai.com https://generativelanguage.googleapis.com https://openrouter.ai https://geocoding-api.open-meteo.com https://photon.komoot.io https://nominatim.openstreetmap.org https://timeapi.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", CSP_HEADER);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  const contentType = headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function addCorsHeaders(response: Response, origin: string): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Max-Age", "86400");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function handleOptions(request: Request): Response {
  const origin = request.headers.get("Origin") || "*";
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Content-Security-Policy", CSP_HEADER);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return new Response(null, { status: 204, headers });
}

const baseHandler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const isApiRoute = pathname.startsWith("/api/");
    if (pathname === "/__purge") {
      try {
        const purgeResult = await env.ASSETS.fetch(new Request(request.url, { method: "PURGE" }));
        if (purgeResult.ok) {
          return new Response("Cache purged successfully", { status: 200 });
        }
        const cfToken = (env as any).CLOUDFLARE_API_TOKEN;
        const cfZoneId = (env as any).CLOUDFLARE_ZONE_ID;
        if (cfToken && cfZoneId) {
          const apiResponse = await fetch("https://api.cloudflare.com/client/v4/zones/" + cfZoneId + "/purge_cache", {
            method: "POST",
            headers: { "Authorization": "Bearer " + cfToken, "Content-Type": "application/json" },
            body: JSON.stringify({ purge_everything: true })
          });
          const result = await apiResponse.json();
          if (result.success) {
            return new Response("Cache purged via Cloudflare API", { status: 200 });
          }
        }
        return new Response("Cache purge attempted", { status: 202 });
      } catch (e) {
        return new Response("Purge error: " + (e instanceof Error ? e.message : String(e)), { status: 500 });
      }
    }
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }
    if (pathname !== "/" && !isApiRoute) {
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404) {
        return addSecurityHeaders(asset);
      }
    }
    const response = await fetchHandler.fetch(request);
    let securedResponse = addSecurityHeaders(response);
    if (isApiRoute || (origin && origin.includes("nakshatra-canvas"))) {
      securedResponse = addCorsHeaders(securedResponse, origin || "*");
    }
    return securedResponse;
  },
  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processWallpaperJob(message.body, env);
        message.ack();
      } catch (err) {
        console.error("Queue processing failed:", err);
        message.retry();
      }
    }
  },
};

export default baseHandler;

export { JobsDurableObject };
`;

const workerTsPath = resolve(OUT_DIR, "worker.ts");
writeFileSync(workerTsPath, workerEntry);

console.log("[3/3] compiling worker.ts to worker.js with esbuild");
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
const externalArgs = nodeBuiltins.map(b => `--external:${b}`).join(" ");
// Alias react-dom/server to react-dom/server.edge to avoid dynamic requires
await $`npx esbuild ${workerTsPath} --bundle --platform=node --format=esm --outfile=${resolve(OUT_DIR, "worker.js")} --external:cloudflare:workers --external:@neondatabase/serverless --external:razorpay ${externalArgs} --alias:react-dom/server=react-dom/server.edge`;

// Post-process worker.js to rewrite dynamic requires for Cloudflare Workers compatibility
const workerJsPath = resolve(OUT_DIR, "worker.js");
let workerJs = readFileSync(workerJsPath, "utf-8");
workerJs = workerJs
  .replace(/__require\("util"\)/g, `__require("node:util")`)
  .replace(/__require\("crypto"\)/g, `__require("node:crypto")`)
  .replace(/__require\("stream"\)/g, `__require("node:stream")`)
  .replace(/__require\("async_hooks"\)/g, `__require("node:async_hooks")`)
  .replace(/__require\("react-dom\/server\.node\.js"\)/g, `__require("react-dom/server.edge.js")`)
  .replace(/__require\("react-dom\/server\.node"\)/g, `__require("react-dom/server.edge")`);
writeFileSync(workerJsPath, workerJs);

const { size } = statSync(resolve(OUT_DIR, "server.js"));
console.log(`build:cloudflare: OK -> ${resolve(OUT_DIR)} (server.js: ${String(size)} bytes)`);
