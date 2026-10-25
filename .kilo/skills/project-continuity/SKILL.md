# project-continuity

Documentation for an AI to take over the GOGAJI project (Nakshatra Canvas).

## 1. PROJECT OVERVIEW

- **App**: GOGAJI / Nakshatra Canvas - Vedic kundli wallpaper generator
- **Stack**: TanStack Start (React 19, TanStack Router, Tailwind, TypeScript)
- **Port**: 3000 (serve.ts pinned to 3000, keep idleTimeout intact)
- **Target**: Cloudflare Workers and Vercel
- **Deterministic engine**: src/lib/astro.ts (computeChart) is the ONLY source of planetary math. Never compute positions, ayanamsa, nakshatra, pada, houses or retrogression anywhere else.
- **AI layer**: interprets computed facts only; degrades gracefully - a missing key or a downed provider must never fail the page - the deterministic SVG path always works.
- **Product/domain rules**: live in .kilo/skills/*; do not contradict them.
- **Conventions**: TypeScript, forward slashes in paths, no comments unless asked. Reuse existing modules; no duplicated business logic; no speculative abstractions. Validate inputs at server boundaries; typed error shapes; bounded timeouts and rate limits.
- **Secrets**: come from process.env in server-only modules only - never commit or log a key; .env is local-dev only.

## 2. COMPLETED THIS SESSION

List of every file edited with line-level details:

### src/components/Generator.tsx (~868 lines)
- Added imports: useId from react, AccountPanel from "./AccountPanel", getSession, type SessionResponse from "~/server/api-auth"
- Changed birth field defaults: month 8->0, dayText "14"->"", yearText "1992"->"", hour12 5->0, minute 45->""
- Added placeholder <option value="">Month</option>, <option value="">Hour</option>, <option value="">Minute</option> in selects
- Fixed pad2 type: (n: number) -> (n: number | string)
- Added deviceId = useId() and session state with getSession({ data: { deviceId } }) useEffect
- Added <AccountPanel deviceId={deviceId} /> in form after AI info paragraph
- Gated AI checkbox with disabled={!session?.isPremium}
- Gated BYOK panel behind session?.isPremium ternary (shows "Premium required for AI keys" when not premium)
- Added upsell prompt: {!session?.isPremium && <p className="...">Upgrade to Premium...</p>}
- Added "Preview with sample chart" button in preview area (sets name="Sample", month=8, dayText="14", yearText="1992", hour12=5, minute="45", ampm="AM")

### src/routes/index.tsx
- Added Sign in link pointing to /account

## 3. FILE INVENTORY

- src/components/Generator.tsx (~868 lines) - main form component
- src/components/AccountPanel.tsx - account strip component (new)
- src/routes/index.tsx - home page with HeroNicheA + Generator
- src/routes/account.tsx - sign-in/sign-up page
- src/lib/astro.ts - deterministic chart engine (DO NOT MODIFY)
- src/lib/wallpaper.ts - focus-aware SVG renderer
- src/content/life-areas.ts - 8 life-area profiles
- src/server/ai.ts, api-auth.ts, auth.ts, quota.ts, db.ts, session.ts - server layer

## 4. PRE-EXISTING ISSUES

- account.tsx: resetAt type errors (4 lines), jsx prop on <style> (1 line)
- index.tsx: Cannot find module '~/components/DiscoveryGate' (DiscoveryGate.tsx was deleted)
- Playwright: 13 tests fail with 30s timeouts waiting for #full-name element (pre-existing hydration issue from DiscoveryGate)

## 5. VERIFICATION RESULTS

- bunx tsc --noEmit: 5 pre-existing errors only, NO Generator.tsx errors
- bun run scripts/probe.ts: PASSED - CHART_OK, SVG_OK x4, SVG_LENGTHS_DISTINCT
- bun run scripts/validate-chart.ts: PASSED - ALL MAGIC SQUARES VERIFIED
- bunx playwright test: 5 passed, 13 failed (all pre-existing timeouts)

## 6. HOW TO RUN COMMANDS

- bunx tsc --noEmit - TypeScript typecheck
- bun run scripts/probe.ts - chart + wallpaper smoke test
- bun run scripts/validate-chart.ts - engine + magic-square validator
- bunx playwright test - end-to-end browser tests
- If bun is unavailable: npx -y --package bun bun run scripts/<name>.ts

## 7. KEY CONVENTIONS

- TypeScript, forward slashes in paths, no comments unless asked
- Reuse existing modules; no duplicated business logic; no speculative abstractions
- Deterministic chart engine (src/lib/astro.ts, computeChart) is the ONLY source of planetary math
- AI layer degrades gracefully; deterministic SVG path always works
- Do not hard-code chart-derived constants; read them from the engine or the content tables
- Secrets from process.env in server-only modules only
- All agent config lives in .kilo/ (agents, commands, skills). Never .kilocode/ or .opencode/.
- Keep serve.ts pinned to port 3000 and keep its idleTimeout intact.