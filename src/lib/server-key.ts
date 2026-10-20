/**
 * Server-only accessors for the AI provider keys.
 *
 * Keys are read from `process.env` lazily — per call, never at module load —
 * so the site still builds and serves before a key is configured; the error
 * only surfaces if a provider is actually asked to run. This mirrors the tone
 * of `src/db.ts`.
 *
 * Use these only inside a `createServerFn()` handler or a `src/routes/api/*`
 * route (never client code). The key values themselves are never logged,
 * echoed or returned to the browser.
 */

/** The provider keys this application knows how to talk to. */
export type KeyName =
  | "GEMINI_API_KEY"
  | "NVIDIA_API_KEY"
  | "OPENROUTER_API_KEY"
  | "BAIDU_API_KEY"
  | "BYTEPLUS_API_KEY";

/**
 * Resolve one key or fail loudly. The message names the variable so the
 * operator knows exactly what to add, and never contains the value.
 */
function requireKey(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `${name} is not set — add it to the environment (server secrets) before using the AI features.`,
    );
  }
  return value.trim();
}

export const geminiKey = () => requireKey("GEMINI_API_KEY");
export const nvidiaKey = () => requireKey("NVIDIA_API_KEY");
export const openrouterKey = () => requireKey("OPENROUTER_API_KEY");
export const baiduKey = () => requireKey("BAIDU_API_KEY");
export const byteplusKey = () => requireKey("BYTEPLUS_API_KEY");

/**
 * Is this key available right now? Never throws and never reveals the value —
 * used to decide which providers to try, and to report a missing key without
 * failing the whole request.
 */
export function hasKey(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}