---
name: agents-context
description: Context for AI agents about GOGAJI wallpaper generation requirements - regional calculations, full Vedic readings, unique wallpapers. Read this before any wallpaper/generation work.
version: 1.0
---

# GOGAJI Wallpaper Generation - Agent Context

## Current Requirements (Updated)

### 1. Unique Wallpapers (Fully Random)

**Requirement:** Every wallpaper must be UNIQUE even for the same birth details.

**Implementation:**
- Seed = `random()` - new random seed every time
- Never reuse seeds
- Same birth details + different seed = completely different artwork
- User can regenerate for same chart to get new artwork

### 2. Full Vedic Reading

**Requirement:** Generate a comprehensive internal astrological report for the user.

**Report must include:**
- **Chart Summary:** Lagna, Moon sign, Sun sign, Nakshatra, Pada
- **Planetary Positions:** All 9 planets with sign, house, dignity (exalted/debilitated/own sign/etc), retrograde status
- **Daśā System:** Current Vimśottarī daśā + antardaśā + pratyantardaśā
- **Aspect Analysis:** Planetary aspects (special attention to problem area)
- **Yoga Formation:** Major planetary combinations (positive and negative)
- **Problem Area Analysis:** Specific to the user's selected problem (career/wealth/health/etc)
- **Remedies:** Mantras, gemstones, rituals based on afflicted planets
- **Transits:** Current planetary transits affecting the problem area
- **Regional Calculation:** Based on user's selected regional system

### 3. Regional Calculation Systems

**Supported Systems (User selects one):**

| System | Region | House System | Key Difference |
|--------|--------|--------------|-----------------|
| `vedic` | Standard (North/South India) | Whole-sign | Lāhiri ayanāṃśa, Vimśottarī daśā |
| `tamil` | Tamil Nadu | Equal | Different planetary strengths, Tamil new year |
| `bengali` | Bengal/Odisha | Whole-sign | Bengali calendar, different daśā balance |
| `malayalam` | Kerala | Whole-sign | Malayalam new year (Virś ṛṣi), Manmatha nakshatra |
| `north-indian` | North India | Whole-sign | KP style, different ascendant calculation |
| `south-indian` | Karnataka/Tamil Nadu | Whole-sign | Sputa daśā, different planetary significations |

**Regional Calculation Flow:
```
User selects regional system
    ↓
Apply regional ayanāṃśa (may differ from Lāhiri)
    ↓
Apply regional house system
    ↓
Apply regional daśā calculation (if different)
    ↓
Generate regional-specific wallpaper with native motifs
```

### 4. Internal Report Generation

**The internal report is:**
- Generated server-side using the full pipeline
- Displayed to user as "Your Vedic Reading"
- NOT the same as the AI-generated artistic reading
- Contains technical astrological data

**Report Structure:
```typescript
interface InternalAstrologyReport {
  // Core Chart
  lagna: string;
  moon: string;
  sun: string;
  ascendant: string;
  nakshatra: string;
  pada: number;
  rashiLord: string;
  
  // Planetary Details
  planets: {
    [planet: string]: {
      sign: string;
      house: number;
      degree: number;
      dignity: 'exalted' | 'debilitated' | 'own_sign' | 'friend' | 'enemy' | 'neutral';
      retrograde: boolean;
      aspects: string[];
      conjunctions: string[];
    }
  };
  
  // Daśā System
  dasha: {
    current: string;      // Current mahādaśā
    antardasha: string;   // Current antar-daśā
    pratyantardasha: string; // Current pratyantar
    balance: string;      // Daśā balance in years/months
    next: string;         // Next mahādaśā
  };
  
  // Yogas
  yogas: {
    name: string;
    description: string;
    type: 'positive' | 'negative' | 'neutral';
  }[];
  
  // Problem Area Analysis
  problemAnalysis: {
    area: string;
    afflictedPlanets: string[];
    afflictedHouses: number[];
    remedies: {
      mantra: string;
      gemstone: string;
      ritual: string;
      deity: string;
    }[];
    transitImpact: string;
  };
  
  // Regional Variations
  regional: {
    system: string;
    regionalLagna?: string;  // If different from standard
    regionalNakshatra?: string;  // If different naming
    regionalNewYear?: string;  // Regional new year date
  };
  
  // Generated timestamp
  generatedAt: number;
}
```

## Pipeline Implementation

### Required Files to Modify/Create

1. **`src/lib/regional-calculations.ts`** - Regional calculation differences
2. **`src/lib/astrology-pipeline.ts`** - Full pipeline with report generation
3. **`src/components/Generator.tsx`** - Updated UI with regional selector

### Existing Files (Do NOT modify core logic)

- `src/lib/astro.ts` - Base chart engine (Lāhiri, Meeus/JPL)
- `src/content/problems.ts` - Problem-area conditions
- `src/content/vedic-mapping.ts` - Vedic data (nakshatras, grahas, rashis)
- `src/lib/gemini.ts` - AI reading generation
- `src/lib/nvidia.ts` - AI image generation
- `src/server/ai.ts` - Server function orchestration

## Key Implementation Notes

### Unique Wallpaper
```typescript
// In wallpaper generation
const seed = Math.random();  // NEW: Fully random
// OR
const seed = crypto.randomUUID();  // Alternative
```

### Regional Selection UI
```tsx
// In Generator.tsx
<select name="regionalSystem">
  <option value="vedic">Standard Vedic (All India)</option>
  <option value="tamil">Tamil Jathaka</option>
  <option value="bengali">Bengali</option>
  <option value="malayalam">Malayalam (Manmatha)</option>
  <option value="north-indian">North Indian (KP)</option>
  <option value="south-indian">South Indian</option>
</select>
```

### Report Generation
```typescript
// New server function
async function generateFullReport(birthDetails: BirthInput, problem: string, regional: string): Promise<InternalAstrologyReport>
```

## AI Agent Instructions

When generating wallpapers or readings:

1. **Use fully random seed** - Never reuse
2. **Apply regional calculations** if user selected a specific region
3. **Generate internal report** - Technical astrology, not AI artistic reading
4. **Display report** - Show user their full Vedic analysis
5. **Never reuse previous results** - Each submission = new wallpaper

## Verification

```bash
# Test unique wallpapers
# Same birth details, 3 generations should produce 3 different images

# Test regional calculations
# Same birth details with different regional systems should produce different charts
```

## Degradation

If AI generation fails:
1. Show internal report (always works - it's deterministic)
2. Show deterministic SVG wallpaper (always works)
3. Show calm amber error message