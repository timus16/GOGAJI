/**
 * The reading layer: one canonical prompt, one strict JSON shape, and the
 * provider adapters that produce it.
 *
 * Every provider (Gemini, OpenRouter, Baidu) is given the SAME prompt built by
 * `buildReadingPrompt()` and every provider's answer is forced through the
 * SAME validator `sanitizeReading()`, so the shape the UI receives is
 * identical no matter which model answered.
 *
 * The planetary maths is never done here: the caller passes a fact sheet that
 * was produced by the deterministic chart engine (`src/content/problems.ts`),
 * and the model is told to reason ONLY from those facts.
 */

import { geminiKey } from "~/lib/server-key";
import { openrouterReading } from "~/lib/openrouter";
import { LIFE_AREAS } from "~/content/problems";

/** One remedy: a practice, its mantra in both scripts, its deity and its day. */
export interface Remedy {
  title: string;
  detail: string;
  mantraDevanagari: string;
  mantraRoman: string;
  deity: string;
  day: string;
}

/** Art direction for the premium wallpaper the image model paints. */
export interface WallpaperBrief {
  mood: string;
  palette: string;
  motifs: string;
  inscription: string;
}

/** The one shape every provider must return. */
export interface Reading {
  condition: string;
  primary: string[];
  reading: string;
  remedies: Remedy[];
  affirmation: string;
  wallpaperBrief: WallpaperBrief;
}

/** Which provider answered. */
export type ReadingProvider = "gemini" | "openrouter" | "baidu";

/**
 * The closed vocabulary a reading may focus on. The domain layer
 * (`~/content/problems`) owns the canonical list, so it is imported here
 * rather than re-declared (a literal copy could silently drift); the model
 * is only ever offered exactly these values.
 */
const ALLOWED_LIFE_AREAS: readonly string[] = LIFE_AREAS;

/** The Gemini model id that works with the current key. */
const GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_TIMEOUT_MS = 45_000;

/* --------------------------------------------------------------- prompting */

/**
 * THE canonical prompt. Every provider reuses it verbatim so the model sees
 * identical instructions no matter which one answers. Keep it tight — this is
 * the single biggest token cost in the request.
 */
export function buildReadingPrompt(chartSummary: string, focusAreas?: string[]): string {
  const focusLine =
    focusAreas && focusAreas.length
      ? `\nQUERENT'S STATED FOCUS: ${focusAreas.join(", ")}. Weight the interpretation and the remedies toward these areas without ignoring contraindications.\n`
      : "";
  return `You are a learned Vedic astrologer and a devotional guide. Reason ONLY from the chart facts supplied below: never calculate, recall or invent a planetary position, a sign, a nakshatra or a deity that is not written in the facts.
${focusLine}
CHART FACTS (the only source of truth):
${chartSummary}

Voice: compassionate and devotional. Name the person's condition honestly, then help them overcome it. Be practical and specific. Never fatalistic, never alarming, never medical, legal or financial advice, and never a prediction of death or disaster.

Answer with STRICT JSON only — no markdown, no code fences, no text before or after — shaped exactly like this:
{
  "condition": "<one sentence naming the main condition, at most 12 words>",
  "primary": ["<life area>"],
  "reading": "<120 to 180 words of flowing guidance, grounded in the chart facts>",
  "remedies": [
    {
      "title": "<short name of the remedy>",
      "detail": "<one or two sentences saying how to do it>",
      "mantraDevanagari": "<the mantra written in Devanagari script>",
      "mantraRoman": "<the same mantra in roman transliteration>",
      "deity": "<the presiding deity>",
      "day": "<the best weekday to practise it>"
    }
  ],
  "affirmation": "<one short first-person affirmation line>",
  "wallpaperBrief": {
    "mood": "<visual mood, 2 to 4 words>",
    "palette": "<colour palette, 3 to 6 words>",
    "motifs": "<symbols and forms to draw, 3 to 6 words>",
    "inscription": "<a short sacred line for the artwork>"
  }
}

Rules:
- "primary" may contain only these values: ${ALLOWED_LIFE_AREAS.join(", ")}. Give 1 to 3 of them.
- "remedies" must hold exactly 2 or 3 entries. Each entry needs a Devanagari mantra AND its roman transliteration, the deity and the best weekday. Choose mantras and deities that match the deities and the ruling planet named in the chart facts.
- "wallpaperBrief" describes a premium devotional artwork to be painted behind the mantra; it must not ask for any lettering to be drawn.
- Every field above is required. Use double quotes. Output the JSON object and nothing else.`;
}

/* --------------------------------------------------------------- validation */

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Read a string field, tolerating numbers, and trim it. Never throws. */
function readString(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

/**
 * Force a parsed JSON payload into the `Reading` shape.
 *
 * Missing or wrongly typed fields become safe defaults, `primary` entries that
 * are not real life areas are dropped, and the remedies are clamped to at
 * most three usable entries. Returns null when the payload is not a plain
 * object at all. Never throws.
 */
export function sanitizeReading(raw: unknown): Reading | null {
  if (!isPlainObject(raw)) return null;

  const condition = readString(raw.condition);
  const readingText = readString(raw.reading);
  const affirmation = readString(raw.affirmation);

  // primary: keep only real life areas, de-duplicated, order preserved.
  const primary: string[] = [];
  const rawPrimary: unknown[] = Array.isArray(raw.primary)
    ? raw.primary
    : typeof raw.primary === "string"
      ? [raw.primary]
      : [];
  for (const entry of rawPrimary) {
    if (typeof entry !== "string") continue;
    const area = entry.trim().toLowerCase();
    if (!area) continue;
    if (!ALLOWED_LIFE_AREAS.includes(area)) continue;
    if (primary.includes(area)) continue;
    primary.push(area);
  }

  // remedies: coerce each row, drop empty rows, keep at most three.
  const remedies: Remedy[] = [];
  const rawRemedies = Array.isArray(raw.remedies) ? raw.remedies : [];
  for (const row of rawRemedies) {
    if (!isPlainObject(row)) continue;
    const remedy: Remedy = {
      title: readString(row.title),
      detail: readString(row.detail),
      mantraDevanagari: readString(row.mantraDevanagari),
      mantraRoman: readString(row.mantraRoman),
      deity: readString(row.deity),
      day: readString(row.day),
    };
    const empty =
      !remedy.title &&
      !remedy.detail &&
      !remedy.mantraDevanagari &&
      !remedy.mantraRoman &&
      !remedy.deity &&
      !remedy.day;
    if (empty) continue;
    remedies.push(remedy);
    if (remedies.length >= 3) break;
  }

  const briefRaw = isPlainObject(raw.wallpaperBrief) ? raw.wallpaperBrief : {};
  const wallpaperBrief: WallpaperBrief = {
    mood: readString(briefRaw.mood),
    palette: readString(briefRaw.palette),
    motifs: readString(briefRaw.motifs),
    inscription: readString(briefRaw.inscription),
  };

  return { condition, primary, reading: readingText, remedies, affirmation, wallpaperBrief };
}

/* ------------------------------------------------------------ json plumbing */

/**
 * Parse a model answer that should contain one JSON object. The three
 * providers wrap their JSON differently, so we try, in order: the trimmed text
 * as-is, a fenced ```json block anywhere in it, then the widest slice from the
 * first `{` to the last `}`. The first that parses wins; when none do we throw
 * one shared error so every provider fails the same way.
 */
export function parseJsonPayload(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // not bare JSON — keep looking
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // malformed fence — try the brace slice
    }
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {
      // not a JSON object either — fall through to the error
    }
  }

  throw new Error("no JSON object in reply");
}

/** A short, safe description of any thrown value (never leaks a key). */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** True when a sanitised reading actually carries something worth showing. */
export function isUsableReading(reading: Reading | null): reading is Reading {
  if (!reading) return false;
  return Boolean(
    reading.condition || reading.reading || reading.remedies.length || reading.affirmation,
  );
}

/* ----------------------------------------------------------------- providers */

/**
 * Gemini: one real HTTP call to the Generative Language API. No stubbing, no
 * simulated answers — if the call fails, the error travels up the chain.
 */
export async function geminiReading(chartSummary: string, keyOverride?: string): Promise<Reading> {
  const key = geminiKey(keyOverride);
  const prompt = buildReadingPrompt(chartSummary);

  const res = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
    }),
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = (await res.text()).trim().slice(0, 300);
    throw new Error(`Gemini request failed (${res.status} ${res.statusText}): ${body}`);
  }

  const payload = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: unknown }[] } }[];
  };
  const parts = payload?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned an empty reading");

  let parsed: unknown;
  try {
    parsed = parseJsonPayload(text);
  } catch (err) {
    throw new Error(`Gemini returned unreadable JSON: ${errorMessage(err)}`);
  }

  const reading = sanitizeReading(parsed);
  if (!isUsableReading(reading)) throw new Error("Gemini returned an unusable reading");
  return reading;
}

/* -------------------------------------------------------------------- cache */

/**
 * A small per-instance, in-memory cache of finished readings, keyed by the
 * exact fact sheet. It stops an identical chart from re-hitting the provider
 * chain, whose calls cost real tokens. It is bounded to 200 entries with a
 * 24h TTL and lives only in this process: not shared, not persisted, and it
 * never caches a failure — only a fully validated reading is stored.
 */
const READING_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const READING_CACHE_MAX = 200;
const readingCache = new Map<
  string,
  { at: number; reading: Reading; provider: ReadingProvider }
>();

/** Return a still-fresh cached reading, dropping it once it has expired. */
function readCachedReading(
  chartSummary: string,
): { reading: Reading; provider: ReadingProvider } | null {
  const hit = readingCache.get(chartSummary);
  if (!hit) return null;
  if (Date.now() - hit.at > READING_CACHE_TTL_MS) {
    readingCache.delete(chartSummary);
    return null;
  }
  return { reading: hit.reading, provider: hit.provider };
}

/** Store a validated reading, dropping the oldest entry once at the cap. */
function cacheReading(
  chartSummary: string,
  reading: Reading,
  provider: ReadingProvider,
): void {
  if (readingCache.size >= READING_CACHE_MAX) {
    const oldest = readingCache.keys().next().value;
    if (oldest !== undefined) readingCache.delete(oldest);
  }
  readingCache.set(chartSummary, { at: Date.now(), reading, provider });
}

/**
 * The reading chain: a cache hit first, then Gemini, OpenRouter, Baidu. Every
 * step is a real call. If all three fail, one error naming all three causes is
 * thrown so the caller can report one readable line.
 */
export async function readKundli(
  chartSummary: string,
  keyOverrides?: { gemini?: string; openrouter?: string },
): Promise<{ reading: Reading; provider: ReadingProvider }> {
  const cached = readCachedReading(chartSummary);
  if (cached) return cached;

  const failures: string[] = [];

  try {
    const reading = await geminiReading(chartSummary, keyOverrides?.gemini);
    cacheReading(chartSummary, reading, "gemini");
    return { reading, provider: "gemini" };
  } catch (err) {
    failures.push(`gemini: ${errorMessage(err)}`);
  }

  try {
    const reading = await openrouterReading(chartSummary, keyOverrides?.openrouter);
    cacheReading(chartSummary, reading, "openrouter");
    return { reading, provider: "openrouter" };
  } catch (err) {
    failures.push(`openrouter: ${errorMessage(err)}`);
  }

// Baidu provider exists in src/lib/baidu.ts but is not in the active chain — re-add here when BAIDU_API_KEY is configured.
  throw new Error(`No reading provider could answer — ${failures.join(" | ")}`);
}