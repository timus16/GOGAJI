# API Documentation

## Base URL

- Development: http://localhost:3000
- Production: https://<your-worker>.workers.dev

## Authentication

Currently, the API endpoints are public. Rate limiting is applied per IP/device.

## Endpoints

### POST /api/generate

Generate a personalized Vedic kundli wallpaper with optional AI reading and artwork.

#### Request

**Content-Type:** application/json

**Body Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| name | string | Yes | - | Person's name |
| date | string | Yes | - | Birth date (YYYY-MM-DD) |
| time | string | Yes | - | Birth time (HH:MM, 24-hour) |
| place | string | Yes | - | Birth place name |
| latitude | number | No | 28.6139 | Latitude of birth place |
| longitude | number | No | 77.2090 | Longitude of birth place |
| timezone | string | No | Asia/Kolkata | IANA timezone identifier |
| presetId | string | No | temple-gold | Wallpaper style preset |
| focusAreas | string[] | No | ["all"] | Life areas to focus on |
| regionalSystem | string | No | vedic | Regional calendar system |
| subject | string | No | child | Subject type (child/adult) |
| keys | object | No | - | BYOK (Bring Your Own Keys) |
| keys.gemini | string | No | - | Custom Gemini API key |
| keys.nvidia | string | No | - | Custom NVIDIA API key |
| deviceId | string | No | - | Anonymous device identifier |

#### Presets

| Preset ID | Description |
|-----------|-------------|
| temple-gold | Traditional gold on dark background |
| indigo-midnight | Deep indigo midnight theme |
| minimal-line | Clean minimal line art |
| dense-mandala | Dense mandala pattern |

#### Focus Areas

| Focus Area | House | Primary Planet |
|------------|-------|----------------|
| career | 10th | Saturn |
| wealth | 2nd, 11th | Jupiter |
| relationships | 7th | Venus |
| health | 6th, 8th | Mars |
| education | 5th, 9th | Mercury, Jupiter |
| spiritual | 9th, 12th | Ketu |
| protection | 8th | Rahu |
| family | 4th | Moon |
| all | All | All |

#### Response

**Status Codes:**
- 200 - Success
- 400 - Missing required fields
- 429 - Rate limited
- 500 - Server error

**Response Body:**

`json
{
  "chartSummary": {
    "facts": {
      "name": "string",
      "date": "string",
      "time": "string",
      "place": "string",
      "lagna": "string",
      "lagnaDegree": "string",
      "rulingPlanet": "string",
      "moonSign": "string",
      "moonNakshatra": "string",
      "moonPada": "number",
      "nakshatraDeity": "string",
      "nakshatraSymbol": "string"
    },
    "text": "formatted fact sheet for AI prompt"
  },
  "conditions": {
    "conditions": [
      {
        "id": "string",
        "title": "string",
        "description": "string",
        "houses": [number],
        "planets": ["string"],
        "strength": "strong|moderate|weak"
      }
    ],
    "positives": ["string"]
  },
  "reading": {
    "sections": [
      {
        "title": "string",
        "content": "string"
      }
    ],
    "provider": "gemini"
  } | null,
  "image": {
    "dataUrl": "string (base64 data URI)",
    "mime": "image/png",
    "width": 832,
    "height": 1216
  } | undefined,
  "wallpaperPrompt": "string",
  "provider": "gemini" | undefined,
  "error": "string" | undefined
}
`
#### Example Request

`ash
curl -X POST https://api.example.com/api/generate \
  -H "Content-Type: application/json" \
  -d '{"name": "Asha","date": "1992-08-14","time": "05:45","place": "New Delhi","latitude": 28.6139,"longitude": 77.2090,"timezone": "Asia/Kolkata","presetId": "temple-gold","focusAreas": ["career", "wealth"],"keys": {"gemini": "your-gemini-key","nvidia": "your-nvidia-key"}}'
`

#### Example Response (Success)

`json
{
  "chartSummary": {
    "facts": {
      "name": "Asha",
      "date": "1992-08-14",
      "time": "05:45",
      "place": "New Delhi",
      "lagna": "Leo",
      "lagnaDegree": "14°32'",
      "rulingPlanet": "Sun",
      "moonSign": "Aquarius",
      "moonNakshatra": "Śatabhiṣā",
      "moonPada": 3,
      "nakshatraDeity": "Varuṇa",
      "nakshatraSymbol": "Empty circle"
    },
    "text": "Name: Asha\nBirth: 1992-08-14 05:45, New Delhi (28.61°N, 77.21°E)\nLagna: Leo 14°32' (ruling planet: Sun)\nMoon: Aquarius, Śatabhiṣā pada 3 (deity: Varuṇa, symbol: Empty circle)..."
  },
  "conditions": {
    "conditions": [
      {
        "id": "sun_in_10th",
        "title": "Sun in 10th House",
        "description": "Strong career indication...",
        "houses": [10],
        "planets": ["Sun"],
        "strength": "strong"
      }
    ],
    "positives": ["Ruling planet Sun well-placed in 10th"]
  },
  "reading": {
    "sections": [
      {
        "title": "Career & Life Path",
        "content": "With Sun ruling your Leo lagna placed in the 10th house..."
      }
    ],
    "provider": "gemini"
  },
  "image": {
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA...",
    "mime": "image/png",
    "width": 832,
    "height": 1216
  },
  "wallpaperPrompt": "Vedic kundli wallpaper, temple gold style, Leo lagna, Sun ruling planet...",
  "provider": "gemini"
}
`

#### Example Response (Rate Limited)

`json
{
  "chartSummary": { "facts": {}, "text": "" },
  "conditions": { "conditions": [], "positives": [] },
  "reading": null,
  "wallpaperPrompt": "",
  "error": "Daily limit reached - sign in for more wallpapers."
}
`

#### Example Response (AI Unavailable)

`json
{
  "chartSummary": { ... },
  "conditions": { ... },
  "reading": null,
  "wallpaperPrompt": "fallback prompt from chart facts",
  "error": "Reading unavailable: Gemini API timeout | Wallpaper unavailable: NVIDIA API error"
}
`

### GET /api/job/:id

Check the status of an asynchronous wallpaper generation job.

#### Request

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Job ID returned from queue submission |

#### Response

**Status Codes:**
- 200 - Success
- 404 - Job not found
- 500 - Server error

**Response Body:**

`json
{
  "jobId": "string",
  "status": "pending|processing|completed|failed",
  "result": { /* WallpaperResponse object */ } | null,
  "error": "string" | null,
  "createdAt": "ISO 8601 timestamp",
  "updatedAt": "ISO 8601 timestamp"
}
`

#### Example

`ash
curl https://api.example.com/api/job/abc123-def456
`

### GET /api/preview

Lightweight preview endpoint for testing chart computation without AI calls.

#### Request

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Person's name |
| date | string | Yes | Birth date (YYYY-MM-DD) |
| time | string | Yes | Birth time (HH:MM) |
| place | string | Yes | Birth place |

#### Response

Returns a simplified chart summary and SVG wallpaper.

## Error Handling

### Error Response Format

`json
{
  "error": "Human-readable error message"
}
`

### Common Errors

| Status | Error Message | Cause |
|--------|---------------|-------|
| 400 | Missing required fields | name, date, time, or place not provided |
| 429 | Daily limit reached | Rate limit exceeded |
| 500 | Generation failed: ... | Internal server error |
| 500 | Could not build the chart | Invalid birth data (e.g., impossible date) |

## Rate Limits

- **Anonymous**: 5 requests per minute per IP
- **Authenticated**: Higher limits based on plan
- **BYOK (Premium)**: Uses your own API keys, bypasses platform limits

Rate limit headers:
- X-RateLimit-Limit: Max requests
- X-RateLimit-Remaining: Remaining requests
- X-RateLimit-Reset: Unix timestamp when limit resets

## BYOK (Bring Your Own Keys)

Premium users can provide their own API keys per request:

`json
{
  "keys": {
    "gemini": "your-gemini-api-key",
    "nvidia": "your-nvidia-api-key"
  }
}
`

Requirements:
- User must have Premium subscription
- Keys are validated per request
- Platform keys are used as fallback if BYOK fails

## CORS

The API supports CORS for origins matching *nakshatra-canvas*.

Headers:
- Access-Control-Allow-Origin: Request origin
- Access-Control-Allow-Methods: GET, POST, OPTIONS
- Access-Control-Allow-Headers: Content-Type, Authorization
- Access-Control-Allow-Credentials: true
- Access-Control-Max-Age: 86400

## Security Headers

All responses include:
- Content-Security-Policy: Restrictive CSP
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin

## Testing

### Local Testing

`ash
# Start dev server
bun run dev

# Test generate endpoint
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","date":"1990-01-01","time":"12:00","place":"Delhi"}'
`

### Validation Scripts

`ash
# Chart + wallpaper smoke test
bun run scripts/probe.ts

# Engine + magic-square validator
bun run scripts/validate-chart.ts

# E2E tests
bunx playwright test
`