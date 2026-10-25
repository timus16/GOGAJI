import fs from "fs";

const content = `/**
 * The server boundary of the AI step.
 *
 * Two rules hold here, and they are the reason this file exists:
 *  1. The deterministic chart engine is the ONLY source of planetary maths.
 *     computeChart() computes the positions; the model is only ever given a
 *     fact sheet built from that chart. An LLM never computes a position.
 *  2. This handler NEVER throws. A missing key, a 429, a timeout, invalid
 *     JSON - all of them degrade to reading: null and/or no image plus a
 *     human-readable error, so the chart-accurate SVG path stays usable.
 *
 * A third rule is enforced here too: THE WHOLE REQUEST IS BUDGETED. Each
 * provider adapter carries its own internal timeout, but their worst cases add
 * up (the reading chain can spend 45s on Gemini, then 3x30s on OpenRouter,
 * then 30s on Baidu, and the art can spend 60s calling NVIDIA plus 60s
 * downloading the image). Unbounded, that is well past the host'"'"'s idle
 * timeout - serve.ts pins Bun idleTimeout = 255s, and a serverless host caps
 * a function'"'"'s duration lower still - so a slow-but-successful chain would be
 * killed and the client would get an empty 502 instead of the intended
 * degrade. The reading and the image are therefore each wrapped in a timeout
 * race, keeping the request'"'"'s total worst case well under ~200s.
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { computeChart, type BirthInput } from "~/lib/astro";
import { assessChart, chartFactSheet, type BirthChartConditions } from "~/content/problems";
import { presetById } from "~/content/vedic-mapping";
import { errorMessage, readKundli, type Reading, type ReadingProvider } from "~/lib/gemini";
import { nvidiaWallpaper, promptFromBrief, wallpaperSeed } from "~/lib/nvidia";

// Server-only imports - loaded dynamically to avoid client bundle leakage
// import { currentQuotaIdentity, enforceQuota, recordGeneration } from "~/server/quota";
// import { currentUserId } from "~/server/session";
// import { premiumStatusFor } from "~/server/api-auth";

// ReadingProvider is defined once, in the reading layer, and re-exported here
// so existing importers of this module keep working. Reading is re-exported
// for the same reason.
export type { Reading, ReadingProvider } from "~/lib/gemini";
export type { BirthInput } from "~/lib/astro";
export type { BirthChartConditions } from "~/content/problems";

/**
 * The accepted request body: the birth input plus the OPTIONAL style preset id
 * the client may send. presetId is optional, so a client that omits it keeps
 * the exact previous, chart-only behaviour.
 * deviceId is optional and used for anonymous quota accounting.
 */
export type WallpaperRequest = BirthInput & { presetId?: string; focusAreas?: string[]; keys?: { gemini?: string; openrouter?: string; nvidia?: string }; deviceId?: string };

/** The fact sheet the model was given - the chart, in flat text. */
export interface ChartSummary {
  facts: Record<string, string>;
  text: string;
}

/** What the client gets back. */
export interface WallpaperResponse {
  chartSummary: ChartSummary;
  conditions: BirthChartConditions;
  reading: Reading | null;
  image?: { dataUrl: string; mime: string; width: number; height: number };
  wallpaperPrompt: string;
  provider?: ReadingProvider;
  error?: string;
}

/*
 * ------------------------------------------------------------ AI time budget
 *
 * Promise.race() returns the moment the timer wins, but it CANNOT cancel the
 * losing promise: the provider fetch keeps running in the background (and, for
 * the reading chain, may still fall through to the next provider and make a
 * paid call). That is an accepted cost - the signatures of readKundli() and
 * nvidiaWallpaper() are fixed and owned elsewhere, so an AbortSignal cannot
 * be threaded through them. The race only decides how long THIS handler waits
 * before degrading to reading: null / no image plus an error.
 *
 * READ budget covers the whole reading chain; IMAGE budget covers the NVIDIA
 * call and, when the API answers with a URL, its image download. Summed worst
 * case is ~70s + ~95s = ~165s, comfortably under the serve.ts idle timeout and
 * the ~200s ceiling.
 */
const AI_READING_BUDGET_MS = 70_000;
const AI_IMAGE_BUDGET_MS = 95_000;

/** Await work, but reject with a labelled error if it outlives ms. */
async function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(label + " timed out after " + Math.round(ms / 1000) + "s")),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/*
 * -------------------------------------------------- rate limiting (paid path)
 *
 * generateWallpaper fronts paid providers, so it is throttled. This is a
 * simple fixed-window counter keyed by client IP (falling back to a single
 * global bucket when no IP can be read), configurable with AI_RATE_LIMIT_PER_MIN
 * (default 5).
 *
 * CAVEAT: the store is in-memory, so the limit is PER INSTANCE - behind a load
 * balancer or on a serverless host each instance keeps its own counters and the
 * effective limit multiplies by the number of instances. A production
 * deployment should front this endpoint with a durable limiter (Redis/Upstash)
 * and a bot check; this guard only blunts casual abuse.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_DEFAULT = 5;

/** The configured requests-per-minute limit, or the default when unset/invalid. */
function rateLimitPerMinute(): number {
  const raw = process.env.AI_RATE_LIMIT_PER_MIN;
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : RATE_LIMIT_DEFAULT;
}

interface RateWindow {
  count: number;
  resetAt: number;
}

const rateWindows = new Map<string, RateWindow>();

/**
 * The limiter key for this request. getRequestIP() reads the request stored
 * by the TanStack Start server-function runtime; it throws when there is no
 * request context (for example when buildWallpaperResponse() is called
 * directly), so the lookup is guarded and falls back to one global bucket.
 * xForwardedFor: true is safe here because the site is served behind a
 * reverse proxy (see serve.ts); the header is trusted only on that path.
 */
function rateLimitKey(): string {
  try {
    const ip = getRequestIP({ xForwardedFor: true });
    if (ip) return ip;
  } catch {
  }
  return "*global*";
}

/**
 * Consume one unit for this client. Returns an explanatory string when the
 * window is exhausted, or undefined when the request may proceed.
 */
function checkRateLimit(): string | undefined {
  const limit = rateLimitPerMinute();
  const now = Date.now();
  const key = rateLimitKey();
  let win = rateWindows.get(key);
  if (!win || now >= win.resetAt) {
    win = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateWindows.set(key, win);
  }
  win.count += 1;
  if (win.count > limit) {
    const retry = Math.max(1, Math.ceil((win.resetAt - now) / 1000));
    return "Rate limit reached for AI generation (" + limit + " requests per minute). Try again in about " + retry + "s.";
  }
  if (rateWindows.size > 5000) {
    for (const [k, w] of rateWindows) if (now >= w.resetAt) rateWindows.delete(k);
  }
  return undefined;
}

/** Join the collected failure notes into one readable line. */
function joinErrors(errors: string[]): string | undefined {
  if (errors.length === 0) return undefined;
  return errors.join(" \\u00b7 ");
}

/**
 * A valid response for a request refused by the rate limiter. It still builds
 * the free, deterministic chart so the client can render something, but it
 * makes NO provider call.
 */
function rateLimitedResponse(data: BirthInput, error: string): WallpaperResponse {
  try {
    const chart = computeChart(data);
    const conditions = assessChart(chart);
    const sheet = chartFactSheet(chart, conditions);
    return { chartSummary: sheet, conditions, reading: null, wallpaperPrompt: "", error };
  } catch {
    return {
      chartSummary: { facts: {}, text: "" },
      conditions: { conditions: [], positives: [] },
      reading: null,
      wallpaperPrompt: "",
      error,
    };
  }
}

/**
 * The handler body, kept as a plain exported function so it can be exercised
 * directly (and so the server function is a thin wrapper around it).
 *
 * data.presetId, when present, selects the user'"'"'s wallpaper style; it is
 * resolved with presetById() and folded into the art prompt. The art is made
 * per-user by a stable seed hashed from the chart identity, so the same chart
 * always reproduces the same image.
 */
export async function buildWallpaperResponse(data: WallpaperRequest): Promise<WallpaperResponse> {
    const errors: string[] = [];

    try {
      // 1. The chart engine is the only source of planetary maths.
      const chart = computeChart(data);

      // 2. The deterministic condition assessment, computed ONCE and handed to
      //    the fact sheet (its second argument) so assessChart does not run a
      //    second time inside chartFactSheet.
      const conditions = assessChart(chart);
      const sheet = chartFactSheet(chart, conditions, data.focusAreas);

      // QUOTA GATE (paid path) - BEFORE any provider call
      let quotaAllowed = false;
      let quotaIdentity: { userId?: string; deviceId?: string; ip?: string } = { userId: undefined, deviceId: undefined, ip: undefined };
      try {
        const quotaMod = await import("~/server/quota");
        const sessionMod = await import("~/server/session");
        quotaIdentity = await quotaMod.currentQuotaIdentity(data.deviceId);
        const gate = await quotaMod.enforceQuota(quotaIdentity);
        quotaAllowed = gate.allowed;
        if (!gate.allowed && gate.reason) {
          errors.push(gate.reason);
        }
      } catch {
        quotaAllowed = false;
        errors.push("Usage could not be verified, so the premium render was skipped.");
      }

      // BYOK PREMIUM CHECK - resolve user and plan before provider calls
      let isPremium = false;
      let effectiveKeys = data.keys;
      try {
        const sessionMod = await import("~/server/session");
        const authMod = await import("~/server/api-auth");
        const userId = await sessionMod.currentUserId();
        const premiumStatus = await authMod.premiumStatusFor(userId);
        isPremium = premiumStatus.isPremium;
        if (data.keys && (data.keys.gemini || data.keys.openrouter || data.keys.nvidia)) {
          if (!isPremium) {
            errors.push("Bring-your-own AI keys are a Premium feature \\u2014 sign in with a Premium account to use your own keys.");
            effectiveKeys = undefined;
          }
        }
      } catch {
        isPremium = false;
        if (data.keys && (data.keys.gemini || data.keys.openrouter || data.keys.nvidia)) {
          errors.push("Bring-your-own AI keys are a Premium feature \\u2014 sign in with a Premium account to use your own keys.");
          effectiveKeys = undefined;
        }
      }

      // 3. The reading. A failure here must not sink the whole request. The
      //    whole chain is raced against the reading budget so a slow provider
      //    cannot hold the request open past the host'"'"'s idle timeout.
      let reading: Reading | null = null;
      let provider: ReadingProvider | undefined;
      let readingProduced = false;
      if (quotaAllowed) {
        try {
          const result = await withTimeout(readKundli(sheet.text, effectiveKeys), AI_READING_BUDGET_MS, "Reading");
          reading = result.reading;
          provider = result.provider;
          readingProduced = reading !== null;
        } catch (err) {
          errors.push("Reading unavailable: " + errorMessage(err));
        }
      } else {
        errors.push("Daily limit reached \\u2014 sign in for more wallpapers.");
      }

      // 4. The artwork, strictly AFTER the reading (never concurrently) because
      //    the art prompt prefers the reading'"'"'s wallpaper brief and only falls
      //    back to chart facts when the reading is missing.
      const seed = wallpaperSeed(data);
      const preset = data.presetId && data.presetId.trim() ? presetById(data.presetId) : null;
      const promptOpts = { facts: sheet.facts, preset, focusAreas: data.focusAreas };

      let wallpaperPrompt = "";
      let image: WallpaperResponse["image"];
      let imageProduced = false;
      if (quotaAllowed) {
        try {
          wallpaperPrompt = promptFromBrief(reading, sheet.text, promptOpts);
          const painted = await withTimeout(
            nvidiaWallpaper(wallpaperPrompt, { width: 832, height: 1216, seed, keyOverride: effectiveKeys?.nvidia }),
            AI_IMAGE_BUDGET_MS,
            "Wallpaper",
          );
          image = {
            dataUrl: painted.dataUrl,
            mime: painted.mime,
            width: painted.width,
            height: painted.height,
          };
          imageProduced = true;
        } catch (err) {
          errors.push("Wallpaper unavailable: " + errorMessage(err));
          if (!wallpaperPrompt) {
            try {
              wallpaperPrompt = promptFromBrief(reading, sheet.text, promptOpts);
            } catch {
              wallpaperPrompt = "";
            }
          }
        }
      } else {
        try {
          wallpaperPrompt = promptFromBrief(null, sheet.text, promptOpts);
        } catch {
          wallpaperPrompt = "";
        }
      }

      // Record generation if any provider call actually produced output
      if ((readingProduced || imageProduced) && quotaAllowed) {
        try {
          const quotaMod = await import("~/server/quota");
          await quotaMod.recordGeneration({
            ...quotaIdentity,
            presetId: data.presetId,
            nakshatra: sheet.facts.nakshatra,
            focusAreas: data.focusAreas,
          });
        } catch {
        }
      }

      const response: WallpaperResponse = {
        chartSummary: sheet,
        conditions,
        reading,
        wallpaperPrompt,
      };
      if (image) response.image = image;
      if (provider) response.provider = provider;
      const error = joinErrors(errors);
      if (error) response.error = error;
      return response;
    } catch (err) {
      return {
        chartSummary: { facts: {}, text: "" },
        conditions: { conditions: [], positives: [] },
        reading: null,
        wallpaperPrompt: "",
        error: "Could not build the chart: " + errorMessage(err),
      };
    }
}

export const generateWallpaper = createServerFn({ method: "POST" })
  .validator((d: WallpaperRequest) => d)
  .handler(async ({ data }): Promise<WallpaperResponse> => {
    const limited = checkRateLimit();
    if (limited) return rateLimitedResponse(data, limited);
    return buildWallpaperResponse(data);
  });
`;

fs.writeFileSync("E:/sentir/gogaji/GOGAJI/src/server/ai.ts", content);
console.log("File written successfully");
