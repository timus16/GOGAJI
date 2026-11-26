/**
 * Server-only accessors for the AI provider keys.
 *
 * Keys are read from `process.env` (Node.js) or `env` (Cloudflare Workers) lazily -
 * per call, never at module load - so the site still builds and serves before a key
 * is configured; the error only surfaces if a provider is actually asked to run.
 * This mirrors the tone of `src/db.ts`.
 *
 * Use these only inside a `createServerFn()` handler or a `src/routes/api/*`
 * route (never client code). The key values themselves are never logged,
 * echoed or returned to the browser.
 *
 * @deprecated Use "~/lib/env" instead. This file re-exports from the unified env module.
 */

export { type EnvLike, requireKey, getKey, geminiKey, nvidiaKey, baiduKey } from "~/lib/env";
