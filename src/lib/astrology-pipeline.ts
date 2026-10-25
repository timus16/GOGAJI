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

import { computeChart, type Chart, type BirthInput, dms } from '~/lib/astro';
import { assessChart, chartFactSheet, type BirthChartConditions, LIFE_AREAS } from '~/content/problems';
import { presetById, type StylePreset } from '~/content/vedic-mapping';
import { computeRegionalChart, getRegionalNakshatraName, getRegionalDisplayName, type RegionalSystem } from '~/lib/regional-calculations';
import { vimshottariDasha } from '~/lib/astro';

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
  current: string;
  currentLord: string;
  antardasha: string;
  pratyantardasha: string;
  balance: string;  // "2 years 6 months remaining"
  next: string;
  nextLord: string;
  allDashas: { planet: string; startAge: number; endAge: number }[];
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

function calculateDignity(planet: string, sign: string, chart: Chart): string {
  if (EXALTATION_POINTS[planet] === sign) return 'exalted';
  if (DEBILITATION_POINTS[planet] === sign) return 'debilitated';
  
  const own = OWN_SIGNS[planet];
  if (own && own.includes(sign)) return 'own_sign';
  
  // Friend/enemy/neutral would require more complex calculation
  return 'neutral';
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
  if (chart.sun.signIndex === chart.moon.signIndex) {
    yogas.push({
      name: 'Sunjanya Yoga',
      description: 'Sun and Moon together in the same sign - balanced willpower and emotional intelligence',
      type: 'positive',
      planets: ['Sun', 'Moon'],
    });
  }
  
  // Gajakesari (Jupiter aspects Moon from 5th, 7th, 9th, 11th)
  const moonSign = chart.moon.signIndex;
  const jupiterSign = chart.planets.find(p => p.key === 'Jupiter')?.signIndex;
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
    if (calculateDignity(p.key, p.signIndex === undefined ? '' : ['', 'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'][p.signIndex], chart) === 'debilitated') {
      yogas.push({
        name: `\${p.key} Debilitation Yoga`,
        description: `\${p.key} is debilitated - requires remediation through gem/chanting`,
        type: 'negative',
        planets: [p.key],
      });
    }
  });
  
  return yogas;
}

// ============================================================
// REMEDY GENERATION
// ============================================================

function generateRemedies(planet: string, type: string): Remedy[] {
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

function analyzeProblem(chart: Chart, conditions: BirthChartConditions, problem: string): ProblemAnalysis {
  const lifeArea = LIFE_AREAS.find(la => la.id === problem) || LIFE_AREAS[0];
  
  // Find afflicted planets related to problem area
  const afflictedPlanets: PlanetaryPosition[] = [];
  const afflictedHouses: number[] = [];
  
  // Get house numbers for the problem area
  const problemHouses = lifeArea.houses;
  
  // Check which planets are in afflicted houses
  chart.planets.forEach(p => {
    const house = p.house;
    if (problemHouses.includes(house)) {
      const dignity = calculateDignity(p.key, p.signIndex === undefined ? '' : ['', 'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'][p.signIndex], chart);
      if (dignity === 'debilitated' || dignity === 'enemy') {
        afflictedPlanets.push({
          name: p.key,
          sign: p.signIndex === undefined ? 'Unknown' : ['', 'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'][p.signIndex],
          signLord: ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu', 'Ketu', 'Rahu', 'Sun'][p.signIndex || 0],
          house,
          degree: p.degreeInSign,
          dignity,
          retrograde: p.retrograde || false,
          nakshatra: p.nakshatraIndex !== undefined ? ['Ashwini', 'Bharani', 'Kritika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishtha', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'][p.nakshatraIndex] : 'Unknown',
          pada: p.pada || 1,
          aspects: [],
          conjunctions: [],
          isMalefic: isMaleficPlanet(p.key),
          isBenefic: isBeneficPlanet(p.key),
        });
        afflictedHouses.push(house);
      }
    }
  });
  
  // Generate remedies for afflicted planets
  const allRemedies: Remedy[] = [];
  afflictedPlanets.forEach(p => {
    allRemedies.push(...generateRemedies(p.name, problem));
  });
  
  // Calculate strength score (simplified)
  const strengthScore = Math.max(20, 100 - (afflictedPlanets.length * 15) - (afflictedHouses.length * 10));
  
  return {
    area: lifeArea.name,
    afflictedPlanets,
    afflictedHouses: [...new Set(afflictedHouses)],
    strengthScore,
    remedies: allRemedies.slice(0, 5),  // Top 5 remedies
    transitImpact: `Current transits are affecting your ${lifeArea.name} sector.`,
    currentDashaImpact: `Your current dasa period is influencing ${lifeArea.name}.`,
  };
}

// ============================================================
// DASHA CALCULATION
// ============================================================

function calculateDasha(chart: Chart): DashaInfo {
  try {
    const dashas = vimshottariDasha(chart, 5);
    if (dashas && dashas.length > 0) {
      const current = dashas[0];
      const next = dashas[1] || { planet: 'Jupiter', startAge: 0, endAge: 0 };
      
      return {
        current: current.planet,
        currentLord: current.planet,
        antardasha: 'Current antar',  // Would need deeper calculation
        pratyantardasha: 'Current pratyantar',
        balance: `${Math.round((current.endAge - current.startAge) * 12)} months remaining`,
        next: next.planet,
        nextLord: next.planet,
        allDashas: dashas.slice(0, 12).map(d => ({
          planet: d.planet,
          startAge: d.startAge,
          endAge: d.endAge,
        })),
      };
    }
  } catch {
    // Fallback
  }
  
  return {
    current: chart.rulingPlanet || 'Jupiter',
    currentLord: chart.rulingPlanet || 'Jupiter',
    antardasha: 'Unknown',
    pratyantardasha: 'Unknown',
    balance: 'Unknown',
    next: 'Unknown',
    nextLord: 'Unknown',
    allDashas: [],
  };
}

// ============================================================
// BUILD PLANETARY POSITIONS
// ============================================================

const RASHI_NAMES = ['', 'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const GRAHA_LORDS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
const NAKSHATRA_NAMES = ['Ashwini', 'Bharani', 'Kritika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishtha', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];

function buildPlanetaryPositions(chart: Chart): PlanetaryPosition[] {
  return chart.planets.map(p => {
    const sign = p.signIndex !== undefined ? RASHI_NAMES[p.signIndex] : 'Unknown';
    return {
      name: p.key,
      sign,
      signLord: GRAHA_LORDS[p.signIndex || 0] || 'Unknown',
      house: p.house || 1,
      degree: p.degreeInSign || 0,
      dignity: calculateDignity(p.key, sign, chart),
      retrograde: p.retrograde || false,
      nakshatra: p.nakshatraIndex !== undefined ? NAKSHATRA_NAMES[p.nakshatraIndex] : 'Unknown',
      pada: p.pada || 1,
      aspects: [],  // Would need aspect calculation
      conjunctions: [],  // Would need conjunction detection
      isMalefic: isMaleficPlanet(p.key),
      isBenefic: isBeneficPlanet(p.key),
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
  problem: string,
  regional: RegionalSystem
): InternalAstrologyReport {
  // Step 1: KUNDLI_ENGINE - Compute chart with regional adjustments
  const chart = computeRegionalChart(input, regional);
  
  // Step 2: Assess chart conditions
  const conditions = assessChart(chart);
  
  // Build planetary positions
  const planets = buildPlanetaryPositions(chart);
  
  // Detect yogas
  const yogas = detectYogas(chart);
  
  // Calculate dasa
  const dasha = calculateDasha(chart);
  
  // Analyze problem
  const problemAnalysis = analyzeProblem(chart, conditions, problem);
  
  // Get regional info
  const regionalNakshatraName = getRegionalNakshatraName(chart, regional);
  const regionalDisplayName = getRegionalDisplayName(chart);
  
  return {
    // Core chart
    lagna: RASHI_NAMES[chart.lagna.signIndex] || 'Aries',
    lagnaLord: GRAHA_LORDS[chart.lagna.signIndex] || 'Mars',
    lagnaDegree: chart.lagna.degreeInSign,
    moon: RASHI_NAMES[chart.moon.signIndex] || 'Aries',
    moonLord: GRAHA_LORDS[chart.moon.signIndex] || 'Moon',
    moonDegree: chart.moon.degreeInSign,
    sun: RASHI_NAMES[chart.sun.signIndex] || 'Leo',
    sunLord: GRAHA_LORDS[chart.sun.signIndex] || 'Sun',
    sunDegree: chart.sun.degreeInSign,
    nakshatra: chart.moonNakshatra || 'Unknown',
    pada: chart.moonPada || 1,
    rashiLord: chart.moonSign || 'Moon',
    
    ascendant: RASHI_NAMES[chart.lagna.signIndex] || 'Aries',
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
  preset: StylePreset,
  regional: RegionalSystem
): string {
  const energy = getEnergyForProblem(problem);
  const chakra = getChakraForNakshatra(chart.moonNakshatra);
  const symbols = getSymbolsForPlanets(chart);
  
  // Compose prompt
  const presetName = preset.name.split(' ')[0];  // e.g., "Temple" from "Temple Gold"
  const mood = energy === 'confidence' ? 'ascending' : energy === 'abundance' ? 'serene' : 'dynamic';
  
  return `${presetName} Vedic cosmic wallpaper, ${energy} energy, divine ${chakra} motif, sacred ${chakra} chakra activation, celestial ${mood} atmosphere, ultra detailed, 4K, cinematic lighting, Indian spiritual aesthetics, premium design, no text, no letters, no watermark, no lettering, no caption`;
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
  const index = NAKSHATRA_NAMES.indexOf(nakshatra);
  const chakraMap = ['muladhara', 'svadhisthana', 'manipura', 'anahata', 'vishuddha', 'ajna', 'ajna', 'vishuddha', 'svadhisthana', 'manipura', 'anahata', 'vishuddha', 'vishuddha', 'ajna', 'ajna', 'anahata', 'manipura', 'svadhisthana', 'svadhisthana', 'muladhara', 'muladhara', 'vishuddha', 'ajna', 'ajna', 'muladhara', 'muladhara', 'muladhara'];
  return chakraMap[index] || 'ajna';
}

function getSymbolsForPlanets(chart: Chart): string[] {
  const symbols: string[] = [];
  const moonSign = RASHI_NAMES[chart.moon.signIndex];
  
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
  const nakshatraIndex = NAKSHATRA_NAMES.indexOf(chart.moonNakshatra);
  const rulingPlanets = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
  const rulingPlanet = rulingPlanets[Math.floor(nakshatraIndex / 3)];
  
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
