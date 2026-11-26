# Skill: child-wallpaper-generator

# Child Vedic Wallpaper Generator

## Purpose
Generate a personalized Vedic wallpaper for a child using their exact birth details (name, date, time, place). The wallpaper is a deterministic, chart-accurate rendering - NOT a mockup - using the same engine as the main generator but optimized for hero-section preview.

## User Flow
1. Parent enters child's name, birth date, birth time, birth place on landing page
2. System computes exact birth chart (nakshatra, pada, lagna, ruling planet, syllable)
3. Lightweight preview endpoint returns deterministic SVG wallpaper + chart facts
4. Hero shows live preview with child's actual nakshatra and naming syllable
5. Parent clicks "Create Wallpaper" → navigates to main generator with pre-filled data
6. Full generator produces downloadable phone/desktop wallpapers

## Technical Architecture

### Preview Endpoint: `/api/preview/lightweight`
- **Input**: BirthInput (name, date, time, place, lat, lon, timezone) + optional presetId
- **Output**: `{ svg: string, chartFacts: { nakshatra, nakshatraDevanagari, rulingPlanet, namingSyllable, namingSyllableDevanagari } }`
- **No AI calls** - purely deterministic, <200ms
- **Uses**: `computeChart()` from `src/lib/astro.ts` + `buildWallpaperSvg()` from `src/lib/wallpaper.ts`
- **Font**: Uses `previewFontFaceCss` (embedded WOFF2 data URIs) for consistent rendering

### Chart Facts Extracted
- `moonNakshatra` - nakshatra name + devanagari
- `rulingPlanet` - planet key for yantra/mantra
- `syllable` - naming syllable (roman + devanagari)
- `lagna` - ascendant sign index
- `moonPada` - pada (1-4)

### Hero Component: `HeroNicheA`
- Form with: name, gender (girl/boy), birth date (native date input), birth time (native time input), birth place (text)
- Auto-generates preview on input change (800ms debounce)
- Shows live SVG preview with child's actual chart data
- "Generate Preview" button for manual trigger
- "Create Wallpaper" button navigates to `/?name=...&for=child&date=...&time=...&place=...`

## Key Differences from Main Generator
| Aspect | Hero Preview | Main Generator |
|--------|-------------|----------------|
| Speed | <200ms | 2-60s (with AI) |
| AI | Never | Optional (BYOK) |
| Output | Preview SVG (480x640) | Downloadable PNG (phone/desktop) |
| Focus Areas | All (fixed) | User-selectable |
| Mantras | Ruling planet only | Ruling planet + problem area |
| Persistence | None (ephemeral) | Optional (AI opt-in) |

## Dependencies
- `src/lib/astro.ts` - `computeChart()` (single source of truth)
- `src/lib/wallpaper.ts` - `buildWallpaperSvg()` (deterministic renderer)
- `src/content/vedic-mapping.ts` - `presetById()`, `GRAHAS`, `NAKSHATRAS`
- `src/lib/exporter.ts` - `previewFontFaceCss` (embedded fonts)

## Verification
- Same birth details → identical SVG every time (deterministic)
- Different birth details → different nakshatra, lagna, syllable
- No external API calls (works offline)
- Fonts render correctly (Devanagari + Latin)
- Preview navigates to main generator with pre-filled params

## Error Handling
- Missing/invalid birth data → 400 with error message
- Chart computation failure → 500 with error
- SVG generation failure → 500 with error
- All errors surfaced to UI for user feedback

## Rate Limiting
- None (deterministic, no cost)
- Can add client-side debounce if needed