/**
 * Astrology Pipeline - Full Skill-Based Calculation Flow
 * 
 * Implements the deterministic pipeline:
 * 1. KUNDLI_ENGINE - Compute chart with regional adjustments
 * 2. PROBLEM_ANALYZER - Map problem to houses/planets
 * 3. WALLPAPER_CONTEXT - Generate visual parameters
 * 4. IMAGE_PROMPT - Compose NVIDIA prompt
 * 5. NVIDIA_IMAGE - Generate with random seed
 * 6. Internal Report - Generate full Vedic reading
 */

import { type Chart, type BirthInput, vimshottariDasha } from '~/lib/astro';
import { GRAHAS, NAKSHATRAS, RASHIS, type StylePreset } from '~/content/vedic-mapping';
import { LIFE_AREA_PROFILES, lifeAreaProfiles } from '~/content/life-areas';
import { computeRegionalChart, getRegionalNakshatraName, getRegionalDisplayName, type RegionalSystem } from '~/lib/regional-calculations';

// ============================================================
// INTERNAL ASTROLOGY REPORT
// ============================================================

/** Internal astrological report - full Vedic analysis */
export interface InternalAstrologyReport {
  // Core Chart
  lagna: string;
  lagnaLord: string;
  lagnaDegree: number;
  moon: string;
  moonLord: string;
  moonDegree: number;
  sun: string;
  sunLord: string;
  sunDegree: number;
  nakshatra: string;
  pada: number;
  rashiLord: string;
  
  // Ascendant info
  ascendant: string;
  ascendantDegree: number;
  
  // Planetary Positions
  planets: PlanetaryPosition[];
  
  // Dasa System
  dasha: DashaInfo;
  
  // Yogas
  yogas: Yoga[];
  
  // Problem Area Analysis
  problemAnalysis: ProblemAnalysis;
  
  // Regional info
  regional: {
    system: RegionalSystem;
    displayName: string;
    nakshatraName?: string;
    newYearInfo?: { name: string; date: string; month: number };
  };
  
  // Chart notes/caveats
  notes: string[];
  
  // Generated timestamp
  generatedAt: number;
}

export interface PlanetaryPosition {
  name: string;
  sign: string;
  signLord: string;
  house: number;
  degree: number;
  dignity: 'exalted' | 'debilitated' | 'own_sign' | 'friend' | 'enemy' | 'neutral';
  retrograde: boolean;
  nakshatra: string;
  pada: number;
  aspects: string[];
  conjunctions: string[];
  isMalefic: boolean;
  isBenefic: boolean;
}

export interface DashaInfo {
  current?: { lord: string; lordDevanagari: string; start: Date; end: Date; years: number };
  next?: { lord: string; lordDevanagari: string; start: Date; end: Date; years: number };
  balance: { lord: string; lordDevanagari: string; yearsLeft: number };
  periods: { lord: string; lordDevanagari: string; start: Date; end: Date; years: number }[];
  provisionalNotes: string[];
}

export interface Yoga {
  name: string;
  description: string;
  type: 'positive' | 'negative' | 'neutral';
  planets: string[];
}

export interface ProblemAnalysis {
  area: string;
  afflictedPlanets: PlanetaryPosition[];
  afflictedHouses: number[];
  strengthScore: number;  // 0-100
  remedies: Remedy[];
  transitImpact: string;
  currentDashaImpact: string;
}

export interface Remedy {
  type: 'mantra' | 'gemstone' | 'ritual' | 'deity' | 'charity';
  name: string;
  description: string;
  planet?: string;
}

// ============================================================
// DIGNITY CALCULATION
// ============================================================

const EXALTATION_POINTS: Record<string, string> = {
  'Sun': 'Aries', 'Moon': 'Taurus', 'Mars': 'Capricorn',
  'Mercury': 'Virgo', 'Jupiter': 'Cancer', 'Venus': 'Pisces', 'Saturn': 'Libra',
};

const DEBILITATION_POINTS: Record<string, string> = {
  'Sun': 'Libra', 'Moon': 'Scorpio', 'Mars': 'Cancer',
  'Mercury': 'Pisces', 'Jupiter': 'Capricorn', 'Venus': 'Virgo', 'Saturn': 'Aries',
};

const OWN_SIGNS: Record<string, string[]> = {
  'Sun': ['Leo'], 'Moon': ['Cancer'], 'Mars': ['Aries', 'Scorpio'],
  'Mercury': ['Gemini', 'Virgo'], 'Jupiter': ['Sagittarius', 'Pisces'],
  'Venus': ['Taurus', 'Libra'], 'Saturn': ['Capricorn', 'Aquarius'],
  'Rahu': ['Aquarius'], 'Ketu': ['Scorpio'],
};

function calculateDignity(planet: string, sign: string): PlanetaryPosition['dignity'] {
  if (EXALTATION_POINTS[planet] === sign) return 'exalted';
  if (DEBILITATION_POINTS[planet] === sign) return 'debilitated';
  
  const own = OWN_SIGNS[planet];
  if ((own ?? []).includes(sign)) return 'own_sign';
  
  // Friend/enemy/neutral would require more complex calculation
  return 'neutral';
}

function planetDisplayName(key: keyof typeof GRAHAS): string {
  return GRAHAS[key].english;
}

function isMaleficPlanet(planet: string): boolean {
  return ['Sun', 'Mars', 'Saturn', 'Rahu', 'Ketu'].includes(planet);
}

function isBeneficPlanet(planet: string): boolean {
  return ['Jupiter', 'Venus', 'Moon', 'Mercury'].includes(planet);
}

// ============================================================
// YOGA DETECTION
// ============================================================

function detectYogas(chart: Chart): Yoga[] {
  const yogas: Yoga[] = [];
  
  // Sun-Moon conjunction (Sunjanya Yoga)
  if (chart.sunSign === chart.moon.signIndex) {
    yogas.push({
      name: 'Sunjanya Yoga',
      description: 'Sun and Moon together in the same sign - balanced willpower and emotional intelligence',
      type: 'positive',
      planets: ['Sun', 'Moon'],
    });
  }
  
  // Gajakesari (Jupiter aspects Moon from 5th, 7th, 9th, 11th)
  const moonSign = chart.moon.signIndex;
  const jupiterSign = chart.planets.find(p => p.key === 'jupiter')?.signIndex;
  if (jupiterSign !== undefined) {
    const aspects = [(moonSign + 4) % 12, (moonSign + 6) % 12, (moonSign + 8) % 12, (moonSign + 10) % 12];
    if (aspects.includes(jupiterSign)) {
      yogas.push({
        name: 'Gajakesari Yoga',
        description: 'Jupiter aspects the Moon - wisdom, wealth, spiritual growth',
        type: 'positive',
        planets: ['Jupiter', 'Moon'],
      });
    }
  }
  
  // Debilitated planets cause yoga
  chart.planets.forEach(p => {
    const planetName = planetDisplayName(p.key);
    const sign = RASHIS[p.signIndex]?.english ?? 'Unknown';
    if (calculateDignity(planetName, sign) === 'debilitated') {
      yogas.push({
        name: `${planetName} Debilitation Yoga`,
        description: `${planetName} is debilitated - requires remediation through gem/chanting`,
        type: 'negative',
        planets: [planetName],
      });
    }
  });
  
  return yogas;
}

// ============================================================
// REMEDY GENERATION
// ============================================================

function generateRemedies(planet: string): Remedy[] {
  const remedies: Remedy[] = [];
  
  const mantras: Record<string, string> = {
    'Sun': 'Om Suryaya Namaha (108 times daily)',
    'Moon': 'Om Somaya Namaha (108 times daily)',
    'Mars': 'Om Mangalaya Namaha (108 times daily)',
    'Mercury': 'Om Budhaya Namaha (108 times daily)',
    'Jupiter': 'Om Brihaspataye Namaha (108 times daily)',
    'Venus': 'Om Shukraya Namaha (108 times daily)',
    'Saturn': 'Om Shanaye Namaha (108 times daily)',
    'Rahu': 'Om Rahave Namaha (108 times daily)',
    'Ketu': 'Om Ketave Namaha (108 times daily)',
  };
  
  const gemstones: Record<string, string> = {
    'Sun': 'Ruby (Manik)',
    'Moon': 'Pearl (Moti)',
    'Mars': 'Red Coral (Moonga)',
    'Mercury': 'Emerald (Panna)',
    'Jupiter': 'Yellow Sapphire (Pukhraj)',
    'Venus': 'Diamond (Heera)',
    'Saturn': 'Blue Sapphire (Neelam)',
    'Rahu': 'Hessonite (Gomed)',
    'Ketu': 'Cat Eye (Lahsuniya)',
  };
  
  const rituals: Record<string, string> = {
    'Sun': 'Sun Salutation (Surya Namaskar) at sunrise',
    'Moon': 'Chandra mantra jaap during Full Moon',
    'Mars': 'Tuesday fast and Mangal arti',
    'Mercury': 'Wednesday fast and Budh jaap',
    'Jupiter': 'Thursday fast and Brihaspathi mantra',
    'Venus': 'Friday Shukra ban and Tulsi puja',
    'Saturn': 'Saturday Shani ban and Shani mantra',
    'Rahu': 'Rahu Kavach jaap at midnight',
    'Ketu': 'Ketu mantra jaap at sunset',
  };

  const planetDays: Record<string, string> = {
    'Sun': 'Sunday',
    'Moon': 'Monday',
    'Mars': 'Tuesday',
    'Mercury': 'Wednesday',
    'Jupiter': 'Thursday',
    'Venus': 'Friday',
    'Saturn': 'Saturday',
    'Rahu': 'Saturday',
    'Ketu': 'Tuesday',
  };
  
  if (mantras[planet]) {
    remedies.push({ type: 'mantra', name: mantras[planet], description: 'Chant daily for 40 days', planet });
  }
  if (gemstones[planet]) {
    remedies.push({ type: 'gemstone', name: gemstones[planet], description: 'Wear in gold/pancha dhatu ring', planet });
  }
  if (rituals[planet]) {
    remedies.push({ type: 'ritual', name: rituals[planet], description: 'Perform weekly', planet });
  }
  
  remedies.push({ type: 'charity', name: `Donate to ${planet}-related causes`, description: `Donate on ${planetDays[planet]} day`, planet });
  remedies.push({ type: 'deity', name: `Worship ${planet} deity`, description: 'Visit temple and offer prayers', planet });
  
  return remedies;
}

// ============================================================
// PROBLEM ANALYSIS
// ============================================================

function analyzeProblem(chart: Chart, focusAreas: string | readonly string[]): ProblemAnalysis {
  const requestedAreas: readonly string[] = typeof focusAreas === 'string' ? [focusAreas] : focusAreas;
  const profiles = lifeAreaProfiles(requestedAreas);
  const lifeArea = profiles[0] ?? LIFE_AREA_PROFILES.career;
  const selectedAreas = profiles.length > 0 ? profiles : [lifeArea];
  const areaLabel = selectedAreas.map(profile => profile.label).join(', ');
  
  // Find afflicted planets related to problem area
  const afflictedPlanets: PlanetaryPosition[] = [];
  const afflictedHouses: number[] = [];
  
  // Get house numbers for the problem area
  const problemHouses = [...new Set(selectedAreas.flatMap(profile => (
    profile.secondaryHouse ? [profile.house, profile.secondaryHouse] : [profile.house]
  )))];
  
  // Check which planets are in afflicted houses
  chart.planets.forEach(p => {
    const house = chart.houses.findIndex(h => (h.planets ?? []).includes(p.key)) + 1;
    if (problemHouses.includes(house)) {
      const planetName = planetDisplayName(p.key);
      const sign = RASHIS[p.signIndex];
      const dignity = calculateDignity(planetName, sign?.english ?? 'Unknown');
      if (dignity === 'debilitated' || dignity === 'enemy') {
        afflictedPlanets.push({
          name: planetName,
          sign: sign?.name ?? 'Unknown',
          signLord: sign ? GRAHAS[sign.lord]?.english ?? 'Unknown' : 'Unknown',
          house,
          degree: p.degreeInSign,
          dignity,
          retrograde: p.retrograde || false,
          nakshatra: NAKSHATRAS[p.nakshatraIndex]?.name ?? 'Unknown',
          pada: p.pada || 1,
          aspects: [],
          conjunctions: [],
          isMalefic: isMaleficPlanet(planetName),
          isBenefic: isBeneficPlanet(planetName),
        });
        afflictedHouses.push(house);
      }
    }
  });
  
  // Generate remedies for afflicted planets
  const allRemedies: Remedy[] = [];
  afflictedPlanets.forEach(p => {
    allRemedies.push(...generateRemedies(p.name));
  });
  
  // Calculate strength score (simplified)
  const strengthScore = Math.max(20, 100 - (afflictedPlanets.length * 15) - (afflictedHouses.length * 10));
  
  return {
    area: areaLabel,
    afflictedPlanets,
    afflictedHouses: [...new Set(afflictedHouses)],
    strengthScore,
    remedies: allRemedies.slice(0, 5),  // Top 5 remedies
    transitImpact: `Current transits are affecting your ${areaLabel} sector.`,
    currentDashaImpact: `Your current dasa period is influencing ${areaLabel}.`,
  };
}

// ============================================================
// BUILD PLANETARY POSITIONS
// ============================================================

function buildPlanetaryPositions(chart: Chart): PlanetaryPosition[] {
  return chart.planets.map(p => {
    const sign = RASHIS[p.signIndex];
    const planetName = planetDisplayName(p.key);
    return {
      name: planetName,
      sign: sign?.name ?? 'Unknown',
      signLord: sign ? GRAHAS[sign.lord]?.english ?? 'Unknown' : 'Unknown',
      house: chart.houses.findIndex(h => (h.planets ?? []).includes(p.key)) + 1,
      degree: p.degreeInSign || 0,
      dignity: calculateDignity(planetName, sign?.english ?? 'Unknown'),
      retrograde: p.retrograde || false,
      nakshatra: NAKSHATRAS[p.nakshatraIndex]?.name ?? 'Unknown',
      pada: p.pada || 1,
      aspects: [],  // Would need aspect calculation
      conjunctions: [],  // Would need conjunction detection
      isMalefic: isMaleficPlanet(planetName),
      isBenefic: isBeneficPlanet(planetName),
    };
  });
}

// ============================================================
// MAIN PIPELINE FUNCTION
// ============================================================

/**
 * Generate full internal astrology report
 */
export function generateInternalReport(
  input: BirthInput,
  focusAreas: string | readonly string[],
  regional: RegionalSystem
): InternalAstrologyReport {
  // Step 1: KUNDLI_ENGINE - Compute chart with regional adjustments
  const chart = computeRegionalChart(input, regional);
  
  // Build planetary positions
  const planets = buildPlanetaryPositions(chart);
  
  // Detect yogas
  const yogas = detectYogas(chart);
  
// Calculate dasa using engine
  const dasha = vimshottariDasha(chart, 5);
  
  // Analyze problem
  const problemAnalysis = analyzeProblem(chart, focusAreas);
  
  // Get regional info
  const regionalNakshatraName = getRegionalNakshatraName(chart, regional);
  const regionalDisplayName = getRegionalDisplayName(chart);
  const lagnaSign = RASHIS[chart.lagna.signIndex];
  const moonSign = RASHIS[chart.moon.signIndex];
  const sunSign = RASHIS[chart.sunSign];
  const sunPlacement = chart.planets.find(p => p.key === 'sun');
  
  return {
    // Core chart
    lagna: lagnaSign?.name ?? 'Aries',
    lagnaLord: GRAHAS[lagnaSign?.lord ?? 'mars']?.english ?? 'Mars',
    lagnaDegree: chart.lagna.degreeInSign,
    moon: moonSign?.name ?? 'Aries',
    moonLord: GRAHAS[moonSign?.lord ?? 'moon']?.english ?? 'Moon',
    moonDegree: chart.moon.degreeInSign,
    sun: sunSign?.name ?? 'Leo',
    sunLord: GRAHAS[sunSign?.lord ?? 'sun']?.english ?? 'Sun',
    sunDegree: sunPlacement?.degreeInSign ?? 0,
    nakshatra: NAKSHATRAS[chart.moon.nakshatraIndex]?.name ?? chart.moonNakshatra.name ?? 'Unknown',
    pada: chart.moonPada || 1,
    rashiLord: moonSign?.name ?? 'Moon',
    
    ascendant: lagnaSign?.name ?? 'Aries',
    ascendantDegree: chart.lagna.degreeInSign,
    
    // Planetary positions
    planets,
    
    // Dasa
    dasha,
    
    // Yogas
    yogas,
    
    // Problem analysis
    problemAnalysis,
    
    // Regional
    regional: {
      system: regional,
      displayName: regionalDisplayName,
      nakshatraName: regional !== 'vedic' ? regionalNakshatraName : undefined,
      newYearInfo: regional !== 'vedic' ? (() => {
        const names = ['Tamil New Year', 'Poila Boishakh', 'Vishu', 'Ugadi', 'Vikram Samvat', 'Vikram Samvat'];
        const keys = ['tamil', 'bengali', 'malayalam', 'south-indian', 'north-indian'];
        const idx = keys.indexOf(regional);
        const name = idx >= 0 ? names[idx] : 'Vikram Samvat';
        return { name, date: 'Chaitra Shukla 1', month: 3 };
      })() : undefined,
    },
    
    // Notes
    notes: chart.notes || [],
    
    // Timestamp
    generatedAt: Date.now(),
  };
}

/**
 * Generate wallpaper seed (fully random for uniqueness).
 * FLUX needs a positive integer; Math.random() alone is in (0,1) and is wrong.
 */
export function generateRandomSeed(): number {
  const seed = Math.floor(Math.random() * 2147483646) + 1;
  return seed > 0 ? seed : 42;
}

/**
 * Generate unique wallpaper prompt based on chart and problem
 */
export function generateWallpaperPrompt(
  chart: Chart,
  problem: string,
  preset: StylePreset
): string {
  const energy = getEnergyForProblem(problem);
  const chakra = getChakraForNakshatra(chart.moonNakshatra.name);
  const symbols = getSymbolsForPlanets(chart);
  
  // Compose prompt
  const presetName = preset.name.split(' ')[0];  // e.g., "Temple" from "Temple Gold"
  const mood = energy === 'confidence' ? 'ascending' : energy === 'abundance' ? 'serene' : 'dynamic';
  
  return `${presetName} Vedic cosmic wallpaper, ${energy} energy, divine ${chakra} motif, sacred ${symbols.join(' and ')} motifs, ${chakra} chakra activation, celestial ${mood} atmosphere, ultra detailed, 4K, cinematic lighting, Indian spiritual aesthetics, premium design, no text, no letters, no watermark, no lettering, no caption`;
}

function getEnergyForProblem(problem: string): string {
  const map: Record<string, string> = {
    career: 'ascending',
    wealth: 'abundance',
    relationships: 'union',
    health: 'vitality',
    education: 'learning',
    spiritual: 'stillness',
    protection: 'shielding',
    family: 'hearth',
  };
  return map[problem] || 'ascending';
}

function getChakraForNakshatra(nakshatra: string): string {
  const index = NAKSHATRAS.findIndex(n => n.name === nakshatra);
  const chakraMap = ['muladhara', 'svadhisthana', 'manipura', 'anahata', 'vishuddha', 'ajna', 'ajna', 'vishuddha', 'svadhisthana', 'manipura', 'anahata', 'vishuddha', 'vishuddha', 'ajna', 'ajna', 'anahata', 'manipura', 'svadhisthana', 'svadhisthana', 'muladhara', 'muladhara', 'vishuddha', 'ajna', 'ajna', 'muladhara', 'muladhara', 'muladhara'];
  return chakraMap[index] || 'ajna';
}

function getSymbolsForPlanets(chart: Chart): string[] {
  const symbols: string[] = [];
  const moonSign = RASHIS[chart.moon.signIndex]?.english ?? '';
  
  // Moon sign based symbols
  const moonSymbols: Record<string, string[]> = {
    Aries: ['ram', 'skull'],
    Taurus: ['bull', 'diamond'],
    Gemini: ['birds', 'air'],
    Cancer: ['crab', 'water'],
    Leo: ['lion', 'sun'],
    Virgo: ['maiden', 'wheat'],
    Libra: ['balance', 'scales'],
    Scorpio: ['scorpion', 'serpent'],
    Sagittarius: ['archer', 'horse'],
    Capricorn: ['mountain', 'sea'],
    Aquarius: ['water bearer', 'eagle'],
    Pisces: ['fish', 'ocean'],
  };
  
  symbols.push(...(moonSymbols[moonSign] || ['sacred']));
  
  // Add ruling planet symbol
  const rulingPlanet = GRAHAS[chart.moonNakshatra.lord]?.english ?? 'Ketu';
  
  const planetSymbols: Record<string, string> = {
    Sun: 'sun',
    Moon: 'moon',
    Mars: 'ram',
    Mercury: 'parrot',
    Jupiter: 'eagle',
    Venus: 'swAn',
    Saturn: 'crow',
    Rahu: 'serpent',
    Ketu: 'tiger',
  };
  
  symbols.push(planetSymbols[rulingPlanet] || 'sacred');
  
  return symbols;
}






