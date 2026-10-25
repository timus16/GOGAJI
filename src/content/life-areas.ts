/**
 * ============================================================================
 * LIFE-AREA PROFILES - the classical bhava layer
 * ============================================================================
 * A "life area" is the classical name for one sphere of life, and each one is
 * governed by a specific bhava (house) in the whole-sign scheme the chart
 * engine already uses (lagna sign = house 1, see `src/lib/astro.ts`).
 *
 * This table is pure DATA:
 *  - the bhava a life area governs (and, where the tradition gives a second
 *    seat, its secondary house),
 *  - the classical Sanskrit name of that bhava,
 *  - a restrained colour identity for the area,
 *  - a simple geometric emblem (NOT a nakshatra motif - the nakshatra motif
 *    belongs to the chart, the emblem belongs to the querent's question),
 *  - one line naming the classical theme of the area.
 *
 * NOTHING here computes a planetary position: the renderer reads the planets
 * that are ACTUALLY in the highlighted house from `chart.houses`, so a focus
 * band can never state a fact the engine did not produce.
 */

import type { LifeArea } from "~/content/problems";

/** The geometric emblem keys the renderer knows how to draw. */
export type EmblemKey =
  | "coin"
  | "rings"
  | "ladder"
  | "shield"
  | "lamp"
  | "lotus-heart"
  | "hearth"
  | "ascending-path";

export interface LifeAreaProfile {
  /** the machine key, e.g. "wealth" */
  area: LifeArea;
  /** the human name used in the UI */
  label: string;
  /** the classical Sanskrit name of the area */
  sanskrit: string;
  /** the primary whole-sign house (1..12) this area governs */
  house: number;
  /** the secondary whole-sign house, where the tradition gives one */
  secondaryHouse?: number;
  /** the house in the HOUSE_WORDS scheme, e.g. "2nd (dhana)" */
  houseName: string;
  /** the area's identity colour (mid tone) */
  accent: string;
  /** the area's identity colour (deep tone, for light grounds) */
  deep: string;
  /** the area's identity colour (glow tone) */
  glow: string;
  /** the geometric emblem key */
  emblem: EmblemKey;
  /** one short line naming the classical theme */
  theme: string;
}

/** The twelve bhavas, in house order - the same words as HOUSE_WORDS. */
const HOUSE_ORDINALS = [
  "1st", "2nd", "3rd", "4th", "5th", "6th",
  "7th", "8th", "9th", "10th", "11th", "12th",
];

const HOUSE_BHAVA = [
  "lagna", "dhana", "sahaja", "sukha", "putra", "ari",
  "yuvati", "randhra", "dharma", "karma", "labha", "vyaya",
];

/** The classical name of a bhava, e.g. 2 -> "dhana". */
export const houseBhavaName = (house: number): string => HOUSE_BHAVA[house - 1] ?? "";

/** A house in the HOUSE_WORDS scheme, e.g. 2 -> "2nd (dhana)". */
export const houseDisplayName = (house: number): string =>
  `${HOUSE_ORDINALS[house - 1] ?? String(house)} (${HOUSE_BHAVA[house - 1] ?? ""})`;

export const LIFE_AREA_PROFILES: Record<LifeArea, LifeAreaProfile> = {
  career: {
    area: "career",
    label: "Career & work",
    sanskrit: "Karma",
    house: 10,
    houseName: houseDisplayName(10),
    accent: "#e0733a",
    deep: "#2a160c",
    glow: "#f8c294",
    emblem: "ascending-path",
    theme: "Work, recognition and the 10th house of karma",
  },
  wealth: {
    area: "wealth",
    label: "Wealth & finances",
    sanskrit: "Dhana",
    house: 2,
    houseName: houseDisplayName(2),
    accent: "#c8b23c",
    deep: "#26220b",
    glow: "#f2e79b",
    emblem: "coin",
    theme: "Provision, steadiness and the 2nd house of accumulation",
  },
  relationships: {
    area: "relationships",
    label: "Relationships",
    sanskrit: "Yuvati",
    house: 7,
    houseName: houseDisplayName(7),
    accent: "#cf6f96",
    deep: "#2a1420",
    glow: "#f6c2d8",
    emblem: "rings",
    theme: "Partnership, exchange and the 7th house of yuvati",
  },
  health: {
    area: "health",
    label: "Health & vitality",
    sanskrit: "Arogya",
    house: 1,
    secondaryHouse: 6,
    houseName: houseDisplayName(1),
    accent: "#3fb2a0",
    deep: "#0d211d",
    glow: "#b6ebdd",
    emblem: "lamp",
    theme: "Vitality, resilience and the 1st house of the body",
  },
  education: {
    area: "education",
    label: "Education & study",
    sanskrit: "Vidya",
    house: 4,
    secondaryHouse: 9,
    houseName: houseDisplayName(4),
    accent: "#5f9fe0",
    deep: "#101c2e",
    glow: "#c6dcf7",
    emblem: "ladder",
    theme: "Learning, training and the 4th house of sukha",
  },
  spiritual: {
    area: "spiritual",
    label: "Spiritual growth",
    sanskrit: "Dharma",
    house: 9,
    secondaryHouse: 7,
    houseName: houseDisplayName(9),
    accent: "#a585d4",
    deep: "#1d1629",
    glow: "#ddd0f5",
    emblem: "lotus-heart",
    theme: "Faith, teachers and the 9th house of dharma",
  },
  protection: {
    area: "protection",
    label: "Protection",
    sanskrit: "Raksha",
    house: 8,
    secondaryHouse: 12,
    houseName: houseDisplayName(8),
    accent: "#8e93a8",
    deep: "#14161f",
    glow: "#d2d8e6",
    emblem: "shield",
    theme: "Resilience, boundaries and the 8th house of randhra",
  },
  family: {
    area: "family",
    label: "Family & home",
    sanskrit: "Sukha",
    house: 4,
    secondaryHouse: 10,
    houseName: houseDisplayName(4),
    accent: "#7fa23f",
    deep: "#1c2410",
    glow: "#d8e8b4",
    emblem: "hearth",
    theme: "Roots, home and the 4th house of sukha",
  },
};

/**
 * The profiles for a list of area keys.
 *
 * Unknown keys are ignored, duplicates are dropped, and the caller's order is
 * preserved - the first area is the poster's dominant focus.
 */
export function lifeAreaProfiles(areas: readonly string[]): LifeAreaProfile[] {
  const out: LifeAreaProfile[] = [];
  const seen = new Set<string>();
  for (const raw of areas) {
    if (typeof raw !== "string") continue;
    const key = raw.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    const profile = (LIFE_AREA_PROFILES as Record<string, LifeAreaProfile | undefined>)[key];
    if (!profile) continue;
    seen.add(key);
    out.push(profile);
  }
  return out;
}