# GOGAJI - Nakshatra Canvas

A Vedic astrology platform that generates personalized kundli wallpapers using deterministic planetary calculations and AI-enhanced artwork.

## Quick Start

\\\ash
# Install dependencies
bun install

# Start development server (port 3000)
bun run dev

# Build for production
bun run build

# Run validation tests
bun run scripts/probe.ts
bun run scripts/validate-chart.ts
\\\

## Architecture Overview

\\\
Client (React 19)
  Generator  Dashboard  Daily Rashifal
       |         |            |
       v         v            v
TanStack Router
  / -> Generator    /dashboard -> Dashboard    /rashifal -> UI
       |
       v
Server Functions
  /api/generate  /api/job/:id  /api/preview
       |
       v
Deterministic Engine
  astro.ts (chart math)  problems.ts (conditions)  vedic-mapping.ts (content)
       |
       v
AI Layer (Optional)
  Gemini (reading) -> OpenRouter (fallback) -> NVIDIA flux.1-dev (artwork)
\\\

### Key Principles

1. **Deterministic First**: The chart engine (\src/lib/astro.ts\) is the ONLY source of planetary mathematics
2. **Graceful Degradation**: AI layer failures never break the page - deterministic SVG always works
3. **No Hard-coded Constants**: All chart-derived values come from the engine or content tables
4. **Two-AI Pipeline**: Reading (Gemini -> OpenRouter) -> Artwork (NVIDIA flux.1-dev)

## API Endpoints

### POST /api/generate

Generate a personalized kundli wallpaper.

**Request Body:**
\\\json
{
  "name": "string (required)",
  "date": "string (required, YYYY-MM-DD)",
  "time": "string (required, HH:MM)",
  "place": "string (required)",
  "latitude": "number (optional, default: 28.6139)",
  "longitude": "number (optional, default: 77.2090)",
  "timezone": "string (optional, default: Asia/Kolkata)",
  "presetId": "string (optional, default: temple-gold)",
  "focusAreas": "string[] (optional, default: [\"all\"])",
  "regionalSystem": "string (optional, default: vedic)",
  "subject": "string (optional, default: child)",
  "keys": {
    "gemini": "string (optional, BYOK)",
    "openrouter": "string (optional, BYOK)",
    "nvidia": "string (optional, BYOK)"
  },
  "deviceId": "string (optional)"
}
\\\

**Response:**
\\\json
{
  "chartSummary": {
    "facts": { "key": "value" },
    "text": "formatted fact sheet"
  },
  "conditions": {
    "conditions": [{ "id": "string", "title": "string", "houses": [], "planets": [] }],
    "positives": ["string"]
  },
  "reading": {
    "sections": [{ "title": "string", "content": "string" }],
    "provider": "gemini|openrouter"
  } | null,
  "image": {
    "dataUrl": "string (base64)",
    "mime": "image/png",
    "width": 832,
    "height": 1216
  } | undefined,
  "wallpaperPrompt": "string",
  "provider": "gemini|openrouter" | undefined,
  "error": "string" | undefined
}
\\\

### GET /api/job/:id

Check the status of an async wallpaper generation job.

**Response:**
\\\json
{
  "jobId": "string",
  "status": "pending|processing|completed|failed",
  "result": { /* WallpaperResponse */ } | null,
  "error": "string" | null,
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
\\\

### GET /api/preview

Lightweight preview endpoint for testing.

## Environment Variables

### Required (Production)

| Variable | Description | Set Via |
|----------|-------------|---------|
| GEMINI_API_KEY | Google Gemini API key | wrangler secret put |
| NVIDIA_API_KEY | NVIDIA flux.1-dev API key | wrangler secret put |
| OPENROUTER_API_KEY | OpenRouter fallback API key | wrangler secret put |

### Optional

| Variable | Description | Set Via |
|----------|-------------|---------|
| BAIDU_API_KEY | Baidu API key (Chinese market) | wrangler secret put |
| DATABASE_URL | Neon/PostgreSQL connection | wrangler secret put |
| SESSION_SECRET | Session encryption key | wrangler secret put |
| PREMIUM_BYPASS_CODE | Premium feature bypass code | wrangler secret put |
| SENTRY_DSN | Sentry error tracking | wrangler secret put |
| PUBLIC_SITE_URL | Public site URL | wrangler.jsonc vars |

### Local Development (.env)

\\\env
GEMINI_API_KEY=your-key
NVIDIA_API_KEY=your-key
OPENROUTER_API_KEY=your-key
BAIDU_API_KEY=your-key
DATABASE_URL=postgresql://...
SESSION_SECRET=your-secret
PREMIUM_BYPASS_CODE=your-code
\\\

## Development Workflow

### 1. Local Development

\\\ash
# Start dev server with hot reload
bun run dev

# Server runs on http://localhost:3000
\\\

### 2. Code Quality

\\\ash
# Format code
bun run format

# Type check
bunx tsc --noEmit
\\\

### 3. Testing

\\\ash
# Chart + wallpaper smoke test
bun run scripts/probe.ts

# Engine + magic-square validator
bun run scripts/validate-chart.ts

# End-to-end browser tests
bunx playwright test
\\\

### 4. Building

\\\ash
# Standard build (client + SSR)
bun run build

# Cloudflare Workers build
bun run build:cloudflare
\\\

### 5. Deployment

\\\ash
# Deploy to Cloudflare Workers
bun run build:cloudflare && npx wrangler deploy

# Local production preview
bun run start
\\\

## Project Structure

\\\
src/
app/                    # App router (dashboard)
components/
  dashboard/         # Dashboard components
  ui/               # Base UI components (Radix-based)
  shared/           # Shared components
content/              # Vedic content tables
  vedic-mapping.ts  # Planets, nakshatras, presets, mantras
  problems.ts       # Astrological conditions
  life-areas.ts     # Life area profiles
  regional.ts       # Regional panchanga data
hooks/                # React hooks
lib/
  astro.ts          # Deterministic chart engine (ONLY math source)
  wallpaper.ts      # SVG renderer
  gemini.ts         # Reading provider (Gemini -> OpenRouter)
  nvidia.ts         # Artwork provider (flux.1-dev)
  utils.ts          # Utilities
routes/
  api/              # API endpoints
  index.tsx         # Generator page
  dashboard/        # Dashboard routes
  rashifal.tsx      # Daily rashifal
server/               # Server-only modules
  ai.ts             # AI pipeline handler
  auth.ts           # Authentication
  quota.server.ts   # Rate limiting
  rate-limit.server.ts
  jobs-do.ts        # Durable Object for jobs
  queue-consumer.ts # Queue processing
styles/
  app.css           # Global styles
middleware/
  security.ts       # Security headers
server.tsx            # TanStack Start server entry
__root.tsx            # Root layout
\\\

## Presets

Available wallpaper style presets (from vedic-mapping.ts):
- temple-gold - Traditional gold on dark
- indigo-midnight - Deep indigo theme
- minimal-line - Clean minimal lines
- dense-mandala - Dense mandala pattern

## Focus Areas

Problem areas that map to specific houses/planets:
- career -> 10th house, Saturn
- wealth -> 2nd/11th house, Jupiter
- relationships -> 7th house, Venus
- health -> 6th/8th house, Mars
- education -> 5th/9th house, Mercury/Jupiter
- spiritual -> 9th/12th house, Ketu
- protection -> 8th house, Rahu
- family -> 4th house, Moon

## Scripts

| Script | Description |
|--------|-------------|
| dev | Start Vite dev server |
| build | Build client + SSR |
| build:cloudflare | Build for Cloudflare Workers |
| start | Production preview server (port 3000) |
| format | Prettier format |
| wasm:build | Build WASM astro module |
| scripts/probe.ts | Smoke test chart + wallpaper |
| scripts/validate-chart.ts | Validate engine + magic squares |

## Tech Stack

- Framework: TanStack Start (React 19, TanStack Router)
- Styling: Tailwind CSS 4
- Language: TypeScript
- Runtime: Bun (dev), Cloudflare Workers (prod)
- Database: Neon (PostgreSQL) via @neondatabase/serverless
- AI Providers: Gemini, OpenRouter, NVIDIA flux.1-dev
- Queue: Cloudflare Queues
- State: Cloudflare Durable Objects
- Observability: Sentry
- Testing: Playwright
