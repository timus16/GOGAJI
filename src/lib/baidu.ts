/**
 * Baidu Qianfan fallback reading provider.
 *
 * Qianfan is OpenAI-compatible and its ERNIE free tier is permanent and
 * generous: `ernie-3.5-8k` and `ernie-speed-8k` are unlimited tokens at
 * 50 queries per second, so this provider never runs out mid-session.
 * Source for the free-tier facts: https://getfreeai.net/en/services/api/baidu/
 *
 * As with the other providers: the prompt is the canonical one and the
 * answer goes through the same `sanitizeReading()` validator.
 */

import { baiduKey } from "~/lib/server-key";
import {
  buildReadingPrompt,
  sanitizeReading,
  type Reading,
} from "~/lib/gemini";

/** A short, safe description of any thrown value (never leaks a key). */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Pull the first JSON object out of a model reply, tolerating code fences. */
function parseJsonPayload(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : trimmed).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("no JSON object in reply");
    return JSON.parse(candidate.slice(start, end + 1));
  }
}

const QIANFAN_BASE = "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat";
const QIANFAN_TIMEOUT_MS = 30_000;

/** The free ERNIE model to use; overridable for a paid model. */
function qianfanModel(): string {
  return process.env.BAIDU_MODEL_ID?.trim() || "ernie-3.5-8k";
}

/**
 * Ask Qianfan for a reading. Handles both reply shapes Qianfan can return:
 * the OpenAI-compatible `choices[0].message.content` and the native
 * `result` string.
 */
export async function baiduReading(chartSummary: string): Promise<Reading> {
  const key = baiduKey();
  const model = qianfanModel();
  const prompt = buildReadingPrompt(chartSummary);

  const res = await fetch(`${QIANFAN_BASE}/${model}?access_token=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: chartSummary },
      ],
    }),
    signal: AbortSignal.timeout(QIANFAN_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = (await res.text()).trim().slice(0, 300);
    throw new Error(`Baidu request failed (${res.status} ${res.statusText}): ${body}`);
  }

  const payload = (await res.json()) as {
    choices?: { message?: { content?: unknown } }[];
    result?: unknown;
  };

  // OpenAI-compatible mode first, then Qianfan's native `result` field.
  const choice = payload?.choices?.[0]?.message?.content;
  let text = typeof choice === "string" ? choice : "";
  if (!text.trim() && typeof payload?.result === "string") text = payload.result;

  if (!text.trim()) {
    throw new Error("Baidu returned an empty reading");
  }

  let parsed: unknown;
  try {
    parsed = parseJsonPayload(text);
  } catch (err) {
    throw new Error(`Baidu returned unreadable JSON: ${errorMessage(err)}`);
  }

  const reading = sanitizeReading(parsed);
  if (!reading) throw new Error("Baidu returned an unusable reading");
  return reading;
}