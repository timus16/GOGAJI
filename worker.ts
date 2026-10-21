// Cloudflare Workers entry for the Nakshatra Canvas (team-site) app.
//
// The TanStack Start build emits a portable web fetch handler at
// dist/server/server.js whose default export is `{ fetch }` (see serve.ts /
// vercel-entry.ts). This module wraps that handler for the Workers runtime:
// static assets are served from the ASSETS binding first, and anything that is
// not a real file falls through to SSR so the router can render the route and
// server functions keep working.
//
// wrangler.jsonc points `main` here (the built bundle at
// dist/cloudflare-worker/index.js). scripts/build-cloudflare.ts produces it by
// running the normal vite build, then bundling this file together with
// dist/server/server.js and its chunks into one self-contained ES module.
//
// `run_worker_first: true` in wrangler.jsonc means this worker runs for EVERY
// request, including navigations; that is deliberate so a browser request is
// never mistaken for a static-asset request and served the SPA shell instead of
// server-rendered HTML. The worker itself decides when to hand back a file.
import handler from "./dist/server/server.js";

// Minimal shape of the Workers static-assets binding
// (`assets.binding: "ASSETS"` in wrangler.jsonc). @cloudflare/workers-types is
// not a dependency of this repo, so the binding is described locally rather than
// pulling in the whole Workers type package.
interface AssetsBinding {
  fetch: (input: Request) => Promise<Response>;
}

interface Env {
  ASSETS: AssetsBinding;
}

const fetchHandler = handler as {
  fetch: (request: Request) => Response | Promise<Response>;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    // Mirror serve.ts: the root is always SSR (there is no static index.html in
    // dist/client); every other path is tried as a file under dist/client first.
    if (pathname !== "/") {
      const asset = await env.ASSETS.fetch(request);
      // `not_found_handling: "none"` makes the binding answer 404 for a path
      // that is not a real file, which is the signal to fall through to SSR.
      if (asset.status !== 404) return asset;
    }

    return fetchHandler.fetch(request);
  },
};