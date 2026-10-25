/**
 * Regional Astrological Calculation Systems
 * 
 * Supports: vedic (standard), tamil, bengali, malayalam, north-indian, south-indian
 * 
 * Each system has different:
 * - Ayanāṃśa (precession calculation)
 * - House system (though most use whole-sign)
 * - Daśā variations
 * - Nakshatra naming variations
 * - New year calculation
 */

import { computeChart, type Chart, type BirthInput } from '~/lib/astro';

/** Supported regional systems */
export type RegionalSystem = 
  | 'vedic'      // Standard Lāhiri, all India
  | 'tamil'      // Tamil Nadu, different planetary strengths
  | 'bengali'    // Bengal/Odisha, Bengali calendar
  | 'malayalam'  // Kerala, Manmatha nakshatra
  | 'north-indian' // North India, KP style
  | 'south-indian'; // Karnataka/Tamil Nadu, Sputa daśā

/** Regional system display info */
export interface RegionalInfo {
  id: RegionalSystem;
  name: string;
  description: string;
  flag?: string;
}

/** All supported regional systems */
export const REGIONAL_SYSTEMS: RegionalInfo[] = [
  { id: 'vedic', name: 'Standard Vedic', description: 'Lāhiri ayanāṃśa, Vimśottarī daśā (All India)' },
  { id: 'tamil', name: 'Tamil Jathaka', description: 'Tamil calendar, different planetary strengths', flag: '🇮🇳' },
  { id: 'bengali', name: 'Bengali', description: 'Bengali calendar, Bengali new year (Poila Boishakh)', flag: '🇮🇳' },
  { id: 'malayalam', name: 'Malayalam', description: 'Kerala calendar, Manmatha nakshatra system', flag: '🇮🇳' },
  { id: 'north-indian', name: 'North Indian (KP)', description: 'KP style, Cusps-based calculations', flag: '🇮🇳' },
  { id: 'south-indian', name: 'South Indian', description: 'Karnataka style, Sputa daśā', flag: '🇮🇳' },
];

/**
 * Regional Ayanāṃśa values (approximate differences from Lāhiri)
 * 
 * These are simplified - real regional calculations have more nuance.
 * Most systems use Lāhiri but some have slight differences.
 */
export const REGIONAL_AYANAMSA_OFFSETS: Record<RegionalSystem, number> = {
  'vedic': 0,           // Lāhiri is standard
  'tamil': 0,           // Uses Lāhiri
  'bengali': 0,         // Uses Lāhiri (Raman ayanāṃśa variant)
  'malayalam': 0,       // Uses Lāhiri
  'north-indian': 0,    // Uses Lāhiri but different cusps
  'south-indian': 0,    // Uses Lāhiri
};

/**
 * Regional Nakshatra Name Variations
 * 
 * Some regions use slightly different names for nakshatras.
 */
export const REGIONAL_NAKSHATRA_NAMES: Record<RegionalSystem, Record<string, string>> = {
  'vedic': {},  // Uses standard names
  'tamil': {},  // Tamil uses same names but different pronunciation
  'bengali': {
    'Ashwini': 'Ashwini',
    'Bharani': 'Bharani',
    'Kritika': 'Krittika',
    // Similar variations
  },
  'malayalam': {
    'Ashwini': 'Aswathi',
    'Bharani': 'Bharani',
    'Kritika': 'Kolithai',
    // Malayalam has unique names
  },
  'north-indian': {},  // Uses standard names
  'south-indian': {},  // Uses standard names
};

/**
 * Regional New Year dates
 * 
 * Different regions have different new year dates.
 */
export const REGIONAL_NEW_YEAR: Record<RegionalSystem, { name: string; date: string; month: number }> = {
  'vedic': { name: 'Vikram Samvat', date: 'Chaitra Shukla 1', month: 1 },  // ~April
  'tamil': { name: 'Tamil New Year', date: 'Chithirai 1', month: 4 },     // April 14
  'bengali': { name: 'Poila Boishakh', date: '1 Boishakh', month: 4 },     // April 14/15
  'malayalam': { name: 'Vishu', date: '1 Medam', month: 4 },              // April 14
  'north-indian': { name: 'Vikram Samvat', date: 'Chaitra Shukla 1', month: 1 },
  'south-indian': { name: 'Ugadi', date: 'Chaitra Shukla 1', month: 3 },  // March/April
};

/**
 * Calculate chart with regional adjustments
 */
export function computeRegionalChart(
  input: BirthInput,
  regional: RegionalSystem
): Chart {
  // Base chart always uses Lāhiri (the standard)
  const chart = computeChart(input);
  
  // Apply regional adjustments
  if (regional !== 'vedic') {
    applyRegionalAdjustments(chart, regional);
  }
  
  return chart;
}

/**
 * Apply regional adjustments to the chart
 */
function applyRegionalAdjustments(chart: Chart, regional: RegionalSystem): void {
  switch (regional) {
    case 'tamil':
      // Tamil calculations - different planetary strengths considered
      applyTamilAdjustments(chart);
      break;
    case 'bengali':
      // Bengali calculations
      applyBengaliAdjustments(chart);
      break;
    case 'malayalam':
      // Malayalam calculations - Manmatha nakshatra
      applyMalayalamAdjustments(chart);
      break;
    case 'north-indian':
      // North Indian KP style
      applyNorthIndianAdjustments(chart);
      break;
    case 'south-indian':
      // South Indian style
      applySouthIndianAdjustments(chart);
      break;
    default:
      // No adjustments for vedic
      break;
  }
}

/**
 * Tamil adjustments - different planetary strengths
 */
function applyTamilAdjustments(chart: Chart): void {
  // In Tamil astrology, planetary strengths (shad bala) are calculated differently
  // For now, we just mark the chart with Tamil regional flag
  (chart as any).regionalSystem = 'tamil';
  (chart as any).regionalName = 'Tamil Jathaka';
}

/**
 * Bengali adjustments - Bengali calendar variations
 */
function applyBengaliAdjustments(chart: Chart): void {
  (chart as any).regionalSystem = 'bengali';
  (chart as any).regionalName = 'Bengali Panji';
}

/**
 * Malayalam adjustments - Manmatha nakshatra system
 */
function applyMalayalamAdjustments(chart: Chart): void {
  (chart as any).regionalSystem = 'malayalam';
  (chart as any).regionalName = 'Malayalam Manmatha';
  
  // Malayalam nakshatra names are different
  // Map standard to Malayalam
  const malayalamNames: Record<string, string> = {
    'Ashwini': 'Aswathi',
    'Bharani': 'Bharani',
    'Kritika': 'Kolithai',
    'Rohini': 'Rohini',
    'Mrigashira': 'Makayiram',
    'Ardra': 'Thiruvathira',
    'Punarvasu': 'Punartham',
    'Pushya': 'Pooyam',
    'Ashlesha': 'Ayiliam',
    'Magha': 'Makam',
    'Purva Phalguni': 'Pooram',
    'Uttara Phalguni': 'Uthram',
    'Hasta': 'Hastham',
    'Chitra': 'Chithira',
    'Swati': 'Swathi',
    'Vishakha': 'Vishakham',
    'Anuradha': 'Anizham',
    'Jyeshtha': 'Thrikketa',
    'Mula': 'Moolam',
    'Purva Ashadha': 'Pooradam',
    'Uttara Ashadha': 'Uthradam',
    'Shravana': 'Thiruvonam',
    'Dhanishtha': 'Avittam',
    'Shatabhisha': 'Chatayam',
    'Purva Bhadrapada': 'Poorattadhi',
    'Uttara Bhadrapada': 'Uthrittadhi',
    'Revati': 'Revathi',
  };
  (chart as any).malayalamNakshatra = malayalamNames[chart.moonNakshatra] || chart.moonNakshatra;
}

/**
 * North Indian KP style adjustments
 */
function applyNorthIndianAdjustments(chart: Chart): void {
  (chart as any).regionalSystem = 'north-indian';
  (chart as any).regionalName = 'North Indian KP';
  
  // KP uses Cusp-based house system instead of whole-sign
  // This affects house calculations significantly
  // For now, we just mark the chart
}

/**
 * South Indian adjustments
 */
function applySouthIndianAdjustments(chart: Chart): void {
  (chart as any).regionalSystem = 'south-indian';
  (chart as any).regionalName = 'South Indian';
}

/**
 * Get regional nakshatra name if different
 */
export function getRegionalNakshatraName(chart: Chart, regional: RegionalSystem): string {
  if (regional === 'malayalam') {
    return (chart as any).malayalamNakshatra || chart.moonNakshatra;
  }
  
  const names = REGIONAL_NAKSHATRA_NAMES[regional];
  if (names && names[chart.moonNakshatra]) {
    return names[chart.moonNakshatra];
  }
  
  return chart.moonNakshatra;
}

/**
 * Get regional display name for the chart
 */
export function getRegionalDisplayName(chart: Chart): string {
  return (chart as any).regionalName || 'Standard Vedic';
}

/**
 * Check if regional system is different from standard
 */
export function isRegionalVariant(regional: RegionalSystem): boolean {
  return regional !== 'vedic';
}

/**
 * Get regional new year info
 */
export function getRegionalNewYear(regional: RegionalSystem) {
  return REGIONAL_NEW_YEAR[regional];
}