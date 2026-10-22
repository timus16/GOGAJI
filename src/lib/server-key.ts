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

/** BYOK: an optional per-request override wins over process.env; never persisted or logged. */
export const geminiKey = (override?: string) =>
  override && override.trim() ? override.trim() : requireKey("GEMINI_API_KEY");
export const nvidiaKey = (override?: string) =>
  override && override.trim() ? override.trim() : requireKey("NVIDIA_API_KEY");
export const openrouterKey = (override?: string) =>
  override && override.trim() ? override.trim() : requireKey("OPENROUTER_API_KEY");
// Not in the active reading chain right now (no key configured). Kept for future use.
export const baiduKey = () => requireKey("BAIDU_API_KEY");
