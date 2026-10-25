# GOGAJI - Nakshatra Canvas

TanStack Start app (React 19, TanStack Router, Tailwind, TypeScript) that renders a Vedic kundli wallpaper. Dev server runs on port 3000.

## Ground rules
- The deterministic chart engine (src/lib/astro.ts) is the ONLY source of planetary maths. Never compute positions, ayanamsa, nakshatra, pada, houses or retrogression anywhere else.
- The AI layer interprets computed facts only. It degrades gracefully: a missing key or a downed provider must never fail the page - the deterministic SVG path always works.
- Do not hard-code chart-derived constants; read them from the engine or the content tables.
- Product and domain rules live in the skills (.kilo/skills/*); do not contradict them.

## Config
- All agent config lives in .kilo/ (agents, commands, skills). Never .kilocode/ or .opencode/.
- Secrets come from the host secret store / process.env in server-only modules - never commit or log a key; .env is local-dev only.
- Keep serve.ts pinned to port 3000 and keep its idleTimeout intact.

## Conventions
- TypeScript, forward slashes in paths, no comments unless asked.
- Reuse existing modules; no duplicated business logic; no speculative abstractions.
- Validate inputs at server boundaries; typed error shapes; bounded timeouts and rate limits.

## Verify
- bun run scripts/probe.ts - chart + wallpaper smoke test
- bun run scripts/validate-chart.ts - engine + magic-square validator
- bunx playwright test - end-to-end browser tests
If bun is unavailable: npx -y --package bun bun run scripts/<name>.ts
