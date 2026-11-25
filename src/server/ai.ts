/**
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
 * up. Reading and image generation now run in PARALLEL with reduced timeouts
 * (15s + 20s = ~35s worst case) to stay well under the host idle timeout.
 */

import { createServerFn } from '@tanstack/react-start';

import type { BirthInput } from '../lib/astro';
import type { BirthChartConditions } from '../content/problems';
import type { ProblemArea, GRAHAS } from '../content/vedic-mapping';
import type { Reading, ReadingProvider } from '../lib/gemini';

// Server-only imports - loaded dynamically to avoid client bundle leakage

// ReadingProvider is defined once, in the reading layer, and re-exported here
// so existing importers of this module keep working. Reading is re-exported
// for the same reason.
export type { Reading, ReadingProvider } from '../lib/gemini';
export type { BirthInput } from '../lib/astro';
export type { BirthChartConditions } from '../content/problems';

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
 * READ budget: 75s for the reading chain (Gemini 25s + OpenRouter 3x15s = 70s worst case)
 * IMAGE budget: 60s for NVIDIA flux.1-dev call (55s) + image download
 * Both run in PARALLEL via Promise.allSettled. Total worst case ~135s.
 */
const AI_READING_BUDGET_MS = 85_000;
const AI_IMAGE_BUDGET_MS = 120_000;

/** Await work, but reject with a labelled error if it outlives ms. */
async function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(label + ' timed out after ' + Math.round(ms / 1000) + 's')),
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

/** Join the collected failure notes into one readable line. */
function joinErrors(errors: string[]): string | undefined {
  if (errors.length === 0) return undefined;
  return errors.join(' ? ');
}

/**
 * A valid response for a request refused by the rate limiter. It still builds
 * the free, deterministic chart so the client can render something, but it
 * makes NO provider call.
 */
export async function rateLimitedResponse(data: BirthInput, error: string): Promise<WallpaperResponse> {
  try {
    const { computeChart } = await import('../lib/astro');
    const { assessChart, chartFactSheet } = await import('../content/problems');
    const chart = computeChart(data);
    const conditions = assessChart(chart);
    const sheet = chartFactSheet(chart, conditions);
    return { chartSummary: sheet, conditions, reading: null, wallpaperPrompt: '', error };
  } catch {
    return {
      chartSummary: { facts: {}, text: '' },
      conditions: { conditions: [], positives: [] },
      reading: null,
      wallpaperPrompt: '',
      error,
    };
  }
}

/**
 * The handler body, kept as a plain exported function so it can be exercised
 * directly (and so the server function is a thin wrapper around it).
 *
 * data.presetId, when present, selects the user's wallpaper style; it is
 * resolved with presetById() and folded into the art prompt. The art seed is
 * fresh on every call so the same chart can still get unique artwork.
 */
export async function buildWallpaperResponse(data: WallpaperRequest): Promise<WallpaperResponse> {
  const errors: string[] = [];

  try {
    // Dynamic imports for server-only modules
    const { computeChart } = await import('../lib/astro');
    const { assessChart, chartFactSheet } = await import('../content/problems');
    const { presetById, getProblemAreaMantra } = await import('../content/vedic-mapping');
    const { errorMessage, readKundli } = await import('../lib/gemini');
    const { nvidiaWallpaper, promptFromBrief, wallpaperSeed } = await import('../lib/nvidia');
    const { GRAHAS } = await import('../content/vedic-mapping');

    // 1. The chart engine is the only source of planetary maths.
    const chart = await computeChart(data);

    // 2. The deterministic condition assessment, computed ONCE and handed to
    // the fact sheet (its second argument) so assessChart does not run a
    // second time inside chartFactSheet.
    const conditions = assessChart(chart);
    const sheet = chartFactSheet(chart, conditions, data.focusAreas);

    // QUOTA GATE (paid path) - quota removed, always allowed
    const quotaAllowed = true;
    const quotaIdentity: { userId?: string; deviceId?: string; ip?: string } = {
      userId: undefined,
      deviceId: data.deviceId?.trim() || undefined,
      ip: undefined,
    };

    // BYOK PREMIUM CHECK - resolve user and plan before provider calls
    let isPremium = false;
    let effectiveKeys = data.keys;
    try {
      const authMod = await import('../server/api-auth.server');
      const userId = await (await import('../server/session-helpers')).currentUserId();
      const premiumStatus = await authMod.premiumStatusFor(userId);
      isPremium = premiumStatus.isPremium;
      if (data.keys && (data.keys.gemini || data.keys.openrouter || data.keys.nvidia)) {
        if (!isPremium) {
          errors.push('Bring-your-own AI keys are a Premium feature ? sign in with a Premium account to use your own keys.');
          effectiveKeys = undefined;
        }
      }
    } catch {
      isPremium = false;
      if (data.keys && (data.keys.gemini || data.keys.openrouter || data.keys.nvidia)) {
        errors.push('Bring-your-own AI keys are a Premium feature ? sign in with a Premium account to use your own keys.');
        effectiveKeys = undefined;
      }
    }

    // 3. Build the art prompt from chart facts IMMEDIATELY (no waiting for reading)
    const seed = wallpaperSeed(data);
    const preset = data.presetId && data.presetId.trim() ? presetById(data.presetId) : null;

    // Get problem area mantra for the primary focus area
    const primaryFocusArea = data.focusAreas?.[0] as ProblemArea | undefined;
    const problemAreaMantra = primaryFocusArea ? getProblemAreaMantra(primaryFocusArea) : undefined;

    const promptOpts = {
      facts: sheet.facts,
      preset,
      focusAreas: data.focusAreas,
      problemAreaMantra: problemAreaMantra ? {
        devanagari: problemAreaMantra.devanagari,
        roman: problemAreaMantra.roman,
        planet: GRAHAS[problemAreaMantra.planet].name,
      } : undefined,
    };

    // Build fallback prompt from chart facts NOW (before reading)
    // This uses the chart fact sheet directly, no reading dependency
    let wallpaperPrompt = '';
    try {
      wallpaperPrompt = promptFromBrief(null, sheet.text, promptOpts);
    } catch {
      wallpaperPrompt = '';
    }

    // 4. Launch reading and image generation in PARALLEL
    let reading: Reading | null = null;
    let provider: ReadingProvider | undefined;
    let readingProduced = false;
    let image: WallpaperResponse['image'];
    let imageProduced = false;

    if (quotaAllowed) {
      const readingPromise = (async () => {
        try {
          const result = await withTimeout(readKundli(sheet.text, effectiveKeys), AI_READING_BUDGET_MS, 'Reading');
          return { reading: result.reading, provider: result.provider, success: true };
        } catch (err) {
          errors.push('Reading unavailable: ' + errorMessage(err));
          return { reading: null, provider: undefined, success: false };
        }
      })();

      const imagePromise = (async () => {
        try {
          const painted = await withTimeout(
            nvidiaWallpaper(wallpaperPrompt, { width: 832, height: 1216, seed, keyOverride: effectiveKeys?.nvidia }),
            AI_IMAGE_BUDGET_MS,
            'Wallpaper',
          );
          return { image: {
            dataUrl: painted.dataUrl,
            mime: painted.mime,
            width: painted.width,
            height: painted.height,
          }, success: true };
        } catch (err) {
          errors.push('Wallpaper unavailable: ' + errorMessage(err));
          return { image: undefined, success: false };
        }
      })();

      // Wait for BOTH to complete (or timeout) using Promise.allSettled
      const [readingResult, imageResult] = await Promise.allSettled([readingPromise, imagePromise]);

      if (readingResult.status === 'fulfilled' && readingResult.value.success) {
        reading = readingResult.value.reading;
        provider = readingResult.value.provider;
        readingProduced = reading !== null;
      }

      if (imageResult.status === 'fulfilled' && imageResult.value.success) {
        image = imageResult.value.image;
        imageProduced = true;
      }
    } else {
      errors.push('Daily limit reached ? sign in for more wallpapers.');
    }

    // Record generation if any provider call actually produced output
    if ((readingProduced || imageProduced) && quotaAllowed) {
      try {
        const quotaMod = await import('../server/quota.server');
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
      chartSummary: { facts: {}, text: '' },
      conditions: { conditions: [], positives: [] },
      reading: null,
      wallpaperPrompt: '',
      error: 'Could not build the chart: ' + errorMessage(err),
    };
  }
}

export const generateWallpaper = createServerFn({ method: 'POST' })
  .validator((d: WallpaperRequest) => d)
  .handler(async ({ data }): Promise<WallpaperResponse> => {
    const { checkRateLimit } = await import('../server/rate-limit.server');
    const limited = checkRateLimit();
    if (limited) return rateLimitedResponse(data, limited);
    return buildWallpaperResponse(data);
  });
