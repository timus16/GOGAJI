# GOGAJI Skills Index

**Last updated:** 2026-11-20
**Project:** GOGAJI - Nakshatra Canvas (TanStack Start, React 19, TypeScript, Tailwind)

---

## Skill Execution Order (Pipeline)

The following skills execute in sequence for a complete wallpaper generation request:

| Order | Skill | Trigger | Role |
|---|---|---|---|
| 1 | `problem-analyzer` | Problem category provided (career/wealth/relationships/health/education/spiritual/protection/family) | Maps user problem to focus houses + planets |
| 2 | `wallpaper-context` | Chart data + problem focus available | Generates visual context (energy, chakra, color, symbols, mood) |
| 3 | `image-prompt` | Wallpaper context + chart facts available | Generates NVIDIA flux.1-dev prompt |
| 4 | `astrology-premium-service` | Kundli reading / Vedic wallpaper requested | Master orchestration - governs two-AI pipeline, chart engine, content rules, degradation |
| 5 | `regional-panchanga` | Panchang / tithi / yoga / karana / regional new-year / vimshottari daśā needed | Pañchāṅga engine, lunar month naming, Vimśottarī daśā, regional traditions |

---

## Skill Reference

### Core Pipeline Skills

| Skill | File | Description |
|---|---|---|
| `astrology-premium-service` | `.kilo/skills/astrology-premium-service/SKILL.md` | Master orchestration for Vedic astrological reading/wallpaper generation. Two-AI pipeline: deterministic chart engine → LLM interpretation → NVIDIA artwork. |
| `problem-analyzer` | `.kilo/skills/problem-analyzer/SKILL.md` | Maps life problem to astrological houses and planets. Pure mapping function. |
| `wallpaper-context` | `.kilo/skills/wallpaper-context/SKILL.md` | Generates visual context (energy, chakra, color, symbols, mood) from chart + problem. |
| `image-prompt` | `.kilo/skills/image-prompt/SKILL.md` | Generates optimized NVIDIA flux.1-dev prompts. Pure prompt engineering. |
| `regional-panchanga` | `.kilo/skills/regional-panchanga/SKILL.md` | Pañchāṅga engine: tithi, yoga, karaṇa, lunar month (amānta/pūrṇimānta), Vimśottarī daśā, 36 state/UT regional traditions. |

### Supporting Skills

| Skill | File | Description |
|---|---|---|
| `adhd-focus` | `.kilo/skills/adhd-focus/SKILL.md` | Enforces strict task execution, prevents token explosion. Applied automatically to all agents. |
| `agent-memory` | `.kilo/skills/agent-memory/SKILL.md` | Durable project context capture/reuse across sessions. |
| `code-editing-refactoring` | `.kilo/skills/code-editing-refactoring/SKILL.md` | Modifying existing code: renaming, extracting, restructuring. |
| `code-generation` | `.kilo/skills/code-generation/SKILL.md` | Writing new code, functions, components from scratch. |
| `codebase-reasoning` | `.kilo/skills/codebase-reasoning/SKILL.md` | Cross-module analysis: finding duplicates, tracing symbols, dead code. |
| `cost-optimization` | `.kilo/skills/cost-optimization/SKILL.md` | Reducing system cost: token/API spend, caching, batching, model choice. |
| `debugging` | `.kilo/skills/debugging/SKILL.md` | Reproduce → bisect → root-cause → fix → prove-fix workflow. |
| `dependency-management` | `.kilo/skills/dependency-management/SKILL.md` | Adding/upgrading/removing dependencies, auditing lockfiles. |
| `documentation-authoring` | `.kilo/skills/documentation-authoring/SKILL.md` | Writing project docs: README, ADRs, changelogs, guides. |
| `git-operations` | `.kilo/skills/git-operations/SKILL.md` | Version control: commit, branch, merge, rebase, stash. |
| `knowledge-retrieval` | `.kilo/skills/knowledge-retrieval/SKILL.md` | External info retrieval: docs, GitHub, RFCs, with citations. |
| `multi-agent-orchestration` | `.kilo/skills/multi-agent-orchestration/SKILL.md` | Splitting large tasks across parallel worker agents. |
| `project-architect` | `.kilo/skills/project-architect/SKILL.md` | Turning requirements into concrete design before coding. |
| `repo-context-and-push` | `.kilo/skills/repo-context-and-push/SKILL.md` | Repo orientation + safe commit/push to GitHub. |
| `repo-understanding` | `.kilo/skills/repo-understanding/SKILL.md` | Reconstructing codebase structure, stack, conventions. |
| `security-audit` | `.kilo/skills/security-audit/SKILL.md` | Security review: secrets, injection, auth, SSRF, CVEs. |
| `task-planning` | `.kilo/skills/task-planning/SKILL.md` | Decomposing large goals into ordered waves with acceptance criteria. |
| `terminal-execution` | `.kilo/skills/terminal-execution/SKILL.md` | Running shell commands, managing dev servers, processes. |
| `test-authoring` | `.kilo/skills/test-authoring/SKILL.md` | Designing/writing automated tests (unit, integration, e2e). |

### Cloudflare Skills (available globally)

| Skill | Description |
|---|---|
| `agents-sdk` | Cloudflare Agents SDK applications |
| `basin` | Cloudflare Basin analytics workflows |
| `cf-cli` | Cloudflare cf CLI (beta) |
| `cloudflare` | Cloudflare product selection/architecture |
| `cloudflare-email-service` | Email Sending/Routing |
| `cloudflare-one` | Zero Trust / SASE |
| `cloudflare-one-migrations` | Migration from VPN/SWG/SASE |
| `durable-objects` | Durable Objects for persistent state |
| `gateway-workers` | Workers for Gateway HTTP policies |
| `k2` | K2/K2 Streams durable logs |
| `neon` | Neon Lakebase Postgres backend primitives |
| `neon-ai-gateway` | Neon AI Gateway for LLMs |
| `neon-auth` | Neon Auth (Managed Better Auth) |
| `neon-functions` | Neon serverless Node.js functions |
| `neon-object-storage` | Neon S3-compatible object storage |
| `neon-postgres` | Neon Postgres connections, migrations |
| `neon-postgres-branches` | Neon branching for testing |
| `neon-postgres-egress-optimizer` | Diagnose/fix Postgres egress costs |
| `neon-realtime` | Neon Realtime live SQL queries |
| `nextjs-on-cloudflare` | Next.js on Cloudflare Workers |
| `sandbox-migrate-to-next` | Migrate Sandbox to @next |
| `sandbox-next` | Sandbox on @next (SDK 1.0 preview) |
| `sandbox-stable` | Sandbox on stable package |
| `turnstile-spin` | Cloudflare Turnstile bot verification |
| `web-perf` | Web performance, Core Web Vitals |
| `workers-best-practices` | Cloudflare Workers production practices |
| `workers-profiling` | CPU/memory profiling for Workers |
| `wrangler` | Wrangler CLI commands |

---

## Data Sources (Single Source of Truth)

All Vedic/astrological data lives in `src/content/vedic-mapping.ts`:

- **GRAHAS** - 9 planets with colour, mantra, yantra (magic squares), symbols
- **NAKSHATRAS** - 27 nakshatras with lord, deity, symbol, motif (27 MotifKey values), gana, syllables
- **RASHIS** - 12 signs with lords
- **PRESETS** - 5 style archetypes (temple-gold, indigo-midnight, minimal-line, dense-mandala, royal-marigold)
- **PROBLEM_AREA_MANTRAS** - 8 life area mantras

The chart engine (`src/lib/astro.ts`) is the **only** source of planetary maths.

---

## Validation Commands

```bash
# Chart engine + magic square validator
bun run scripts/validate-chart.ts

# Engine vs NASA/JPL Horizons comparison
bun run scripts/horizons-compare.ts

# Probe: chart + wallpaper smoke test
bun run scripts/probe.ts

# E2E browser tests
bunx playwright test
```

---

## Environment Variables (Server-Only)

| Variable | Used By | Notes |
|---|---|---|
| `GEMINI_API_KEY` | `src/lib/gemini.ts` | Google AI Studio key |
| `BAIDU_API_KEY` | `src/lib/baidu.ts` | Third provider (not in active chain) |
| `NVIDIA_API_KEY` | `src/lib/nvidia.ts` | flux.1-dev image generation |
| `AI_RATE_LIMIT_PER_MIN` | `src/server/ai.ts` | Per-IP rate limit (default 5) |
| `BAIDU_MODEL_ID` | `src/lib/baidu.ts` | Optional Qianfan model override |

Secrets come from **host secret store** (process.env in server-only modules). Never commit or log keys. `.env` is local-dev only.

---

## Degradation Order (Must Always Work)

1. AI image (NVIDIA flux.1-dev) - richest
2. Deterministic SVG wallpaper (`buildWallpaperSvg`) - free, always available
3. Reading text - if all providers fail, show conditions + deterministic chart only
4. Never fail the page because a key is missing or provider is down

---

## Key Files Map

| File | Purpose |
|---|---|
| `src/lib/astro.ts` | Deterministic chart engine (Meeus/JPL algorithms) |
| `src/content/vedic-mapping.ts` | All Vedic content (nakshatras, grahas, yantras, presets) |
| `src/content/problems.ts` | Problem-set domain model (LifeArea, conditions, assessChart) |
| `src/lib/gemini.ts` | Reading layer (provider: Gemini) |
| `src/lib/baidu.ts` | Third reading provider (not in active chain) |
| `src/lib/nvidia.ts` | Artwork step (promptFromBrief, nvidiaWallpaper) |
| `src/lib/server-key.ts` | Single place reading provider keys from process.env |
| `src/server/ai.ts` | Server function orchestrating full pipeline |
| `src/lib/wallpaper.ts` | Deterministic SVG renderer (buildWallpaperSvg) |
| `src/content/regional.ts` | Regional layer (36 states/UTs, amānta/pūrṇimānta) |
| `src/lib/qualification.ts` | shouldCallAI gate before any provider call |
| `src/lib/crm.ts` | captureSubmit (persists only with consent) |
| `scripts/validate-chart.ts` | Engine validator + magic-square verifier |
| `scripts/horizons-compare.ts` | Engine vs NASA/JPL Horizons |
| `scripts/probe.ts` | Chart + wallpaper smoke test |
| `serve.ts` | Dev server pinned to port 3000 |

---

## Style Preset Contract

| Preset ID | Name | Key Visual |
|---|---|---|
| `temple-gold` | Temple Gold | Deep umber, beaten gold, dense lotus mandala |
| `indigo-midnight` | Indigo Midnight | Night-indigo, moonlit silver, medium motifs |
| `minimal-line` | Minimal Line-Art | Parchment, hairline weight, wide calm space |
| `dense-mandala` | Dense Mandala | Saturated, maximal ornament, every ring filled |
| `royal-marigold` | Royal Marigold | Oxblood-marigold, foil double frame, dense lotus |

---

## Nakshatra MotifKey Enum (27 values)

```
horse, yoni, flame, chariot, deer, drop, bow, lotus, serpent,
throne, cot, hand, jewel, sprout, arch, ear, roots, fan, tusk,
drum, circle, sword, twins, fish
```

These are the vector forms drawn for each nakshatra in the deterministic SVG renderer.