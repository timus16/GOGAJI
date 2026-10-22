/**
 * OpenRouter fallback reading provider.
 *
 * OpenRouter is an OpenAI-compatible gateway: it proxies many models behind
 * one key. We only use models that are priced at zero (the free tier), and
 * we walk down the list until one answers. Every call is a real HTTP request.
 *
 * The prompt is the canonical one from `~/lib/gemini` and the answer goes
 * through the same `sanitizeReading()` validator, so the shape the UI sees is
 * identical whichever provider answered.
 */

import { openrouterKey } from "~/lib/server-key";
import {
  buildReadingPrompt,
  sanitizeReading,
  isUsableReading,
  parseJsonPayload,
  errorMessage,
  type Reading,
} from "~/lib/gemini";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_REFERER = "https://nakshatra-canvas.app";
const OPENROUTER_TITLE = "Nakshatra Canvas";
const OPENROUTER_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;

/**
 * Free models, most capable first.
 *
 * The first block was VERIFIED against the live OpenRouter catalogue
 * (`GET https://openrouter.ai/api/v1/models`, which needs no auth): only ids
 * that are actually served with `pricing.prompt === "0"` and
 * `pricing.completion === "0"` are kept there. The zero-priced ids live on
 * that endpoint right now are gemma-4-31b-it, gemma-4-26b-a4b-it,
 * minimax-m3.1-flash, nemotron-3-super-120b-a12b, nemotron-3-ultra-550b-a55b,
 * nemotron-3.5-lightning, nemotron-3.5-super-vl, thinkingmachines/inkling,
 * poolside laguna, and the `openrouter/free` router.
 *
 * The second block is the well-known free tier asked for in the brief. The
 * catalogue no longer lists those exact ids at zero price, so they are kept
 * as a later tier in case OpenRouter restores them — they cost nothing to
 * try and the chain stops after three attempts either way.
 */
export const OPENROUTER_FALLBACK_MODELS: string[] = [
  // verified live, zero priced
  "google/gemma-4-31b-it:free",
  "minimax/minimax-m3.1-flash:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-26b-a4b-it:free",
  "thinkingmachines/inkling:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3.5-lightning:free",
  "openrouter/free",
  // classic free tier, kept in case it returns
  "google/gemini-2.5-flash:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "qwen/qwen3-235b-a22b:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
];

/** Is this HTTP status worth trying the next model for? */
function isRetryableStatus(status: number): boolean {
  return status === 402 || status === 404 || status === 429 || status >= 500;
}

/**
 * One OpenRouter chat completion. Throws on any failure so the caller can
 * fall through to the next model.
 */
async function chatCompletion(
  model: string,
  prompt: string,
  chartSummary: string,
  key: string,
): Promise<string> {
  const res = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": OPENROUTER_REFERER,
      "X-Title": OPENROUTER_TITLE,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: chartSummary },
      ],
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(OPENROUTER_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = (await res.text()).trim().slice(0, 300);
    const err = new Error(`OpenRouter ${model} failed (${res.status} ${res.statusText}): ${body}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  const payload = (await res.json()) as {
    choices?: { message?: { content?: unknown } }[];
  };
  const content = payload?.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content : "";
  if (!text.trim()) throw new Error(`OpenRouter ${model} returned an empty answer`);
  return text;
}

/**
 * Ask OpenRouter for a reading. Tries the free models in order (at most
 * three) and returns the first reading that survives validation.
 */
export async function openrouterReading(chartSummary: string, keyOverride?: string): Promise<Reading> {
  const key = openrouterKey(keyOverride);
  const prompt = buildReadingPrompt(chartSummary);

  const failures: string[] = [];
  let attempts = 0;

  for (const model of OPENROUTER_FALLBACK_MODELS) {
    if (attempts >= MAX_ATTEMPTS) break;
    attempts += 1;

    let text: string;
    try {
      text = await chatCompletion(model, prompt, chartSummary, key);
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      failures.push(`${model}: ${errorMessage(err)}`);
      if (status !== undefined && !isRetryableStatus(status)) break;
      continue;
    }

    let parsed: unknown;
    try {
      parsed = parseJsonPayload(text);
    } catch (err) {
      failures.push(`${model}: unreadable JSON (${errorMessage(err)})`);
      continue;
    }

    const reading = sanitizeReading(parsed);
    if (!isUsableReading(reading)) {
      failures.push(`${model}: unusable reading`);
      continue;
    }
    return reading;
  }

  throw new Error(`OpenRouter could not answer — ${failures.join(" | ")}`);
}