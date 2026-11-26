# Skill: ai-wallpaper-generation

# AI Wallpaper Generation — Benchmark Standard (GOGAJI)

The definitive reference for the GOGAJI AI wallpaper pipeline. This skill consolidates the complete architecture, data contracts, quality benchmarks, and verification procedures.

---

## 1. PIPELINE ARCHITECTURE

### 1.1 Overview Flow

```
+-----------------------------------------------------------------------------+
|                        WALLPAPER REQUEST (Client)                           |
|  BirthInput + { presetId?, focusAreas?, keys? }                             |
+-----------------------------------------------------------------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------+
|                    QUALIFICATION GATE (src/lib/qualification.ts)            |
|  shouldCallAI(input, intent)  ->  blocks with calm amber line if denied    |
+-----------------------------------------------------------------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------+
|                    KUNDLI ENGINE (src/lib/astro.ts)                         |
|  computeChart() -> Chart {                                                  |
|    planets: [{ key, longitude, signIndex, retrograde, nakshatraIndex,      |
|               pada, syllable }],                                           |
|    lagna: { signIndex, degreeInSign },                                     |
|    moon: { longitude, signIndex, nakshatraIndex, pada },                   |
|    houses: [{ signIndex, planets: PlanetKey[] }],                          |
|    rulingPlanet: PlanetKey,                                                |
|    utc, offsetMinutes, input, notes                                        |
|  }                                                                          |
|  SOURCES: Meeus (Sun/Moon), JPL Keplerian (Mercury-Saturn),                |
|           Lahiri ayanamsa, whole-sign houses, mean node                    |
+-----------------------------------------------------------------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------+
|                  PROBLEM ANALYZER (src/content/problems.ts)                |
|  assessChart(chart) -> BirthChartConditions {                               |
|    conditions: AstroCondition[]  // 11 negative heuristics                |
|    positives: AstroCondition[]   // 6 positive heuristics                  |
|  }                                                                          |
|  CONDITION KEYS: harsh-saturn, mangal-dosha, afflicted-moon,              |
|  weak-lagna-lord, retrograde-mercury, rahu-ketu-emphasis,                  |
|  afflicted-venus, afflicted-sun, afflicted-jupiter, malefics-in-angles    |
+-----------------------------------------------------------------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------+
|                  FACT SHEET BUILDER (chartFactSheet)                       |
|  chartFactSheet(chart, assessment, focusAreas?) -> { facts, text }          |
|  facts: structured key-value map for prompt builder                        |
|  text:  flat prose (<=1400 chars) with "Querent focus: ..." prefix          |
|  FOCUS THREADING: matching conditions/positives moved to front             |
+-----------------------------------------------------------------------------+
                                      |
                    +-----------------------+-----------------------+
                    v                       v
+-----------------------------------------------------------------------------+  +-----------------------------------------------------------------------------+
|     READING CHAIN (src/lib/gemini.ts)                                       |  |  WALLPAPER CONTEXT (skill:wallpaper-context)                              |
|  readKundli(factSheetText)                                                  |  |  Generates visual parameters:                                             |
|  Active chain: Gemini                                         |  |  energy, chakra, color, symbols, mood, inscription_theme                  |
|  Cache: 24h, max 200 entries                                                |  |  SOURCE: vedic-mapping.ts GRAHAS, NAKSHATRAS, life-areas.ts              |
|  Output: Reading { condition,                                               |  +-----------------------------------------------------------------------------+
|    primary: LifeArea[], reading,                                            |              |
|    remedies[], affirmation,                                                 |              v
|    wallpaperBrief }                                                         |  +-----------------------------------------------------------------------------+
|                                                                             |  |     IMAGE PROMPT (skill:image-prompt)                                      |
+-----------------------------------------------------------------------------+  |  Builds NVIDIA prompt from context                                          |
                                       |              |  + chartFacts + focusAreas                                                  |
                                       |              |  ALWAYS appends NO_TEXT_CLAUSE                                              |
                                       |              +-----------------------------------------------------------------------------+
                                       |                               |
                                       +-----------------------+-------+
                                                               v
+-----------------------------------------------------------------------------+
|                    NVIDIA IMAGE (src/lib/nvidia.ts)                         |
|  nvidiaWallpaper(prompt, { width: 832, height: 1216, seed })               |
|  Endpoint: https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev |
|  Auth: Authorization: Bearer <NVIDIA_API_KEY>                               |
|  Cache: 7-day in-memory (seed|WxH|prompt)                                  |
|  MIME sniffing: FF D8 FF = jpeg, 89 50 4E 47 = png                         |
|  Output: WallpaperImage { dataUrl, mime, width, height }                   |
+-----------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------+
|                  COMPOSITE RENDERER (src/lib/wallpaper.ts)                 |
|  buildWallpaperSvg({ chart, presetId, width, height,                        |
|    backgroundImageUrl, focusAreas, sample })                                |
|  Layers: AI art (base) -> scrim -> mandala/yantra -> kundli -> text column |
|  Focus band: highlights bhava, shows actual planets in that house          |
|  Problem mantra: area-specific bija mantra from vedic-mapping.ts           |
+-----------------------------------------------------------------------------+
```

### 1.2 Data Contracts

```typescript
// Client request
interface WallpaperRequest extends BirthInput {
  presetId?: string;          // temple-gold | indigo-midnight | minimal-line | dense-mandala | royal-marigold
  focusAreas?: LifeArea[];    // subset of 8 LIFE_AREAS; empty = all
  keys?: {                    // BYOK per-request overrides (never persisted server-side)
    gemini?: string;
    nvidia?: string;
  };
}

// Server response (never throws)
interface WallpaperResponse {
  chartSummary: ChartSummary;
  conditions: AstroCondition[];
  positives: AstroCondition[];
  reading?: Reading;          // null if all providers fail
  image?: WallpaperImage;     // null if NVIDIA fails or gate blocked
  prompt?: string;            // the exact NVIDIA prompt used
  provider?: "gemini"; // which reading provider answered
  error?: string;             // calm amber banner message
}
```

---

## 2. AUTHENTIC SYMBOL REQUIREMENTS (from vedic-mapping.ts)

### 2.1 Planetary Symbols (GRAHAS)

| Planet | Key | Devanagari | Symbol | Classical Colour (accent/deep/glow) | Yantra Order | Magic Constant |
|--------|-----|------------|--------|-------------------------------------|--------------|----------------|
| Sun | sun | सूर्य | Su | #e0a23c / #3a2010 / #ffd9a0 | 6x6 | 111 |
| Moon | moon | चन्द्र | Mo | #dbe6f4 / #141c2b / #ffffff | 9x9 (Siamese) | 369 |
| Mars | mars | मंगल | Ma | #c8452c / #2b0f0b / #ff9a76 | 5x5 | 65 |
| Mercury | mercury | बुध | Bu | #4f9d6c / #0f2318 / #a8e6c1 | 8x8 | 260 |
| Jupiter | jupiter | गुरु | Gu | #d7a62a / #332609 / #ffe6a0 | 4x4 | 34 |
| Venus | venus | शुक्र | Su | #e3c7a2 / #2c241d / #fff3dd | 7x7 | 175 |
| Saturn | saturn | शनि | Sa | #5b6b8c / #0b0f16 / #b9c6e0 | 3x3 | 15 |
| Rahu | rahu | राहु | Ra | #7d6c95 / #16121f / #cbb9e0 | null (geometric) | -- |
| Ketu | ketu | केतु | Ke | #a9744f / #1d1512 / #e0b48f | null (geometric) | -- |

**Rules:**
- Rahu/Ketu have NO classical magic square -> geometric yantra only (bhupura, lotus, triangles, bindu)
- Never invent numeric grids for Rahu/Ketu
- Colours derived from graha-varna, NOT nakshatra-specific (no authoritative source)

### 2.2 Nakshatra Motifs (27)

| Index | Name | Devanagari | Lord | Deity | Symbol | MotifKey | Gana |
|-------|------|------------|------|-------|--------|----------|------|
| 1 | Ashwini | अश्विनी | ketu | Ashvins | horse'"'"'s head | horse | Deva |
| 2 | Bharani | भरणी | venus | Yama | yoni | yoni | Manushya |
| 3 | Krittika | कृत्तिका | sun | Agni | razor/flame | flame | Rakshasa |
| 4 | Rohini | रोहिणी | moon | Brahma | ox-cart | chariot | Manushya |
| 5 | Mrigashira | मृगशिरा | mars | Soma | deer'"'"'s head | deer | Deva |
| 6 | Ardra | आर्द्रा | rahu | Rudra | teardrop | drop | Manushya |
| 7 | Punarvasu | पुनर्वसु | jupiter | Aditi | bow and quiver | bow | Deva |
| 8 | Pushya | पुष्य | saturn | Brihaspati | cow'"'"'s udder, lotus | lotus | Deva |
| 9 | Ashlesha | आश्लेषा | mercury | Nagas | coiled serpent | serpent | Rakshasa |
| 10 | Magha | मघा | ketu | Pitris | royal throne | throne | Rakshasa |
| 11 | Purva Phalguni | पूर्व फाल्गुनी | venus | Bhaga | front legs of bed | cot | Manushya |
| 12 | Uttara Phalguni | उत्तर फाल्गुनी | sun | Aryaman | back legs of bed | cot | Manushya |
| 13 | Hasta | हस्त | moon | Savitr | hand | hand | Deva |
| 14 | Chitra | चित्रा | mars | Tvashtar | bright jewel | jewel | Rakshasa |
| 15 | Swati | स्वाती | rahu | Vayu | young sprout | sprout | Deva |
| 16 | Vishakha | विशाखा | jupiter | Indragni | triumphal arch | arch | Rakshasa |
| 17 | Anuradha | अनुराधा | saturn | Mitra | lotus | lotus | Deva |
| 18 | Jyeshtha | ज्येष्ठा | mercury | Indra | earring/umbrella | jewel | Rakshasa |
| 19 | Mula | मूल | ketu | Nirriti | tied roots | roots | Rakshasa |
| 20 | Purva Ashadha | पूर्व आषाढा | venus | Apas | winnowing fan | fan | Manushya |
| 21 | Uttara Ashadha | उत्तर आषाढा | sun | Vishvedevas | elephant tusk | tusk | Manushya |
| 22 | Shravana | श्रवण | moon | Vishnu | three footprints | ear | Deva |
| 23 | Dhanishtha | धनिष्ठा | mars | Vasus | drum | drum | Rakshasa |
| 24 | Shatabhisha | शतभिषा | rahu | Varuna | empty circle | circle | Rakshasa |
| 25 | Purva Bhadrapada | पूर्व भाद्रपदा | jupiter | Aja Ekapada | sword | sword | Manushya |
| 26 | Uttara Bhadrapada | उत्तर भाद्रपदा | saturn | Ahirbudhnya | twins | twins | Manushya |
| 27 | Revati | रेवती | mercury | Pushan | fish/drum | fish | Deva |

**MotifKey values (renderer draws these):**
`horse`, `yoni`, `flame`, `chariot`, `deer`, `drop`, `bow`, `lotus`, `serpent`, `throne`, `cot`, `hand`, `jewel`, `sprout`, `arch`, `ear`, `roots`, `fan`, `tusk`, `drum`, `circle`, `sword`, `twins`, `fish`

### 2.3 Problem Area Mantras (from vedic-mapping.ts)

| Area | Planet | Devanagari | Roman | Gloss |
|------|--------|------------|-------|-------|
| career | sun | ॐ ह्रां ह्रीं ह्रौं सः सूर्याय नमः | Om hram hrim hraum sah suryaya namah | Salutations to Surya, for career and recognition |
| wealth | venus | ॐ द्रां द्रीं द्रौं सः शुक्राय नमः | Om dram drim draum sah shukraya namah | Salutations to Shukra, for abundance and prosperity |
| relationships | moon | ॐ श्रां श्रीं श्रौं सः चन्द्राय नमः | Om sram srim sraum sah candraya namah | Salutations to Candra, for harmony in relationships |
| health | mars | ॐ क्रां क्रीं क्रौं सः भौमाय नमः | Om kram krim kraum sah bhaumaya namah | Salutations to Bhauma (Mangala), for vitality and health |
| education | mercury | ॐ ब्रां ब्रीं ब्रौं सः बुधाय नमः | Om bram brim braum sah budhaya namah | Salutations to Budha, for learning and wisdom |
| spiritual | jupiter | ॐ ग्रां ग्रीं ग्रौं सः गुरवे नमः | Om gram grim graum sah gurave namah | Salutations to Guru (Brihaspati), for spiritual growth |
| protection | saturn | ॐ प्रां प्रीं प्रौं सः शनये नमः | Om pram prim praum sah sanaye namah | Salutations to Shani, for protection and boundaries |
| family | jupiter | ॐ ग्रां ग्रीं ग्रौं सः गुरवे नमः | Om gram grim graum sah gurave namah | Salutations to Guru (Brihaspati), for family blessings |

---

## 3. STYLE PRESET SPECIFICATIONS (PRESETS[])

| Field | temple-gold | indigo-midnight | minimal-line | dense-mandala | royal-marigold |
|-------|-------------|-----------------|--------------|---------------|----------------|
| **id** | temple-gold | indigo-midnight | minimal-line | dense-mandala | royal-marigold |
| **name** | Temple Gold | Indigo Midnight | Minimal Line-Art | Dense Mandala | Royal Marigold |
| **blurb** | Deep umber ground, beaten gold linework, dense lotus mandala | Night-indigo field, moonlit silver, medium motif density | Parchment ground, one hairline weight, wide calm space | Saturated ground, maximal ornament - every ring filled | Oxblood-and-marigold showpiece - foil double frame, dense lotus mandala |
| **bg.from** | #2a1a0d | #0d1230 | #f4efe6 | #1a0f1c | #3a0f14 |
| **bg.via** | #3d2513 | #151c47 | #efe7da | #2c1226 | #5a1a12 |
| **bg.to** | #160d06 | #05060f | #e6dccc | #0a0509 | #12060a |
| **bg.angle** | 90 | 105 | 80 | 120 | 100 |
| **bg.vignette** | #000000 | #000010 | #c9bda7 | #000000 | #000000 |
| **ink** | #f6e6c8 | #e8ecfa | #241d16 | #f7ecdf | #ffeccc |
| **inkSoft** | #cbb08a | #98a3cd | #6b5f50 | #c9a7a0 | #e0a878 |
| **rule** | #b98a3c | planet accent | planet deep | planet accent | #e0a838 |
| **accentOpacity** | 1 | 0.95 | 0.9 | 1 | 1 |
| **texture** | grain | rays | none | dots | rays |
| **rings** | 4 | 3 | 2 | 6 | 5 |
| **petals** | 24 | 16 | 12 | 32 | 28 |
| **bhupura** | true | true | false | true | true |
| **cornerMotifs** | true | false | true | true | true |
| **starField** | 40 | 90 | 0 | 140 | 70 |
| **lineWeight** | 1.6 | 1.2 | 0.9 | 1.1 | 1.4 |
| **displayFont** | serif | serif | sans | serif | serif |
| **letterSpacing** | 4 | 6 | 2 | 3 | 5 |
| **uppercase** | true | true | false | true | true |
| **dark** | true | true | false | true | true |
| **artScrim** | 0.64 | 0.66 | 0.55 | 0.70 | 0.60 |

**Contract:** `StylePreset` type in vedic-mapping.ts lines 97-127. `presetById()` falls back to `PRESETS[0]`.

---

## 4. PROBLEM AREA VISUAL THEMES

### 4.1 Life Area Profiles (from life-areas.ts)

| Area | Sanskrit | Primary House | Secondary | Accent | Deep | Glow | Emblem | Theme |
|------|----------|---------------|-----------|--------|------|------|--------|-------|
| career | Karma | 10 | -- | #e0733a | #2a160c | #f8c294 | ascending-path | Work, recognition and the 10th house of karma |
| wealth | Dhana | 2 | 11 | #c8b23c | #26220b | #f2e79b | coin | Provision, steadiness and the 2nd house of accumulation |
| relationships | Yuvati | 7 | 5,8,12 | #cf6f96 | #2a1420 | #f6c2d8 | rings | Partnership, exchange and the 7th house of yuvati |
| health | Arogya | 1 | 6 | #3fb2a0 | #0d211d | #b6ebdd | lamp | Vitality, resilience and the 1st house of the body |
| education | Vidya | 4 | 9 | #5f9fe0 | #101c2e | #c6dcf7 | ladder | Learning, training and the 4th house of sukha |
| spiritual | Dharma | 9 | 7 | #a585d4 | #1d1629 | #ddd0f5 | lotus-heart | Faith, teachers and the 9th house of dharma |
| protection | Raksha | 8 | 12 | #8e93a8 | #14161f | #d2d8e6 | shield | Resilience, boundaries and the 8th house of randhra |
| family | Sukha | 4 | 10 | #7fa23f | #1c2410 | #d8e8b4 | hearth | Roots, home and the 4th house of sukha |

### 4.2 Focus Area -> Mood Mapping (nvidia.ts:366-375)

| focusArea | Mood Sentence Theme |
|-----------|---------------------|
| wealth | "abundance and prosperity motifs" |
| relationships | "union and pairing motifs" |
| health | "vitality and radiant strength" |
| protection | "shielding geometric strength" |
| career | "an ascending path of light" |
| education | "the lamp of learning" |
| spiritual | "deep mandala stillness" |
| family | "hearth and roots" |

### 4.3 Chakra Mapping (wallpaper-context skill)

| Nakshatra Group | Chakra | Color |
|-----------------|--------|-------|
| 1-3 (Ashwini, Bharani, Kritika) | Muladhara | Red |
| 4-6 (Rohini, Mrigashira, Ardra) | Svadhisthana | Orange |
| 7-9 (Punarvasu, Pushya, Ashlesha) | Manipura | Gold |
| 10-12 (Magha, P.Phalguni, U.Phalguni) | Anahata | Green |
| 13-15 (Hasta, Chitra, Swati) | Vishuddha | Blue |
| 16-18 (Vishakha, Anuradha, Jyeshtha) | Anahata | Green |
| 19-21 (Mula, P.Ashadha, U.Ashadha) | Svadhisthana | Orange |
| 22-24 (Shravana, Dhanishtha, Shatabhisha) | Vishuddha | Blue |
| 25-27 (P.Bhadrapada, U.Bhadrapada, Revati) | Ajna | Indigo |

### 4.4 Planet -> Energy Mapping (wallpaper-context skill)

| Planet | Energy | Color |
|--------|--------|-------|
| Sun | Confidence, vitality, authority | Gold/Copper |
| Moon | Nurturing, emotional balance | White/Silver |
| Mars | Courage, action, protection | Red |
| Mercury | Communication, learning | Green |
| Jupiter | Abundance, wisdom, expansion | Yellow/Gold |
| Venus | Beauty, love, harmony | White/Variegated |
| Saturn | Discipline, endurance, karma | Black/Blue |
| Rahu | Material desire, obsession | Smoke |
| Ketu | Spirituality, detachment | Smoke Grey |

---

## 5. QUALITY BENCHMARKS & VALIDATION CRITERIA

### 5.1 Deterministic Engine Validation

Run before any release:
```bash
bun run scripts/validate-chart.ts
```
**Must pass:**
- All planetary yantras are genuine magic squares (rows, columns, diagonals = magic constant)
- Ayanamsa calculation matches Lahiri specification
- Whole-sign houses align with lagna
- Retrogression detection: sidereal longitude vs 1 day prior
- Nakshatra/pada boundaries: 13deg20'"'"' / 3deg20'"'"'
- Pada syllables match NAKSHATRAS table

```bash
bun run scripts/horizons-compare.ts
```
**Must pass:**
- Tropical longitudes within acceptable arcmin of NASA/JPL Horizons
- Worst disagreement printed; investigate if > threshold

### 5.2 AI Pipeline Benchmarks

| Metric | Target | Measurement |
|--------|--------|-------------|
| Reading chain latency (Gemini) | < 70s total | `AI_READING_BUDGET_MS` |
| NVIDIA image generation | < 95s total | `AI_IMAGE_BUDGET_MS` |
| Reading cache hit rate | > 30% | 24h TTL, max 200 entries |
| Image cache hit rate | > 20% | 7-day TTL, max 50 entries |
| Rate limit compliance | 5 req/min/IP | `AI_RATE_LIMIT_PER_MIN` |
| Degradation path success | 100% | SVG always renders |

### 5.3 Visual Quality Gates

**NVIDIA Prompt Validation:**
- Word count <= 200 (after NO_TEXT_CLAUSE reservation)
- NO_TEXT_CLAUSE present verbatim: `no readable text, no letters, no watermark, no lettering, no caption`
- Nakshatra symbol referenced by classical name
- Ruling planet colours from GRAHAS table (not invented)
- Style preset blurb + bg gradient values included
- Focus area mood sentence included when focusAreas provided
- Problem area mantra included when focusAreas[0] exists

**SVG Output Validation:**
- ViewBox: 0 0 832 1216 (portrait) or 1216 832 (landscape)
- Devanagari glyphs render (Noto Sans Devanagari @font-face present)
- Yantra grid: correct order, all cells populated, diagonal sums = magic constant
- Kundli: 12 cells, correct whole-sign placements, focus highlights on correct bhavas
- Focus band: shows actual planets in highlighted house from chart.houses
- Problem mantra: Devanagari + Roman + gloss from PROBLEM_AREA_MANTRAS
- Frame: no text overflow, corner motifs respect name boundary
- Scrim over AI art: opacity = preset.artScrim x 0.62

### 5.4 Uniqueness Guarantees

| Scenario | Expected Result |
|----------|-----------------|
| Same birth + same focus + regenerate | Different AI art (random seed), same deterministic SVG overlay |
| Same birth + different focus | Different visual emphasis (focus band, mood, problem mantra) |
| Same birth + different preset | Different palette, texture, density, typography |
| No AI keys provided | Deterministic SVG only; reading = null; image = null; error = calm amber |

---

## 6. REAL-TIME VERIFICATION CHECKLIST

### 6.1 Pre-Generation (Client)

- [ ] BirthInput validated: name, date, time, place, lat, lon, tz present
- [ ] presetId in {temple-gold, indigo-midnight, minimal-line, dense-mandala, royal-marigold}
- [ ] focusAreas subset of LIFE_AREAS (8 values)
- [ ] BYOK keys (if any): non-empty strings, masked in UI

### 6.2 Server-Side Generation

- [ ] `shouldCallAI(input, intent)` returns true -> proceed, else return SVG + calm amber
- [ ] `computeChart()` returns Chart with all 9 planets, lagna, moon, houses
- [ ] `assessChart()` returns conditions[] + positives[] (deterministic)
- [ ] `chartFactSheet()` produces facts{} + text (<=1400 chars)
- [ ] focusAreas threading: matching conditions/positives moved to front
- [ ] Reading chain: Gemini (single provider)
- [ ] Reading cache checked (key = factSheetText)
- [ ] `promptFromBrief()` builds prompt with chart facts priority > reading brief > preset
- [ ] NO_TEXT_CLAUSE appended and word-budget protected
- [ ] NVIDIA call with fresh random seed (1..2147483646)
- [ ] Image cache checked (key = seed|WxH|prompt)
- [ ] MIME sniffed from magic bytes (never trust API field)
- [ ] `buildWallpaperSvg()` composites AI art + deterministic layers

### 6.3 Post-Generation Verification

- [ ] Response shape matches WallpaperResponse (never throws)
- [ ] If reading failed: conditions + positives + SVG still present
- [ ] If image failed: reading + SVG still present, error = calm amber
- [ ] If gate blocked: SVG only, error = calm amber with BYOK button
- [ ] No API keys in response, logs, or error messages
- [ ] Devanagari renders in SVG (font-face loaded)
- [ ] Focus band shows planets actually in that house
- [ ] Problem mantra matches focusAreas[0]

---

## 7. INTEGRATION WITH EXISTING SKILLS

### 7.1 Skill Dependencies

| Skill | Role in Pipeline | Entry Point |
|-------|------------------|-------------|
| `astrology-premium-service` | Master pipeline contract | `src/server/ai.ts` |
| `ai-wallpaper-composite` | Request contract, BYOK, focus threading, banner tone | `src/server/ai.ts`, `src/components/Generator.tsx` |
| `problem-analyzer` | Maps problem -> houses/planets | `src/content/problems.ts` (assessChart, AREA_OF) |
| `wallpaper-context` | Chart + problem -> visual params (energy, chakra, color, symbols, mood) | skill:wallpaper-context |
| `image-prompt` | Visual params + chartFacts + focus -> NVIDIA prompt | skill:image-prompt, `src/lib/nvidia.ts` |
| `problem-area-wallpaper` | User flow, API endpoints, verification matrix | `src/content/life-areas.ts`, API routes |
| `regional-panchanga` | Panchanga, regional names, dasha | `src/content/regional.ts` |

### 7.2 Data Flow Between Skills

```
problem-analyzer (focus_houses, focus_planets)
       |
       v
wallpaper-context (energy, chakra, color, symbols, mood, inscription_theme)
       |
       v
image-prompt (NVIDIA prompt string with NO_TEXT_CLAUSE)
       |
       v
nvidiaWallpaper() -> WallpaperImage
       |
       v
buildWallpaperSvg() <- problem-area-wallpaper (focus band, problem mantra)
       |
       v
WallpaperResponse
```

### 7.3 Shared Constants (Single Source of Truth)

| Constant | Location | Used By |
|----------|----------|---------|
| `LIFE_AREAS` | problems.ts:57-66 | All skills |
| `GRAHAS` | vedic-mapping.ts:143-304 | astrology-premium-service, wallpaper-context, image-prompt, wallpaper.ts |
| `NAKSHATRAS` | vedic-mapping.ts:348-360 | astrology-premium-service, wallpaper-context, wallpaper.ts |
| `PRESETS` | vedic-mapping.ts:478-549 | astrology-premium-service, image-prompt, wallpaper.ts |
| `PROBLEM_AREA_MANTRAS` | vedic-mapping.ts:408-465 | astrology-premium-service, wallpaper.ts |
| `LIFE_AREA_PROFILES` | life-areas.ts:79-181 | problem-analyzer, wallpaper-context, wallpaper.ts |
| `NO_TEXT_CLAUSE` | nvidia.ts:241-242 | image-prompt, nvidia.ts |

---

## 8. OPERATIONAL RULES (Non-Negotiable)

### 8.1 Security

- **NEVER** persist BYOK keys server-side (files, DB, cache, logs)
- **NEVER** log keys at any level
- **NEVER** echo keys in responses, prompts, error strings
- Keys used for single call only, then dropped
- Host secrets via secret store; `.env` is local-dev only

### 8.2 Accuracy

- Planetary math ONLY from `src/lib/astro.ts` (deterministic)
- LLM never computes positions, ayanamsa, nakshatra, pada, houses, retrogression
- Vedic content ONLY from `src/content/vedic-mapping.ts` (data edits only)
- No invented nakshatra colours -> derive from ruling planet graha-varna
- No unverified attributions -> mark PROVISIONAL in source file

### 8.3 Degradation

| Failure | Response |
|---------|----------|
| Qualification gate blocked | Calm amber line; SVG renders |
| All reading providers fail | Conditions + positives + SVG; reading = null |
| NVIDIA fails/times out | Reading + SVG; image = null; error = calm amber |
| Missing API keys | SVG only; error = calm amber with BYOK button |
| Rate limit exceeded | Normal response shape with error; no provider call |

### 8.4 Cost Discipline

- One server round-trip per generation
- Reading chain stops at first usable answer
- NVIDIA called once per generation
- Caches: reading 24h/200 entries, image 7d/50 entries (per-instance)
- Deterministic SVG path: zero cost, zero keys, zero network
- Timeouts: 45s Gemini, 60s NVIDIA

---

## 9. TESTING & VERIFICATION COMMANDS

```bash
# Engine validation (magic squares, ayanamsa, houses, retrogression)
bun run scripts/validate-chart.ts

# Engine vs NASA/JPL Horizons
bun run scripts/horizons-compare.ts

# End-to-end browser tests
bunx playwright test

# TypeScript + lint
bun run typecheck
bun run lint

# Dev server (port 3000)
bun run dev
```

---

## 10. FILE MAP (Reference)

| File | Purpose |
|------|---------|
| `src/lib/astro.ts` | Chart engine (deterministic) |
| `src/content/vedic-mapping.ts` | All Vedic data: GRAHAS, NAKSHATRAS, PRESETS, PROBLEM_AREA_MANTRAS |
| `src/content/problems.ts` | Problem-set: LIFE_AREAS, assessChart, chartFactSheet |
| `src/content/life-areas.ts` | LifeAreaProfile: house, emblem, colours, theme |
| `src/content/regional.ts` | 36 state/UT entries, regional names, dasha |
| `src/lib/gemini.ts` | Reading provider (Gemini), cache |
| `src/lib/baidu.ts` | Third provider (not in active chain) |
| `src/lib/nvidia.ts` | Image generation, prompt builder, image cache |
| `src/lib/server-key.ts` | Single key access point (env + BYOK override) |
| `src/lib/qualification.ts` | shouldCallAI gate |
| `src/lib/crm.ts` | Lead capture (opt-in only) |
| `src/lib/wallpaper.ts` | Deterministic SVG renderer |
| `src/server/ai.ts` | Server function orchestrating full pipeline |
| `src/components/Generator.tsx` | Client UI, BYOK panel, calm amber banners |

---

**This skill is the benchmark standard.** All pipeline changes must be validated against this document. When in doubt, the deterministic engine (`src/lib/astro.ts`) and content tables (`src/content/vedic-mapping.ts`, `src/content/problems.ts`, `src/content/life-areas.ts`) are the ultimate authority.
