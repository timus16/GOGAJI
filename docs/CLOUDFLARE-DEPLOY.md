# Deploying to Cloudflare Workers

This repo has **two** deploy targets. They build the same TanStack Start app but
run it in different places:

| Target | Entry / server | Command | Notes |
| --- | --- | --- | --- |
| **Primary / local (Bun)** | `serve.ts` | `bun run build` then `bun run start` (or `bun run publish`) | This is the live preview path. It binds `0.0.0.0:3000` behind the sandbox reverse proxy. |
| **Cloudflare Workers** | `worker.ts` -> `dist/cloudflare-worker/index.js` | `bun run build:cloudflare` then `npx wrangler deploy` | Optional edge target. Requires the Workers **Paid** plan (see below). |

The Bun path in `serve.ts` remains the primary deploy. The Cloudflare target is
additive: `wrangler.jsonc` points `main` at a bundle that
`scripts/build-cloudflare.ts` produces, and nothing about the local/Bun flow
changes.

## Plan requirement: Workers Paid

The Worker does server-side rendering **and** waits on AI providers (Gemini,
NVIDIA flux.1-dev, OpenRouter, Baidu). Workers **Free** caps a request at
**10 ms of CPU**. SSR alone can exceed that, and `limits.cpu_ms` cannot be
raised above 10 ms on Free — the setting is ignored there.

`limits.cpu_ms: 300000` (300 s) in `wrangler.jsonc` **only takes effect on the
Workers Paid plan**, where the default is 30 s and the maximum is 300 s. A long
AI call is mostly wall-clock time spent waiting on `fetch()`, which does *not*
count as CPU, so the practical requirement is simply that the account be on the
Paid plan. Deploying to Free will fail or time out unpredictably on routes that
render + call an AI provider.

## Required secrets

API keys are read at request time from `process.env` (see
`src/lib/server-key.ts`) and are provided as **Worker secrets** — never as vars.
Set each one interactively (paste the value when prompted):

```sh
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put NVIDIA_API_KEY
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put BAIDU_API_KEY
```

Optional:

```sh
# Only needed if the Neon-backed persistence path is used (src/db.ts).
npx wrangler secret put DATABASE_URL
```

> **A `.env` file is NOT published.** Per `SITE.md`, secrets that live only in a
> local `.env` do not reach the deployed site. If a key is present in `.env` but
> never set with `wrangler secret put`, the live Worker sees it as missing and
> the AI features degrade to the chart-only result. `.env` is git-ignored and is
> for local development only.

`wrangler.jsonc`'s `vars` block holds **non-secret** configuration only (for
example `PUBLIC_SITE_URL`). Every value in `vars` is public in the deployed
bundle — never put an API key there.

## Build + deploy

```sh
# 1. Build the client + SSR, then bundle the Worker + SSR handler into one
#    self-contained ES module at dist/cloudflare-worker/index.js.
bun run build:cloudflare

# 2. Deploy. wrangler reads wrangler.jsonc, uploads dist/cloudflare-worker/index.js
#    as the Worker script, and uploads dist/client as the ASSETS static assets.
npx wrangler deploy
```

`build:cloudflare` runs the normal `bun run build` (Vite: client + SSR) and then
bundles `worker.ts` together with `dist/server/server.js` and its chunks. `node:`
builtins (`node:async_hooks`, `node:stream`, `node:stream/web`) are left external
and resolved at runtime through the `nodejs_compat` compatibility flag set in
`wrangler.jsonc`; every other dependency is inlined, so the deployed script is a
single file with no sibling chunk requirements.

To validate the config and see what would be uploaded without deploying:

```sh
npx wrangler deploy --dry-run --outdir dist/cloudflare-worker-dryrun
```

## How routing works

`wrangler.jsonc` sets:

- `assets.directory: "./dist/client"` with `assets.binding: "ASSETS"` — the built
  client files (JS, CSS, fonts).
- `assets.run_worker_first: true` — the Worker runs for **every** request, so a
  browser navigation is never mistaken for a static-asset request and served a
  shell instead of server-rendered HTML.
- `assets.not_found_handling: "none"` — there is no SPA shell; a path that is
  neither a real file nor a route is a 404, not `index.html`.

`worker.ts` mirrors the static-first logic in `serve.ts`: for any path other than
`/` it asks the `ASSETS` binding for the file and returns it when found;
otherwise (including `/`) it delegates to the TanStack Start fetch handler in
`dist/server/server.js`.