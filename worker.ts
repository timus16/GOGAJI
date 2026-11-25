// Cloudflare Workers entry for the Nakshatra Canvas (team-site) app.
//
//
import "./polyfill.ts";
import { buildWallpaperResponse, type WallpaperRequest } from "~/server/ai";
import { processWallpaperJob } from "./src/server/queue-consumer";
import { JobsDurableObject } from "./src/server/jobs-do";
import handler from "./dist/server/server.js";
import { createSentryOptions, captureException } from "./src/lib/sentry.worker";
import { syncEnv } from "./src/server/env-sync";

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

async function handleJobStatus(request: Request, env: Env): Promise<Response> {
  try {
    const { pathname } = new URL(request.url);
    const jobId = pathname.split("/api/job/")[1];
    if (!jobId) {
      return new Response(JSON.stringify({ error: "Missing job ID" }), { status: 400 });
    }
    const doId = env.JOBS_DO.idFromName("jobs");
    const stub = env.JOBS_DO.get(doId);
    const job = await stub.getJob(jobId);
    if (!job) {
      return new Response(JSON.stringify({ error: "Job not found" }), { status: 404 });
    }
    return new Response(JSON.stringify({
      jobId: job.id,
      status: job.status,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Job status error:", err);
    captureException(err);
    return new Response(JSON.stringify({ error: "Status check failed" }), { status: 500 });
  }
}

async function handleGenerate(request: Request, env: Env): Promise<Response> {
  try {
    const data = await request.json();
    const date = data.date || data.birthDate;
    const time = data.time || data.birthTime;
    const place = data.place || data.birthPlace;
    if (!data.name?.trim() || !date || !time || !place?.trim()) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }
    const payload: WallpaperRequest = {
      ...data, date, time, place,
      latitude: data.latitude || 28.6139,
      longitude: data.longitude || 77.2090,
      timezone: data.timezone || "Asia/Kolkata",
      presetId: data.presetId || "temple-gold",
      focusAreas: data.focusAreas || ["all"],
      regionalSystem: data.regionalSystem || "vedic",
      subject: data.subject || "child",
    };
    const response = await buildWallpaperResponse(payload);
    return new Response(JSON.stringify(response), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Generate API error:", err);
    captureException(err);
    return new Response(JSON.stringify({ error: "Generation failed: " + (err instanceof Error ? err.message : String(err)) }), { status: 500 });
  }
}

const baseHandler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Sync Cloudflare env to process.env for modules that read from it
    syncEnv(env);
    
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
    if (pathname.startsWith("/api/job/") && request.method === "GET") {
      const response = await handleJobStatus(request, env);
      let securedResponse = addSecurityHeaders(response);
      if (isApiRoute || (origin && origin.includes("nakshatra-canvas"))) {
        securedResponse = addCorsHeaders(securedResponse, origin || "*");
      }
      return securedResponse;
    }
    if (pathname === "/api/generate" && request.method === "POST") {
      const response = await handleGenerate(request, env);
      let securedResponse = addSecurityHeaders(response);
      if (isApiRoute || (origin && origin.includes("nakshatra-canvas"))) {
        securedResponse = addCorsHeaders(securedResponse, origin || "*");
      }
      return securedResponse;
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
    syncEnv(env);
    for (const message of batch.messages) {
      try {
        await processWallpaperJob(message.body, env);
        message.ack();
      } catch (err) {
        console.error("Queue processing failed:", err);
        captureException(err);
        message.retry();
      }
    }
  },
};

export default baseHandler;

export { JobsDurableObject };



