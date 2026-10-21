/**
 * The premium wallpaper background: NVIDIA NIM running FLUX.1-dev.
 *
 * This is a real image-model call. The model paints only the ART — the
 * deterministic renderer overlays the Devanagari mantra and the kundli on
 * top of it, which is why every prompt ends with "no readable text, no
 * watermark".
 */

import { nvidiaKey } from "~/lib/server-key";
import { GRAHAS } from "~/content/vedic-mapping";
import type { Reading } from "~/lib/gemini";

const NVIDIA_ENDPOINT = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev";
const NVIDIA_TIMEOUT_MS = 60_000;
const DEFAULT_WIDTH = 832;
const DEFAULT_HEIGHT = 1216;
const DEFAULT_SEED = 42;

/** The result of one image call. */
export interface WallpaperImage {
  dataUrl: string;
  mime: string;
  width: number;
  height: number;
}

/*
 * ------------------------------------------------------------- image cache
 *
 * The docs promise a seven-day image cache, so an identical prompt must not
 * re-call the paid model. The key is the FINAL prompt plus the render
 * parameters that change the pixels (seed, width, height); the model itself
 * is fixed by NVIDIA_ENDPOINT, so it needs no separate key part.
 *
 * CAVEAT: this cache lives IN MEMORY, so it is PER INSTANCE - a restart, a
 * redeploy or a second replica starts empty. It bounds cost within one
 * long-lived server, which is the deployment `serve.ts` runs. Failures are
 * never cached: only a successfully painted image is stored.
 */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 50;

interface CachedImage {
  value: WallpaperImage;
  expiresAt: number;
}

const imageCache = new Map<string, CachedImage>();

/** The cache key: seed + geometry + the exact prompt bytes. */
function imageCacheKey(prompt: string, width: number, height: number, seed: number): string {
  return `${seed}|${width}x${height}|${prompt}`;
}

/** Read a live entry, dropping it first if it has expired. */
function readImageCache(key: string): WallpaperImage | undefined {
  const hit = imageCache.get(key);
  if (!hit) return undefined;
  if (Date.now() >= hit.expiresAt) {
    imageCache.delete(key);
    return undefined;
  }
  return hit.value;
}

/** Store a successful image, evicting expired entries and then the oldest. */
function writeImageCache(key: string, value: WallpaperImage): void {
  const now = Date.now();
  if (imageCache.size >= CACHE_MAX_ENTRIES) {
    for (const [k, v] of imageCache) if (now >= v.expiresAt) imageCache.delete(k);
    // Still full: drop the oldest insertion (a Map preserves insertion order).
    while (imageCache.size >= CACHE_MAX_ENTRIES) {
      const oldest = imageCache.keys().next().value;
      if (oldest === undefined) break;
      imageCache.delete(oldest);
    }
  }
  imageCache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
}

/**
 * Sniff the real mime type from the magic bytes. The API field is called
 * `base64` but the bytes are frequently JPEG, so the type is never taken on
 * trust — a mislabelled image would fail to render in the browser.
 */
export function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "image/gif";
  }
  if (bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return "image/webp";
  }
  return null;
}

/** Turn raw bytes into a data URL with the sniffed mime type. */
function toDataUrl(bytes: Uint8Array, fallbackMime: string): { dataUrl: string; mime: string } {
  const mime = sniffImageMime(bytes) ?? fallbackMime;
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const b64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");
  return { dataUrl: `data:${mime};base64,${b64}`, mime };
}

/**
 * Paint one wallpaper background with FLUX.1-dev.
 *
 * The model may answer either with inline base64 or with a URL to fetch; both
 * are handled. The returned mime type is always sniffed from the bytes.
 *
 * A successful result is memoised (see the image cache above) so an identical
 * prompt is painted once, not once per visitor.
 */
export async function nvidiaWallpaper(
  prompt: string,
  opts?: { width?: number; height?: number; seed?: number },
): Promise<WallpaperImage> {
  const key = nvidiaKey();
  const width = opts?.width ?? DEFAULT_WIDTH;
  const height = opts?.height ?? DEFAULT_HEIGHT;
  const seed = opts?.seed ?? DEFAULT_SEED;

  // Serve an identical request from the cache without touching the paid model.
  const cacheKey = imageCacheKey(prompt, width, height, seed);
  const cached = readImageCache(cacheKey);
  if (cached) return cached;

  const res = await fetch(NVIDIA_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, width, height, seed }),
    signal: AbortSignal.timeout(NVIDIA_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = (await res.text()).trim().slice(0, 300);
    throw new Error(`NVIDIA request failed (${res.status} ${res.statusText}): ${body}`);
  }

  const payload = (await res.json()) as {
    artifacts?: { base64?: unknown; url?: unknown }[];
    data?: { b64_json?: unknown; url?: unknown }[];
  };

  const artifact = payload?.artifacts?.[0];
  const inline =
    typeof artifact?.base64 === "string"
      ? artifact.base64
      : typeof payload?.data?.[0]?.b64_json === "string"
        ? payload.data[0].b64_json
        : null;

  if (inline) {
    const bytes = new Uint8Array(Buffer.from(inline, "base64"));
    if (bytes.length === 0) throw new Error("NVIDIA returned an empty image");
    const { dataUrl, mime } = toDataUrl(bytes, "image/jpeg");
    const image: WallpaperImage = { dataUrl, mime, width, height };
    writeImageCache(cacheKey, image);
    return image;
  }

  const url =
    typeof artifact?.url === "string"
      ? artifact.url
      : typeof payload?.data?.[0]?.url === "string"
        ? payload.data[0].url
        : null;

  if (url) {
    const imgRes = await fetch(url, { signal: AbortSignal.timeout(NVIDIA_TIMEOUT_MS) });
    if (!imgRes.ok) {
      const body = (await imgRes.text()).trim().slice(0, 200);
      throw new Error(`NVIDIA image download failed (${imgRes.status} ${imgRes.statusText}): ${body}`);
    }
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    if (bytes.length === 0) throw new Error("NVIDIA image download was empty");
    const { dataUrl, mime } = toDataUrl(bytes, "image/jpeg");
    const image: WallpaperImage = { dataUrl, mime, width, height };
    writeImageCache(cacheKey, image);
    return image;
  }

  throw new Error("NVIDIA returned no image data");
}

/* ------------------------------------------------------------- the prompt */

/**
 * The negative clause that must survive the word budget: the deterministic
 * renderer draws the Devanagari mantra and the kundli ON TOP of this image, so
 * the model must not paint any lettering of its own.
 */
const NO_TEXT_CLAUSE =
  "Symmetrical mandala composition, deep shadows, soft volumetric light, no readable text, no watermark, no lettering, no caption, no frame, no border.";

/** Keep a prompt under a word budget without cutting mid-word. */
function clampWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return `${words.slice(0, maxWords).join(" ")}`.trim();
}

/**
 * Build the art prompt from the reading's brief AND the chart facts.
 *
 * The brief alone would produce generic devotional art; the chart facts are
 * what make it this person's: the nakshatra's classical symbol, its deity,
 * and the ruling planet's classical colours (all pulled from
 * `src/content/vedic-mapping.ts`, never hard-coded here).
 */
export function promptFromBrief(reading: Reading | null, chartFacts: string): string {
  const brief = reading?.wallpaperBrief;
  const mood = brief?.mood?.trim();
  const palette = brief?.palette?.trim();
  const motifs = brief?.motifs?.trim();

  // Pull the chart-specific ingredients out of the fact sheet.
  const nakshatra = /(?:Nakshatra|nakshatra):\s*([^.(]+)/.exec(chartFacts)?.[1]?.trim() ?? "";
  const deity = /(?:Deity|deity):\s*([^.(]+)/.exec(chartFacts)?.[1]?.trim() ?? "";
  const symbol = /(?:Symbol|symbol):\s*([^.(]+)/.exec(chartFacts)?.[1]?.trim() ?? "";
  const ruling = /(?:Ruling planet|Ruling Planet|ruling planet):\s*([^.(]+)/.exec(chartFacts)?.[1]?.trim() ?? "";
  const colour = /(?:colours|colors)\s+([#\w ,()/]+?)(?:;|bija|$)/.exec(chartFacts)?.[1]?.trim() ?? "";

  // The ruling planet's classical colours, straight from the content table.
  const rulingKey = Object.keys(GRAHAS).find(
    (k) => ruling && GRAHAS[k as keyof typeof GRAHAS].name === ruling.split("(")[0].trim(),
  );
  const graha = rulingKey ? GRAHAS[rulingKey as keyof typeof GRAHAS] : null;

  // The prompt is assembled in PRIORITY order: the mandatory negative clause
  // and the chart-derived ingredients come first, the reading's brief next.
  // The word budget is then spent front-to-back, so a long brief can never
  // push out the parts that make the art chart-specific.
  const parts: string[] = [];

  if (nakshatra) {
    parts.push(
      `Central motif: the classical symbol of the nakshatra ${nakshatra} (${symbol || "its traditional emblem"}).`,
    );
  }
  if (deity) {
    parts.push(
      `A subtle reverent presence of the deity ${deity} in the background, serene and abstract, never a portrait photograph.`,
    );
  }
  if (graha) {
    parts.push(
      `Palette anchored on the classical colours of the ruling planet ${graha.name}: ${graha.colour.accent} highlight, ${graha.colour.deep} ground, ${graha.colour.glow} glow.`,
    );
  } else if (colour) {
    parts.push(`Palette anchored on the ruling planet's colours: ${colour}.`);
  }
  if (mood) parts.push(`Mood: ${mood}.`);
  if (motifs) parts.push(`Include ${motifs}.`);
  if (palette) parts.push(`Additional colour notes: ${palette}.`);
  if (brief?.inscription?.trim()) {
    parts.push("Leave a clear calm area in the centre for a sacred inscription to be added later.");
  }
  parts.push(
    "Premium devotional Indian astrology wallpaper art, vertical portrait, temple-gold linework on a deep indigo-black ground, intricate yantra geometry, fine gold filigree, subtle film grain, museum-quality digital painting.",
  );

  // The negative clause is mandatory and is reserved its word budget FIRST,
  // so the clamp can never truncate it away.
  const tailWords = NO_TEXT_CLAUSE.split(/\s+/).length;
  const body = clampWords(parts.join(" "), Math.max(20, 100 - tailWords - 1));

  return `${body} ${NO_TEXT_CLAUSE}`;
}