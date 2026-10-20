---
name: astrology-premium-service
description: Use when generating a Vedic astrological reading or wallpaper for a user, extending the Vedic content/problem-set data, reviewing astrological accuracy, or explaining the GOGAJI two-AI pipeline. Covers the deterministic chart engine, the problem-set domain model, the Gemini reading step, the NVIDIA flux.1-dev artwork step, and the provenance/accuracy rules. Triggers on "kundli reading", "Vedic wallpaper", "nakshatra", "problem set", "remedy", "astrological condition", "yantra", "chart engine".
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
| `src/content/problems.ts` | Problem-set domain model: `LifeArea`, `AstroCondition`, `BirthChartConditions`, `assessChart`, `PROBLEM_SET`, `GRAHA_DAYS`, fact sheet builder |
| `src/lib/gemini.ts` | Reading step. `geminiReading(chartSummary) -> Reading` |
| `src/lib/nvidia.ts` | Artwork step. `promptFromBrief(reading, chartFacts)`, `nvidiaWallpaper(prompt, w, h, seed)` |
| `src/server/ai.ts` | Server function that orchestrates the whole thing (`generateWallpaper`) |
| `src/lib/wallpaper.ts` | Deterministic SVG wallpaper renderer (`buildWallpaperSvg`) - the free fallback |
| `scripts/validate-chart.ts` | Engine validator + magic-square verifier |
| `scripts/horizons-compare.ts` | Engine vs NASA/JPL Horizons comparison |

## 1. DIVISION OF LABOUR (the rule that makes it trustworthy)

**Planetary positions are NEVER produced by an LLM.**

| Concern | Owner | Why |
|---|---|---|
| Planetary longitudes, ayanāṃśa, lagna, house placement, retrogression | `src/lib/astro.ts` - deterministic Meeus/JPL algorithms | Reproducible, testable, externally checkable against NASA/JPL Horizons |
| Interpretation of the computed facts | Gemini (`src/lib/gemini.ts`) | Language, framing, remediation phrasing |
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
- Time resolution: local wall-clock -> UTC in two passes so DST transitions land correctly

**Hard prohibition.** An LLM must never invent a planetary longitude, an ayanāṃśa value,
a nakshatra, a pada, a house placement, or a retrogression flag. If a fact is not in the
`Chart` object, it does not exist. Feed the model facts, never questions.

## 2. THE FLOW

```
birth input (name, date, time, place, lat, lon, IANA timezone)
  -> localToUtc -> jdFromDate
  -> computeChart()            src/lib/astro.ts
       sidereal longitudes, nakshatra + pada, lagna, whole-sign houses,
       retrogression, ruling planet (nakshatra lord), pada syllable, notes
  -> assessChart(chart)        src/content/problems.ts
       conditions[] + positives[] (deterministic heuristics over the Chart)
  -> fact sheet (chart facts + conditions + positives)  src/content/problems.ts
  -> geminiReading(facts)      src/lib/gemini.ts
       condition, primary: LifeArea[], reading, remedies[], affirmation,
       wallpaperBrief { mood, palette, motifs, inscription }
  -> promptFromBrief(reading, chartFacts)   src/lib/nvidia.ts
  -> nvidiaWallpaper(prompt, 832, 1216, seed)  src/lib/nvidia.ts
       -> { dataUrl, mime, width, height }
  -> composite / present: deterministic SVG (src/lib/wallpaper.ts) + AI art + reading UI
```

`src/server/ai.ts` exposes `generateWallpaper` as a `createServerFn({ method: "POST" })`
and returns chart summary + conditions + reading + optional image + the prompt + an
`error` string. On any AI failure it still returns the chart and conditions so the
client degrades gracefully instead of rendering nothing.

**Degradation order (must always work):**

1. AI image (NVIDIA) - richest
2. Deterministic SVG wallpaper (`buildWallpaperSvg`) - free, always available
3. Reading text - if Gemini fails, show the conditions and the deterministic chart only
4. Never fail the page because a key is missing or a provider is down

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

| Key | Trigger (approximate) |
|---|---|
| `harsh-saturn` | Saturn retrograde or in a dusthana (1/6/8/12) |
| `mangal-dosha` | Mars in the 1st, 4th, 7th, 8th, or 12th house |
| `weak-lagna-lord` | Lagna lord retrograde or in a dusthana |
| `afflicted-moon` | Moon in a dusthana or retrograde |
| `ketu-detachment` | Ketu in the 1st, 7th, or 10th from the lagna |
| `rahu-obsession` | Rāhu in the 1st, 7th, or 10th from the lagna |
| `budha-retrograde` | Mercury retrograde (communication/dispute axis) |
| `venus-afflicted` | Venus retrograde or in a dusthana |
| `sun-afflicted` | Sun in a dusthana (authority/self axis) |
| `jupiter-afflicted` | Jupiter retrograde or in a dusthana (guidance/dharma axis) |

Positive `positives[]` (same heuristic family, e.g. `benefic-jupiter`, benefic placements
of Venus/Moon/Mercury in kendras and trikonas).

### STATUS: PROVISIONAL

These are **heuristics, not Jyotiṣa doctrine**. Aspects, śadbala, daśā, dignity, and
functional benefic/malefic weighting are **not** modelled. The rules mirror the provenance notes in
`src/content/vedic-mapping.ts`: they are a first pass pending domain (Jyotiṣa) review.

- Every heuristic is a **data entry**, not a hard-coded branch. Add, reword, or retire a
  condition by editing `src/content/problems.ts`.
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
- When changing a preset, keep the `StylePreset` contract: `bg`, `ink`, `inkSoft`, `rule`,
  `texture`, `rings`, `petals`, `bhupura`, `cornerMotifs`, `starField`, `lineWeight`,
  `displayFont`, `letterSpacing`, `uppercase`, `dark`.
- Devanagari must render as glyphs, never tofu: the wallpapers declare
  `'Noto Sans Devanagari'` in the `@font-face` rules and the reading UI points at that
  family explicitly. Do not replace it with a generic `serif` fallback.

## 6. OPERATIONAL CHECKLIST

### Environment

| Var | Used by | Notes |
|---|---|---|
| `GEMINI_API_KEY` | `src/lib/gemini.ts` | Google AI Studio key. Read from `process.env` in server-only code. Never written to a file, never echoed |
| `NVIDIA_API_KEY` | `src/lib/nvidia.ts` | NVIDIA key (`nvapi-...`). Same rules |

`src/lib/server-key.ts` is the single place that reads them and throws a clear
missing-key error. `.env.example` holds placeholders only. A real `.env` is never committed.

### Verified model ids and endpoints

| Service | Model / URL | Status |
|---|---|---|
| Gemini text | `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent` | **Works** on this key. `gemini-2.5-flash` 404s for new keys - do not use it |
| Gemini auth | `?key=<KEY>` query param, with `X-Goog-Api-Key` header fallback | Header-only retry on 400/401/403 |
| Gemini images | `gemini-2.5-flash-image` / `gemini-3.1-flash-image` / `gemini-3-pro-image` | **Free tier image quota is 0** - every image call returns 429 `RESOURCE_EXHAUSTED` (limit 0, retry ~6.5 h). **Images must come from NVIDIA**, not Gemini |
| NVIDIA image | `POST https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev` | **The only working image endpoint.** `artifacts[0].base64` holds the bytes |
| NVIDIA alt | `black-forest-labs/flux.1-schnell` | Hangs (HTTP 000) - do not use |
| NVIDIA alt | `stabilityai/stable-diffusion-3-5-large` | HTTP 404 `page not found` - do not use |
| NVIDIA alt | `https://integrate.api.nvidia.com/v1/images/generations` | HTTP 404 - do not use |
| NVIDIA auth | `Authorization: Bearer <NVIDIA_API_KEY>` | Header name exactly as shown |

Response bytes from flux.1-dev may be **JPEG even when the file is named `.png`**. Sniff
the magic bytes (`FF D8 FF` = jpeg, `89 50 4E 47` = png) and label the MIME accordingly.
Never mislabel; never guess.

### Expected failure modes

| Symptom | Cause | Response |
|---|---|---|
| Gemini 429 `RESOURCE_EXHAUSTED`, "limit: 0" | Free-tier image quota is zero | Expected. Do not retry in a loop. Use the deterministic SVG path |
| Gemini 404 on `gemini-2.5-flash` | Deprecated for new users | Use `gemini-3.8-flash` |
| Gemini returns non-JSON | Model ignored `responseMimeType` | Throw. **Never fabricate a reading** |
| NVIDIA HTTP 000 / hang | flux.1-schnell or a slow model | Switch to flux.1-dev; keep the 60 s AbortSignal |
| NVIDIA 404 `page not found` | Wrong endpoint or model id | Use the flux.1-dev genai endpoint |
| Missing key | `process.env` unset in the host | Fall back to the deterministic SVG; surface a clear message |
| Provider timeout | 45 s Gemini / 60 s NVIDIA | The server fn must still return chart + conditions + error |

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

- **One server round-trip per generation.** The client calls the server function once; the
  server calls Gemini once and NVIDIA once. Never loop the round-trip.
- **Never call the image model twice for the same chart.** Cache the prompt and the seed
  (both `src/lib/gemini.ts` and `src/lib/nvidia.ts` keep an in-memory cache - Gemini 24 h,
  NVIDIA 7 days). A stable seed with the same prompt is what makes the artwork reproducible.
- **The deterministic SVG path is the free fallback and must keep working with no keys.**
  `buildWallpaperSvg` is a pure function; it must never require a key, a network call, or
  an AI model. If a change breaks the no-key path, that change is wrong.
- Timeouts are part of the cost model: 45 s Gemini, 60 s NVIDIA, plus retry only where
  the failure is transient. Do not add unbounded retries.
- Long AI work must be a `POST` server function (never a GET the gateway can re-send), and
  should stream or poll if it regularly runs past ~20 s.