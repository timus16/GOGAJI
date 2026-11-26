# Cloudflare Workers Deployment Guide

## Prerequisites

- **Cloudflare Account** with Workers Paid plan (required for CPU time > 10ms)
- **Wrangler CLI** installed (`npm install -g wrangler` or `bun add -g wrangler`)
- **Node.js 20+** or **Bun 1.0+**
- **Git** for version control

## Environment Variables & Secrets

### Required Secrets (set via `wrangler secret put`)

| Secret | Description | Required |
|--------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key for AI readings | Yes |
| `NVIDIA_API_KEY` | NVIDIA API key for flux.1-dev image generation | Yes |
| `BAIDU_API_KEY` | Baidu API key (optional, for Chinese market) | No |
| `DATABASE_URL` | Neon/PostgreSQL connection string for persistence | No |

### Non-Secret Configuration (in `wrangler.jsonc` vars)

| Variable | Description | Example |
|----------|-------------|---------|
| `PUBLIC_SITE_URL` | Public URL of the deployed site | `https://nakshatra-canvas.workers.dev` |

### Local Development (`.env`)

Create a `.env` file for local development (git-ignored):

```env
GEMINI_API_KEY=your-key
NVIDIA_API_KEY=your-key
BAIDU_API_KEY=your-key
DATABASE_URL=postgresql://...
```

> **Important**: `.env` files are NOT deployed. Secrets must be set via `wrangler secret put`.

## Build Commands

```bash
# Install dependencies
bun install

# Build for Cloudflare Workers (client + SSR + Worker bundle)
bun run build:cloudflare

# Local development server (port 3000)
bun run dev

# Production preview server
bun run start
```

## Deploy Commands

```bash
# 1. Build the Cloudflare Worker bundle
bun run build:cloudflare

# 2. Deploy to Cloudflare Workers
npx wrangler deploy

# 3. (Optional) Dry-run to validate without deploying
npx wrangler deploy --dry-run --outdir dist/cloudflare-worker-dryrun
```

## Verification Steps

### 1. Verify Build Output
```bash
# Check the worker bundle was created
ls -la dist/cloudflare-worker/index.js

# Check client assets
ls -la dist/client/
```

### 2. Verify Deployment
```bash
# Check deployment status
npx wrangler deployments list

# View logs
npx wrangler tail
```

### 3. Test Endpoints
```bash
# Health check (static asset)
curl https://your-worker.workers.dev/

# API generate endpoint
curl -X POST https://your-worker.workers.dev/api/generate \
  -H "Content-Type: application/json" \
  -d '"'"'{"name":"Test","date":"1990-01-01","time":"12:00","place":"New Delhi"}"'"''

# Job status endpoint
curl https://your-worker.workers.dev/api/job/<job-id>
```

### 4. Verify AI Features Work
- Check that readings are returned (not just chart data)
- Verify wallpaper images are generated
- Check error handling degrades gracefully

## Troubleshooting

### CPU Time Exceeded
- Ensure you're on Workers **Paid** plan
- Check `wrangler.jsonc` has `limits.cpu_ms: 300000`

### Secrets Not Working
- Verify secrets are set: `npx wrangler secret list`
- Secrets are case-sensitive

### Build Fails
- Run `bun run build` first to see Vite errors
- Check `dist/server/server.js` exists

### Assets Not Loading
- Verify `assets.directory` in `wrangler.jsonc` points to `./dist/client`
- Ensure `assets.run_worker_first: true`

## Project Structure for Deployment

```
dist/
  client/           # Static assets (uploaded as ASSETS binding)
  server/           # SSR handler (bundled into worker)
  cloudflare-worker/
      index.js      # Single-file Worker entry (deployed)
worker.ts             # Worker entry point
wrangler.jsonc        # Workers configuration
scripts/
  build-cloudflare.ts  # Build script
```

## Queue & Durable Objects

The deployment includes:
- **Queue**: `wallpaper-generation` for async job processing
- **Durable Object**: `JobsDurableObject` for job state management

These are configured in `wrangler.jsonc` and deployed automatically.

## Monitoring

- **Observability**: Enabled in `wrangler.jsonc`
- **Sentry**: Configured via `SENTRY_DSN` secret
- **Logs**: `npx wrangler tail` for real-time logs
