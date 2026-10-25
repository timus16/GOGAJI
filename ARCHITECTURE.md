# GOGAJI Architecture - AI Workflow Engine

## Overview

GOGAJI is an **AI Workflow Engine**, not a chatbot. It executes a deterministic pipeline that transforms birth details into personalized Vedic astrology wallpapers.

## Pipeline Architecture

```
USER SUBMITS birth details
    ?
[1] KUNDLI_ENGINE
    Computes planetary positions, nakshatra, houses
    Source: src/lib/astro.ts (Meeus/JPL algorithms)
    max_tokens: 500
    ?
[2] PROBLEM_ANALYZER (optional)
    Maps problem to focus houses/planets
    Source: src/content/problems.ts
    max_tokens: 300
    ?
[3] WALLPAPER_CONTEXT
    Generates energy, chakra, color, symbols
    Source: src/content/vedic-mapping.ts
    max_tokens: 400
    ?
[4] IMAGE_PROMPT
    Composes optimized NVIDIA prompt
    Source: src/lib/nvidia.ts
    max_tokens: 250
    ?
[5] NVIDIA_IMAGE
    Generates AI artwork (if quota available)
    Source: src/lib/nvidia.ts
    Budget: 95s timeout
    ?
COMPLETE or DEGRADED (SVG fallback)
```

## Key Principle: No Reasoning, No Planning

The pipeline NEVER:
- Acts as CTO/architect
- Researches or reads docs beyond imports
- Accumulates chat history
- Redesigns architecture
- Writes documentation unprompted

Each step executes and returns. State machine drives execution.

## State Machine

Every submission gets a NEW state object:

```typescript
interface WorkflowState {
  submissionId: string;
  step: PipelineStep;
  birthDetails: BirthInput | null;
  problem: string | null;
  chart: any | null;
  problemAnalysis: any | null;
  wallpaperContext: any | null;
  imagePrompt: string | null;
  imageUrl: string | null;
  error: string | null;
  startedAt: number;
  completedAt: number | null;
}
```

State transitions are ONE-WAY. Never go back to previous step.

## Skills (MCP Architecture)

Instead of giant prompts, GOGAJI uses focused skills:

| Skill | Purpose | Max Tokens |
|-------|---------|-------------|
| kundli-engine | Vedic chart calculation | 500 |
| problem-analyzer | Problem-to-house mapping | 300 |
| wallpaper-context | Visual parameters generation | 400 |
| image-prompt | Art prompt composition | 250 |
| adhd-focus | Execution discipline enforcer | N/A |

MCP Router loads only required skills per step.

## Agent Roles

| Agent | Mode | Trigger |
|-------|------|---------|
| workflow-orchestrator | primary | Wallpaper generation pipeline |
| backend | subagent | Server function implementation |
| frontend | subagent | UI component implementation |
| qa | subagent | Test writing/running |
| reviewer | subagent | Code review (when asked) |
| devops | subagent | Build/deploy (when asked) |
| architect | subagent | Design decisions (when asked) |

## Token Budget Enforcement

| Stage | Soft Limit | Hard Limit |
|-------|------------|-------------|
| kundli-engine | 300 | 500 |
| problem-analyzer | 200 | 300 |
| wallpaper-context | 300 | 400 |
| image-prompt | 150 | 250 |
| workflow-orchestrator | 400 | 600 |

When >80% budget used, return whatever is available and STOP.

## Degradation Path

```
AI image ? NVIDIA flux.1-dev
    ? (if fails)
SVG wallpaper ? buildWallpaperSvg() from src/lib/wallpaper.ts
    ? (always works)
Never fail the page
```

## Source of Truth

| Concern | Source |
|---------|--------|
| Planetary positions | src/lib/astro.ts |
| Nakshatra/pada/houses | src/lib/astro.ts |
| Problem conditions | src/content/problems.ts |
| Vedic data | src/content/vedic-mapping.ts |
| Art prompts | src/lib/nvidia.ts |
| SVG rendering | src/lib/wallpaper.ts |

## Memory Management

**RETAIN per request:**
- current_user
- current_birth_details
- current_problem
- current_workflow_state

**DISCARD after each request:**
- previous_users
- past_wallpapers
- past_readings
- unrelated_context
- chat_history

## Validation

```bash
# Chart engine + magic square validator
bun run scripts/validate-chart.ts

# NASA/JPL Horizons comparison
bun run scripts/horizons-compare.ts

# Wallpaper smoke test
bun run scripts/probe.ts
```

## Stack

- **Runtime:** Bun (primary), Cloudflare Workers (optional)
- **Frontend:** React 19, TanStack Router, Tailwind v4
- **Database:** Neon/Postgres
- **AI:** Gemini ? OpenRouter (reading), NVIDIA flux.1-dev (image)
- **Deployment:** Port 3000, idleTimeout 255s

