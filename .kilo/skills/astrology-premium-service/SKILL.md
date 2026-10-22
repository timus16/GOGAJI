---
name: astrology-premium-service
description: Use when generating a Vedic astrological reading or wallpaper for a user, extending the Vedic content/problem-set data, reviewing astrological accuracy, or explaining the GOGAJI two-AI pipeline. Covers the deterministic chart engine, the problem-set domain model, the multi-provider reading step (active chain: Gemini -> OpenRouter; Baidu exists but is NOT in the active chain), the NVIDIA flux.1-dev artwork step, and the provenance/accuracy rules. Triggers on "kundli reading", "Vedic wallpaper", "nakshatra", "problem set", "remedy", "astrological condition", "yantra", "chart engine".
---

# Astrology Premium Service (GOGAJI)

The product is a **two-AI pipeline**: a deterministic Jyotiṣa engine computes the facts,
one LLM interprets them, one image model renders them. This skill is the operating
contract for that pipeline.

## 0. Map of the code

| File | Role |
|---|---|
| `src/lib/astro.ts` | Chart engine. Pure functions, no I/O, browser-safe. `computeChart`, `localToUtc`, `lahiriAyanamsa`, `moonLongitude`, `meanNode`, `tropicalAscendant`, `dms`, `rashiOf`, `formatOffset` |
| `src/content/vedic-mapping.ts` | **All** Vedic data: `GRAHAS` (colour/mantra/yantra), `NAKSHATRAS` (27, with lord/deity/symbol/motif/gana/pada-syllables), `RASHIS`, `PRESETS` (4 style archetypes), `NAK_SPAN`, `PADA_SPAN` |
| `src/content/problems.ts` | Problem-set domain model: `LifeArea` + `LIFE_AREAS` (8), `AstroCondition`, `BirthChartConditions`, `assessChart`, `chartFactSheet` (the fact sheet builder) |
| `src/lib/gemini.ts` | Reading layer: canonical prompt, shared `sanitizeReading`/`parseJsonPayload`/`errorMessage`/`isUsableReading`, the 24h reading cache, and the active chain `readKundli(chartSummary) -> { reading, provider }` (Gemini -> OpenRouter; Baidu kept but NOT in the chain). `geminiReading` is the first provider; `buildReadingPrompt(chartSummary, focusAreas?)` threads the checklist |
| `src/lib/openrouter.ts` | Second reading provider (`openrouterReading`, active chain): OpenRouter zero-priced models, at most 3 attempts |
| `src/lib/baidu.ts` | Third reading provider (`baiduReading`): Baidu Qianfan / ERNIE; the key travels only in the `Authorization` header, never in the URL. Present but **not** in the active chain |
| `src/lib/nvidia.ts` | Artwork step. `promptFromBrief(reading, chartFacts, { focusAreas })`, `nvidiaWallpaper(prompt, opts)`, plus a 7-day per-instance image cache and magic-byte mime sniffing (`sniffImageMime`) |
| `src/lib/server-key.ts` | Single server-only place that reads the four provider keys from `process.env` (`geminiKey`, `openrouterKey`, `baiduKey`, `nvidiaKey`) |
| `src/server/ai.ts` | Server function that orchestrates the whole thing (`generateWallpaper` / `buildWallpaperResponse`): the `shouldCallAI` qualification gate (before any provider call), request-wide AI budget, in-memory per-IP rate limit, never throws |
| `src/lib/wallpaper.ts` | Deterministic SVG wallpaper renderer (`buildWallpaperSvg`) - the free fallback |
| `scripts/validate-chart.ts` | Engine validator + magic-square verifier |
| `scripts/horizons-compare.ts` | Engine vs NASA/JPL Horizons comparison |
| `src/content/regional.ts` | Regional layer: `INDIAN_STATES` - 36 entries (28 states + 8 UTs), amānta/pūrṇimānta per state, real new-years, regional rashi+nakshatra names, `traditionByState` alias matching |

**Regional layer.** State/UT traditions (reckoning, new-years, native names) live in `src/content/regional.ts`; the operating contract for them is `.kilo/skills/regional-panchanga/SKILL.md`.

## 1. DIVISION OF LABOUR (the rule that makes it trustworthy)

**Planetary positions are NEVER produced by an LLM.**

| Concern | Owner | Why |
|---|---|---|
| Planetary longitudes, ayanāṃśa, lagna, house placement, retrogression | `src/lib/astro.ts` - deterministic Meeus/JPL algorithms | Reproducible, testable, externally checkable against NASA/JPL Horizons |
| Interpretation of the computed facts | Gemini, then OpenRouter - the active chain; Baidu exists but is not wired in (`src/lib/gemini.ts`) | Language, framing, remediation phrasing; every provider gets the same prompt and the same validator |
| Wallpaper artwork | NVIDIA flux.1-dev (`src/lib/nvidia.ts`) | Image generation |
| Yantra grid, kundli, mandala, palette, Devanagari typography | `src/lib/wallpaper.ts` - deterministic SVG | Vector precision, zero cost, works with no API key |

### Engine provenance (`src/lib/astro.ts` header - keep it true)

- Sun: Meeus, *Astronomical Algorithms* ch. 25 (low-precision, ~0.01 deg apparent geocentric tropical longitude of date)
- Moon: Meeus ch. 47, series truncated at `|term| >= 0.004 deg` (~23 terms, residual under 0.02 deg vs the Moon's 0.55 deg/hour)
- Mercury-Saturn: JPL "Approximate Positions of the Planets" Keplerian elements (valid 1800-2050), heliocentric -> geocentric ecliptic longitude
- Rāhu/Ketu: mean lunar node (Meeus ch. 47); Rāhu = Ω, Ketu = Ω + 180 deg
- Ayanāṃśa: Lāhiri (Citrāpakṣa), anchored at 23°51'11" (= 23.85306 deg) at J2000, advanced by general precession in longitude `p = 5029.0966"·T + 1.11113"·T²`
- Ascendant: tropical ascendant from mean obliquity + apparent sidereal time (Meeus ch. 12), converted to the sidereal zodiac
- Houses: **whole-sign** (rāśi = bhāva); lagna sign = house 1
- Retrogression: sidereal longitude compared with the value one day earlier
- Panchang: `computePanchang(utc, offsetMinutes)` - tithi, yoga, karaṇa, vāra, and the lunar
  month by the CORRECTED classical rule `amāntaIndex = (floor(sunAtNewMoon/30) + 1) mod 12`,
  where `sunAtNewMoon = sun - (elongation/12.19) × 0.9856`; pūrṇimānta = amānta + 1 when
  Kṛṣṇa paksha. Validation anchors that MUST stay true: 1992-08-14 -> Śrāvaṇa (Śrāvaṇa
  Pūrṇimā was 1992-08-13); 2024-04-09 (Gudī Padwā) -> Chaitra; Śukla paksha => the
  pūrṇimānta name equals the amānta name. Full contract: `regional-panchanga/SKILL.md`.
- Vimśottarī daśā: `vimshottariDasha(chart, count)` - balance from the nakṣatra fraction,
  120-year cycle (Ketu 7, Śukra 20, Sūrya 6, Candra 10, Maṅgala 7, Rāhu 18, Guru 16,
  Śani 19, Budha 17).
- Time resolution: local wall-clock -> UTC in two passes so DST transitions land correctly

**Hard prohibition.** An LLM must never invent a planetary longitude, an ayanāṃśa value,
a nakshatra, a pada, a house placement, or a retrogression flag. If a fact is not in the
`Chart` object, it does not exist. Feed the model facts, never questions.

## 2. THE FLOW

```
WallpaperRequest = BirthInput & { presetId?: string; focusAreas?: string[];
  keys?: { gemini?; openrouter?; nvidia? } }   // BYOK, per-request, from localStorage `gogaji.keys`
  -> shouldCallAI(input, intent)   src/lib/qualification.ts   GATE: BEFORE any provider call;
       blocked => one calm amber line; the deterministic wallpaper still renders
  -> captureSubmit(data, consent)  src/lib/crm.ts   persists ONLY when consent (AI opt-in);
       otherwise transient
birth input (name, date, time, place, lat, lon, IANA timezone)
  -> localToUtc -> jdFromDate
  -> computeChart()            src/lib/astro.ts
       sidereal longitudes, nakshatra + pada, lagna, whole-sign houses,
       retrogression, ruling planet (nakshatra lord), pada syllable, notes
  -> assessChart(chart)        src/content/problems.ts
       conditions[] + positives[] (deterministic heuristics over the Chart)
  -> chartFactSheet(chart, conditions, focusAreas)   src/content/problems.ts
       facts{} + flat text (chart facts + conditions + positives; focus areas move the relevant conditions to the front and add a "Querent focus:" line)
  -> readKundli(factSheetText) src/lib/gemini.ts
       cache hit, else the ACTIVE chain Gemini -> OpenRouter (Baidu exists but is not in the chain)
       -> { reading, provider }; empty/unusable answers fall through
       condition, primary: LifeArea[], reading, remedies[], affirmation,
       wallpaperBrief { mood, palette, motifs, inscription }
  -> buildReadingPrompt(factSheetText, focusAreas?)  src/lib/gemini.ts
        (adds the QUERENT'S STATED FOCUS line)
  -> promptFromBrief(reading, chartFacts, { focusAreas })   src/lib/nvidia.ts
        (one thematic-mood sentence; the no-readable-text clause stays)
  -> nvidiaWallpaper(prompt, { width: 832, height: 1216 })  src/lib/nvidia.ts
       -> { dataUrl, mime, width, height }
  -> composite / present: deterministic SVG (src/lib/wallpaper.ts) + AI art + reading UI
```

`src/server/ai.ts` exposes `generateWallpaper` as a `createServerFn({ method: "POST" })`
and returns chart summary + conditions + reading + optional image + the prompt + the
answering `provider` + an `error` string. It **never throws**: the whole request is
budgeted (`AI_READING_BUDGET_MS` = 70 s over the reading chain, `AI_IMAGE_BUDGET_MS` =
95 s over the NVIDIA call plus any image download), an in-memory per-IP fixed-window
rate limit gates the paid path (`AI_RATE_LIMIT_PER_MIN`, default 5/min), and every
failure degrades to the chart-accurate result.

**Degradation order (must always work):**

1. AI image (NVIDIA) - richest
2. Deterministic SVG wallpaper (`buildWallpaperSvg`) - free, always available
3. Reading text - if every reading provider fails, show the conditions and the deterministic chart only
4. Never fail the page because a key is missing or a provider is down

**Gates before providers.** `shouldCallAI(input, intent)` (`src/lib/qualification.ts`) runs BEFORE any provider call and blocks with a calm amber line; `captureSubmit(data, consent)` (`src/lib/crm.ts`) persists a lead ONLY when consent (the AI opt-in checkbox) is given, otherwise the data stays transient.

## 3. PROBLEM SET MODEL (`src/content/problems.ts`)

### Life areas (the taxonomy)

| LifeArea | Devotional framing focus |
|---|---|
| `career` | Direction, steadiness of work, the calling behind the role |
| `wealth` | Provision, flow, right use of resources |
| `relationships` | Partnership, marriage, bonds of affection |
| `health` | The body, vitality, the discipline of routine |
| `education` | Learning, teachers, the disciplined mind |
| `spiritual` | Practice, the inner path, the deity within |
| `protection` | Obstacles, enemies, the guarding of the person |
| `family` | Parents, siblings, lineage, the inherited household |

### Condition keys the engine detects

Negative `conditions[]` (deterministic, whole-sign house + retrogression heuristics):

| Key | Trigger (as implemented in `assessChart`) |
|---|---|
| `harsh-saturn` | Saturn in a dusthāna (6/8/12), debilitated, retrograde, or in the 7th/8th/9th from the Moon (sade sātī phase) |
| `mangal-dosha` | Mars in the 1st, 4th, 7th, 8th, or 12th house |
| `afflicted-moon` | Moon in a dusthāna (6/8/12), debilitated, on the Rāhu-Ketu axis, or in a Rākṣasa-gaṇa nakshatra |
| `weak-lagna-lord` | Lagna lord in a dusthāna (6/8/12), debilitated, or retrograde |
| `retrograde-mercury` | Mercury retrograde |
| `rahu-ketu-emphasis` | Rāhu or Ketu in an angle (1/4/7/10), in the lagna, conjunct the lagna lord, or Rāhu conjunct the Moon |
| `afflicted-venus` | Venus in a dusthāna (6/8/12), debilitated, or retrograde |
| `afflicted-sun` | Sun in the 6th or 12th, debilitated, or conjunct Rāhu |
| `afflicted-jupiter` | Jupiter in a dusthāna (6/8/12) |
| `malefics-in-angles` | Two or more natural malefics in the kendras (1/4/7/10) |

Positive `positives[]` (same deterministic family): `strong-jupiter`, `exalted-benefic`
(a natural benefic exalted), `own-sign-benefic` (a natural benefic in its own sign),
`favourable-moon-nakshatra`, `strong-lagna-lord`, and `waxing-moon`.

### STATUS: PROVISIONAL

These are **heuristics, not Jyotiṣa doctrine**. Aspects, śadbala, daśā, dignity, and
functional benefic/malefic weighting are **not** modelled. The rules mirror the provenance notes in
`src/content/vedic-mapping.ts`: they are a first pass pending domain (Jyotiṣa) review.

- Every heuristic is a **data entry**, not a hard-coded branch. Add, reword, or retire a
  condition by editing `src/content/problems.ts`.
- The mūlatrikona (`TRIKONA`) table is verified against `OWN_SIGNS`: each value is a sign
  the graha actually rules (the Moon is the one classical exception - it rules Cancer but
  its mūlatrikona is Taurus). Keep the two tables consistent when editing.
- Never present a condition to a user as a classical verdict. Present it as a reading of
  the computed chart, in a devotional register.
- When a rule cannot be grounded, mark it PROVISIONAL in-file rather than inventing a
  classical citation.

## 4. ACCURACY AND HONESTY RULES

### Cite only what you can check

| Source | Use for |
|---|---|
| Bṛhat Parāśara Horā Śāstra (BPHS) | Nakṣatra order, ruling graha (Vimśottarī daśā lords), presiding deity, classical symbol, basic yoga principles |
| Hart de Fouw & Robert Svoboda, *Light on Life* | Modern standard tables for nakṣatras, deities, graha-varṇa, bīja mantras |
| David Frawley, *Astrology of the Seers* | Planetary dignities, classical house significations, the graha-varṇa colour scheme |
| Agrippa, *De Occulta Philosophia*, Book II | The Chaldean planetary magic squares (the order 3-9 set) |

### Never invent

- **No invented nakshatra colour.** There is no single authoritative nakshatra-colour
  set; sources disagree. Derive the palette from the **ruling planet's classical
  graha-varṇa** (Sun copper/red, Moon white, Mars red, Mercury green, Jupiter yellow,
  Venus white/variegated, Saturn black-deep blue, Rāhu smoke, Ketu smoke-grey).
- **No unverified attribution.** Do not claim a mantra, deity, or remedy "per BPHS" unless
  it is in the tables above or in `src/content/vedic-mapping.ts`.
- **Rāhu and Ketu have no classical planetary magic square.** They ship `yantra: null` and
  render **geometrically only** (bhūpura, lotus, interlaced / inverted triangles, bindu).
  Never fabricate a numeric grid for them.
- **The AI reading is a devotional framing grounded in computed facts** - not a substitute
  for the chart, and not a substitute for professional advice.

### What the engine itself claims

`Chart.notes` carries the standing caveats (Lāhiri ayanāṃśa, mean node for Rāhu/Ketu,
whole-sign houses). Keep them accurate if the engine changes. A pada is 200 arcmin wide
and a rāśi 1800 arcmin, so a sub-arcminute engine error can still change a pada for a
birth time given to the minute - see the validator's printed sensitivity note.

## 5. VEDIC CONTENT AUTHORING RULES

- **All** Vedic content lives in `src/content/vedic-mapping.ts` (nakṣatras, grahas, yantras,
  mantras, colours, style presets). The renderer hard-codes **none** of it, so a
  correction is a pure data edit - no renderer change, no test churn.
- Add a **provenance note** for every new claim: which source, which table, which
  classical attribution.
- Mark anything unverifiable as **PROVISIONAL** rather than inventing a source. The file
  header already keeps a numbered list of what could not be verified.
- When changing a magic-square `order`, change the data and re-run
  `bun run scripts/validate-chart.ts` - the renderer re-verifies the magic constant.
- The four style preset ids are `temple-gold`, `indigo-midnight`, `minimal-line` and
  `dense-mandala` (note: `minimal-line`, **not** `minimal-line-art`); `presetById()` falls
  back to `PRESETS[0]`. When changing a preset, keep the `StylePreset` contract: `id`,
  `name`, `blurb`, `bg`, `ink`, `inkSoft`, `rule`, `accentOpacity`, `texture`, `rings`,
  `petals`, `bhupura`, `cornerMotifs`, `starField`, `lineWeight`, `displayFont`,
  `letterSpacing`, `uppercase`, `dark`.
- Devanagari must render as glyphs, never tofu: the wallpapers declare
  `'Noto Sans Devanagari'` in the `@font-face` rules and the reading UI points at that
  family explicitly. Do not replace it with a generic `serif` fallback.

## 6. OPERATIONAL CHECKLIST

### Environment

| Var | Used by | Notes |
|---|---|---|
| `GEMINI_API_KEY` | `src/lib/gemini.ts` | Google AI Studio key. Read from `process.env` in server-only code. Never written to a file, never echoed |
| `OPENROUTER_API_KEY` | `src/lib/openrouter.ts` | OpenRouter key (second provider). Same rules |
| `BAIDU_API_KEY` | `src/lib/baidu.ts` | Baidu Qianfan key (third provider; **not** in the active chain). Sent **only** in the `Authorization` header, never in the URL. Same rules |
| `NVIDIA_API_KEY` | `src/lib/nvidia.ts` | NVIDIA key (`nvapi-...`). Same rules |
| (per-request) `keys.gemini` / `keys.openrouter` / `keys.nvidia` | `src/lib/server-key.ts` | BYOK: overrides the env key for that single call (`geminiKey(override)` / `openrouterKey(override)` / `nvidiaKey(override)`); never persisted, never logged, never echoed |
| `AI_RATE_LIMIT_PER_MIN` | `src/server/ai.ts` | Per-IP requests per minute for AI generation. Default 5 |
| `BAIDU_MODEL_ID` | `src/lib/baidu.ts` | Optional Qianfan model override. Default `ernie-3.5-8k` |

`src/lib/server-key.ts` is the single place that reads them (`geminiKey`, `openrouterKey`,
`baiduKey`, `nvidiaKey`) and throws a clear missing-key error. Each also accepts an optional per-request override - `geminiKey(override)` / `openrouterKey(override)` / `nvidiaKey(override)` - which supersedes `process.env` for that single call (BYOK: keys arrive from the browser in `WallpaperRequest.keys`; never persisted server-side, never logged, never echoed). On a deployed host the keys
come from the **host secret store**, not from `.env`: a `.env` file is local-dev only and is
not published, so a key that lives only in `.env` is missing live. `.env.example` holds
placeholders only; a real `.env` is never committed.

### Verified model ids and endpoints

| Service | Model / URL | Status |
|---|---|---|
| Gemini text | `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent` | **Works** on this key. `gemini-2.5-flash` 404s for new keys - do not use it |
| Gemini auth | `x-goog-api-key: <KEY>` request header | Header only - the key is never put in the URL |
| Gemini images | `gemini-2.5-flash-image` / `gemini-3.1-flash-image` / `gemini-3-pro-image` | **Free tier image quota is 0** - every image call returns 429 `RESOURCE_EXHAUSTED` (limit 0, retry ~6.5 h). **Images must come from NVIDIA**, not Gemini |
| NVIDIA image | `POST https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev` | **The only working image endpoint.** `artifacts[0].base64` holds the bytes |
| NVIDIA alt | `black-forest-labs/flux.1-schnell` | Hangs (HTTP 000) - do not use |
| NVIDIA alt | `stabilityai/stable-diffusion-3-5-large` | HTTP 404 `page not found` - do not use |
| NVIDIA alt | `https://integrate.api.nvidia.com/v1/images/generations` | HTTP 404 - do not use |
| NVIDIA auth | `Authorization: Bearer <NVIDIA_API_KEY>` | Header name exactly as shown |
| OpenRouter text | `POST https://openrouter.ai/api/v1/chat/completions` | Second provider. Zero-priced models only, at most 3 attempts; retries on 402/404/429/5xx, stops on other statuses |
| OpenRouter auth | `Authorization: Bearer <OPENROUTER_API_KEY>` + `HTTP-Referer`, `X-Title` | Header only |
| Baidu Qianfan | `POST https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/<model>` | Third provider; model defaults to `ernie-3.5-8k` (permanent free tier) |
| Baidu auth | `Authorization: Bearer <BAIDU_API_KEY>` | Header only - **never** in the URL |

Response bytes from flux.1-dev may be **JPEG even when the file is named `.png`**. Sniff
the magic bytes (`FF D8 FF` = jpeg, `89 50 4E 47` = png) and label the MIME accordingly.
Never mislabel; never guess.

### Expected failure modes

| Symptom | Cause | Response |
|---|---|---|
| Gemini 429 `RESOURCE_EXHAUSTED`, "limit: 0" | Free-tier image quota is zero | Expected. Do not retry in a loop. Use the deterministic SVG path |
| Gemini 404 on `gemini-2.5-flash` | Deprecated for new users | Use `gemini-3.8-flash` |
| Gemini returns non-JSON | Model ignored `responseMimeType` | Throw inside that provider; the chain falls through to the next. **Never fabricate a reading** |
| NVIDIA HTTP 000 / hang | flux.1-schnell or a slow model | Switch to flux.1-dev; keep the 60 s AbortSignal |
| NVIDIA 404 `page not found` | Wrong endpoint or model id | Use the flux.1-dev genai endpoint |
| Missing key | `process.env` unset in the host | Fall back to the deterministic SVG; surface a clear message |
| Provider timeout | 45 s Gemini / 30 s OpenRouter / 30 s Baidu / 60 s NVIDIA | Each is under the 70 s reading / 95 s image budget; the server fn must still return chart + conditions + error |
| Rate limit tripped | More than `AI_RATE_LIMIT_PER_MIN` (default 5) requests/min from one IP | Return the normal response shape with an `error` and make no provider call |

### Deploy targets

- **Primary: Bun.** `serve.ts` serves the built app via `bun run start` (`bun run build`
  first; `bun run publish` wraps it). It pins Bun's `idleTimeout` to 255 s - the request
  budget in `src/server/ai.ts` is sized to stay under that.
- **Cloudflare Workers (optional).** `bun run build:cloudflare` bundles the Worker + SSR
  handler to `dist/cloudflare-worker/index.js`, then `npx wrangler deploy`. Requires the
  Workers **Paid** plan: `limits.cpu_ms` cannot be raised above the Free plan's 10 ms, and
  SSR plus an AI call exceeds it. See `docs/CLOUDFLARE-DEPLOY.md`.
- **Secrets** come from the host secret store (Worker secrets via
  `npx wrangler secret put <NAME>`), never from `.env` and never from `wrangler.jsonc`
  `vars` (which is public and holds non-secret config only).

### Validation commands

```bash
# Engine validator: resolved UTC, ayanāṃśa, tropical + sidereal longitudes,
# nakshatra + pada, lagna, whole-sign houses, retrogression,
# AND that every planetary yantra is a genuine magic square.
bun run scripts/validate-chart.ts

# Compare the engine's tropical longitudes against NASA/JPL Horizons
# (public, independent ephemeris). Prints the worst disagreement in arcmin.
bun run scripts/horizons-compare.ts
```

`validate-chart.ts` is the proof that each magic square is genuinely magic (all rows,
columns, and both diagonals sum to the magic constant, with 1..n² distinct). If it prints
`*** SQUARE DEFECT ***`, the yantra data is wrong - fix the data, never the checker.
`horizons-compare.ts` needs network access to `ssd.jpl.nasa.gov`.

If `bun` is unavailable on the machine, `npx -y --package bun bun run scripts/<name>.ts`
runs the same scripts; plain `node --experimental-strip-types` fails on the repo's
extensionless imports.

## 7. COST DISCIPLINE

- **One server round-trip per generation.** The client calls the server function once. The
  reading is the active chain (Gemini -> OpenRouter) that stops at the first usable answer,
  and NVIDIA is called once. Never loop the round-trip.
- **Never re-generate the same work.** Caches now really exist and are per-instance and
  in-memory (they start empty on a restart or a second replica): `src/lib/gemini.ts` keeps
  a 24 h reading cache (max 200 entries) keyed by the exact fact sheet, and
  `src/lib/nvidia.ts` keeps a 7-day image cache (max 50 entries) keyed by
  seed + width x height + the exact prompt. Only successes are cached. A stable seed with
  the same prompt is what makes the artwork reproducible.
- **The deterministic SVG path is the free fallback and must keep working with no keys.**
  `buildWallpaperSvg` is a pure function; it must never require a key, a network call, or
  an AI model. If a change breaks the no-key path, that change is wrong.
- Timeouts are part of the cost model: 45 s Gemini, 30 s OpenRouter, 30 s Baidu, 60 s
  NVIDIA, all under a 70 s reading and 95 s image budget. Retry only where the failure is
  transient; do not add unbounded retries.
- The paid path is rate-limited per IP (`AI_RATE_LIMIT_PER_MIN`, default 5/min, in-memory
  and per-instance). Long AI work must be a `POST` server function (never a GET the gateway
  can re-send), and should stream or poll if it regularly runs past ~20 s.