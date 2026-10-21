// Produce the Cloudflare Workers bundle referenced by wrangler.jsonc's `main`.
//
// Steps:
//   1. Run the normal `bun run build` (vite build), which emits the client
//      assets to dist/client and the portable SSR fetch handler plus its chunks
//      to dist/server.
//   2. Bundle worker.ts together with dist/server/server.js and every dependency
//      into ONE self-contained ES-module Worker at dist/cloudflare-worker/index.js.
//      Dynamic `import("./assets/*.js")` chunks emitted by the SSR build are
//      inlined (splitting is off), so the deployed script needs no sibling files.
//
// node: builtins (node:async_hooks, node:process, ...) are left EXTERNAL so the
// Workers runtime resolves them through the `nodejs_compat` compatibility flag
// set in wrangler.jsonc. Everything else (react, @tanstack/*, h3-v2, seroval,
// undici-based fetch helpers, ...) is inlined.
//
// Run: bun run build:cloudflare
// Then: npx wrangler deploy   (see docs/CLOUDFLARE-DEPLOY.md)
import { $ } from "bun";
import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
process.chdir(root);

const OUT_DIR = "dist/cloudflare-worker";
const OUT_FILE = `${OUT_DIR}/index.js`;
const SSR_ENTRY = "dist/server/server.js";

console.log("[1/2] bun run build  (vite: client + SSR)");
await $`bun run build`;

if (!existsSync(SSR_ENTRY)) {
  console.error(`build:cloudflare: ${SSR_ENTRY} was not produced by \`bun run build\``);
  process.exit(1);
}

console.log(`[2/2] bundling worker.ts -> ${OUT_FILE}`);
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const result = await Bun.build({
  entrypoints: ["worker.ts"],
  outdir: OUT_DIR,
  naming: "index.js",
  target: "browser",
  format: "esm",
  splitting: false,
  minify: false,
  plugins: [
    {
      name: "externalize-node-builtins",
      setup(build) {
        build.onResolve({ filter: /^node:/ }, (args) => ({
          path: args.path,
          external: true,
        }));
      },
    },
  ],
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  console.error("build:cloudflare: bundling failed (see logs above)");
  process.exit(1);
}

if (!existsSync(OUT_FILE)) {
  console.error(`build:cloudflare: expected ${OUT_FILE} but it was not produced`);
  process.exit(1);
}

const { size } = statSync(OUT_FILE);
console.log(`build:cloudflare: OK -> ${resolve(OUT_FILE)} (${String(size)} bytes)`);