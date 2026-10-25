# Plan: Transfer TanStack Start Stack to Next.js + Bug Fix + Agent Limits + Token Optimization

## Goal

Move GOGAJI from TanStack Start (Vite/TanStack Router/server functions) to a Next.js App Router application with no runtime `@tanstack/*` imports, passing typecheck, build, and tests; constrain agents as limited subagents; lock token optimization in config.

## Target decision

Decide before Wave 0: reuse the existing Next.js target (`E:\sentir\gogaji\nakshatra-canvas-v2`) or convert in place. Baseline both with current `npm run dev`, `npx tsc --noEmit`, and Playwright before migration.

## Acceptance criteria (testable)

1. `npm run dev` starts Next.js on port 3000.
2. `npx tsc --noEmit` exits 0.
3. `npx playwright test` passes agreed baseline.
4. No runtime imports from `@tanstack/*` remain in `src`.
5. `/api/generate` returns reading/image or graceful degraded.
6. `.kilo/agent/*.md` declare steps caps and `kilo.json` has `compaction.auto=true`, `compaction.prune=true`.
7. Agent scope text reflects Next.js after migration.

## Known bugs

- `account.tsx`: 4 `resetAt` type errors, 1 JSX style prop error.
- `index.tsx`: missing `~/components/DiscoveryGate` import (deleted).
- Playwright: 13 timeouts waiting for `#full-name` hydration gate.
- TODO: rate limiting/CRM integration.

## Waves

### Wave 0 - Decision and inventory (gate: target chosen)

- Inventory TanStack Start entry points, routes, server functions, assets, scripts.
- Capture baseline command outputs and test list.
- Confirm Next.js target or in-place scope; document excluded legacy paths.
- No code changes except plan/config files.

### Wave 1 - Scaffold and tooling

- Install/configure Next.js App Router in chosen target.
- Update `package.json` scripts (`dev`, `build`, `start`, `typecheck`), `tsconfig`, Tailwind, global CSS, fonts/assets.
- Keep secrets server-only; no keys committed.
- Verify `npm run dev` on port 3000.

### Wave 2 - Route and server migration

- Convert `__root` to `app/layout.tsx` and index route to `app/page.tsx`.
- Convert TanStack server functions (`createServerFn`) to Next.js route handlers (`app/api/*/route.ts`), including `/api/generate`.
- Move server-only logic to server modules; preserve deterministic SVG fallback and degraded responses.
- Remove TanStack router/runtime wiring.

### Wave 3 - Component and UI bug fixes

- Repair `account.tsx` `resetAt` types and style prop.
- Restore or replace deleted `DiscoveryGate` import in `index.tsx`.
- Fix hydration gate/DOM readiness for `#full-name` in Playwright baseline.
- Keep mobile-first, accessible behavior.

### Wave 4 - API contract and degradation

- Implement/verify `/api/generate` returns reading/image or graceful degraded.
- Preserve bounded budgets (70s reading, 95s image), graceful provider failures.
- Address rate limiting/CRM TODOs or scope them with explicit follow-ups.
- Never fail full page; deterministic SVG fallback remains available.

### Wave 5 - Typecheck and tests

- Run `npx tsc --noEmit`; fix only type errors in migrated code.
- Run `npx playwright test`; remove flaky timing assumptions.
- Assert no `@tanstack/*` imports under `src`.

### Wave 6 - Agent limits

- Update `.kilo/agent/*.md` frontmatter steps caps.
- Replace stack references (`TanStack Start/Router`, `createServerFn`) with Next.js terms.
- Set default agent and agent steps in root `kilo.json`.

### Wave 7 - Token optimization lock and final verification

- Enable compaction `auto=true`, `prune=true` in `kilo.json`.
- Re-run full verification suite.
- Produce final changed-files report and remaining TODOs.

## File ownership

- `workflow-orchestrator`: pipeline coordination, wave gating, integration order.
- `architect`: design decisions, route/API contracts, ownership boundaries.
- `backend`: `src/server/*`, `src/lib/*` server-only logic, `app/api/*` route handlers.
- `frontend`: `app/*`, `src/components/*`, `src/routes/*` migration, styles, accessibility.
- `qa`: `tests/*`, Playwright baseline, regression coverage.
- `devops`: `package.json`, scripts, config, build/deploy verification.
- `reviewer`: audit-only findings, no implementation.

## Parallelism and token rules

- No two agents edit the same file in the same wave.
- Schema-first: architect publishes contracts before backend/frontend implementation.
- Keep changes file-disjoint within a wave; integrate via orchestrator after gates.
- Agent step caps: orchestrator 20; architect/backend/frontend 12; reviewer/qa/devops 10.
- Keep responses concise; avoid dumping full files; prefer summaries and command results.
- Compaction auto and prune enabled; preserve recent context within configured budget.
- Do not broaden scope beyond the assigned task; no app source changes outside planned waves.

## Commands

```bash
npm run dev
npx tsc --noEmit
npx playwright test
npm run build
npm run lint
git status
git diff --stat
```

Notes: use `bun` equivalents only if available; acceptance baseline uses `npm`/`npx` commands above.
