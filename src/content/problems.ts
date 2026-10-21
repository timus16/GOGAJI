/**
 * ============================================================================
 * PROVISIONAL PROBLEM-SET LAYER — PENDING JYOTISH REVIEW
 * ============================================================================
 * This is the domain layer that keeps a reading HONEST. The language model is
 * never asked to look at a chart: it is handed the compact fact sheet built
 * here, plus the list of conditions that were DETECTED in the chart, and it is
 * told to reason only from those facts. That is what stops the reading from
 * drifting into invented planetary positions.
 *
 * Everything below is deterministic, classical and checkable:
 *  - Whole-sign houses (rāśi = bhāva), the lagna sign being house 1 — the
 *    same convention as `src/lib/astro.ts`.
 *  - Exaltation (uccha) and debilitation (nīca) from the standard Parāśarī
 *    table; debilitation is taken as the sign opposite the exaltation.
 *  - Own signs (svakṣetra) and mūlatrikona from the same table.
 *  - Natural benefics (Jupiter, Venus, Mercury, and the waxing Moon) and
 *    natural malefics (Saturn, Mars, Rāhu, Ketu, and the Sun).
 *  - Maṅgala doṣa: Mars in the 1st, 4th, 7th, 8th or 12th house.
 *  - Sade sātī: Saturn in the 7th, 8th or 9th house from the Moon.
 *  - Gaja-kesarī: Jupiter in a kendra (1st, 4th, 7th, 10th) from the Moon.
 *  - The Vimśottarī Nakṣatra lord is the chart's ruling planet; the nakṣatra
 *    lord table itself lives in `src/content/vedic-mapping.ts` — nothing here
 *    re-declares it.
 *
 * WHAT A DOMAIN REVIEWER SHOULD CHECK FIRST:
 *  1. The house tables below (which placements are called "afflicted" for each
 *     graha). These are the standard whole-sign readings, but the exact
 *     wording of a condition is editorial and may need softening.
 *  2. Whether the severity wording ("harsh", "weak") matches the house the
 *     reviewer would use.
 *  3. The weight given to Rāhu/Ketu emphasis — the modern reading of the
 *     nodes varies a lot between schools.
 *
 * Nothing here is claimed to be a prediction. A condition is a traditional
 * description of a placement, and the reading turns it into devotional
 * guidance, never into a forecast of harm.
 */

import type { Chart } from "~/lib/astro";
import { GRAHAS, NAKSHATRAS, RASHIS, type PlanetKey } from "~/content/vedic-mapping";

/* ------------------------------------------------------------------ types */

/** The eight life areas a reading may focus on. */
export type LifeArea =
  | "career"
  | "wealth"
  | "relationships"
  | "health"
  | "education"
  | "spiritual"
  | "protection"
  | "family";

/** The allowed `primary` values, in the order they are offered to the model. */
export const LIFE_AREAS: readonly LifeArea[] = [
  "career",
  "wealth",
  "relationships",
  "health",
  "education",
  "spiritual",
  "protection",
  "family",
] as const;

/** One detected condition — a traditional description of a placement. */
export interface AstroCondition {
  /** stable machine key, e.g. "mangal-dosha" */
  key: string;
  /** short human title */
  label: string;
  /** one or two sentences of plain, non-alarming description */
  description: string;
  /** the concrete placements that triggered it, for the fact sheet */
  indicators: string[];
}

/** The conditions found in a chart: the difficult ones and the helpful ones. */
export interface BirthChartConditions {
  conditions: AstroCondition[];
  positives: AstroCondition[];
}

/* ------------------------------------------------------------ classical data */

/** uccha — exaltation, by sign index (0 = Meṣa). */
const EXALTATION: Partial<Record<PlanetKey, number>> = {
  sun: 0,
  moon: 1,
  mars: 9,
  mercury: 5,
  jupiter: 3,
  venus: 11,
  saturn: 6,
};

/** svakṣetra — own signs, by sign index. */
const OWN_SIGNS: Partial<Record<PlanetKey, number[]>> = {
  sun: [4],
  moon: [3],
  mars: [0, 7],
  mercury: [2, 5],
  jupiter: [8, 11],
  venus: [1, 6],
  saturn: [9, 10],
};

/**
 * The mūlatrikona sign, by sign index.
 *
 * Each value must be a sign the graha actually RULES (cross-checked against OWN_SIGNS above):
 *  - sun Leo (4) ok;  mercury Virgo (5) ok;  saturn Aquarius (10) ok
 *  - mars Aries (0), NOT Cancer (3): Mars rules Aries/Scorpio; mūlatrikona is Aries.
 *  - jupiter Sagittarius (8), NOT Cancer (3): Jupiter rules Sagittarius/Pisces.
 *  - venus Libra (6), NOT Scorpio (7): Venus rules Taurus/Libra.
 *  - moon Taurus (1) is the one classical exception: the Moon RULES Cancer (3)
 *    but its mūlatrikona is Taurus, so it is deliberately not in OWN_SIGNS.
 * The old Mars/Jupiter/Venus values made `isTrikona()` fire false "in its
 * mūlatrikona" positives (e.g. a Cancer Jupiter reported as being in mūlatrikona).
 */
const TRIKONA: Partial<Record<PlanetKey, number>> = {
  sun: 4,
  moon: 1,
  mars: 0,
  mercury: 5,
  jupiter: 8,
  venus: 6,
  saturn: 10,
};

/** Natural benefics and malefics (classical, whole-sign tradition). */
const NATURAL_BENEFICS: PlanetKey[] = ["jupiter", "venus", "mercury", "moon"];
const NATURAL_MALEFICS: PlanetKey[] = ["saturn", "mars", "rahu", "ketu", "sun"];

/* -------------------------------------------------------------- chart tools */

const signName = (index: number): string => RASHIS[((index % 12) + 12) % 12].name;

/** Whole-sign house (1..12) a planet occupies, or null if it is not found. */
function houseOf(chart: Chart, key: PlanetKey): number | null {
  const idx = chart.houses.findIndex((h) => h.planets.includes(key));
  return idx >= 0 ? idx + 1 : null;
}

/** Whole-sign house (1..12) of a sign, counted from the lagna. */
function houseOfSign(chart: Chart, signIndex: number): number {
  return (((signIndex - chart.lagna.signIndex) % 12) + 12) % 12 + 1;
}

/** Placement of one planet. */
function placementOf(chart: Chart, key: PlanetKey) {
  return chart.planets.find((p) => p.key === key) ?? null;
}

/** Is the sign the exaltation sign of this planet? */
function isExalted(key: PlanetKey, signIndex: number): boolean {
  return EXALTATION[key] === signIndex;
}

/** Is the sign a sign of its own? */
function isOwnSign(key: PlanetKey, signIndex: number): boolean {
  return (OWN_SIGNS[key] ?? []).includes(signIndex);
}

/** Is the sign the mūlatrikona of this planet? */
function isTrikona(key: PlanetKey, signIndex: number): boolean {
  return TRIKONA[key] === signIndex;
}

/** Is the planet in its debilitation sign (opposite the exaltation)? */
function isDebilitated(key: PlanetKey, signIndex: number): boolean {
  const ex = EXALTATION[key];
  return ex !== undefined && ((ex + 6) % 12) === signIndex;
}

/** House counted from the Moon — the house the Moon itself occupies is 1. */
function houseFromMoon(chart: Chart, house: number): number {
  const moonHouse = houseOf(chart, "moon") ?? 1;
  return (((house - moonHouse) % 12) + 12) % 12 + 1;
}

/** The two houses that hold the Rāhu–Ketu axis, 1..12. */
function nodeHouses(chart: Chart): { rahu: number | null; ketu: number | null } {
  return { rahu: houseOf(chart, "rahu"), ketu: houseOf(chart, "ketu") };
}

/** Is the Moon waxing? True when the Moon leads the Sun in the zodiac. */
function isWaxingMoon(chart: Chart): boolean {
  const sun = placementOf(chart, "sun");
  if (!sun) return true;
  const diff = ((chart.moon.longitude - sun.longitude) % 360 + 360) % 360;
  return diff > 0 && diff < 180;
}

/* ------------------------------------------------------------------ assess */

const HOUSE_WORDS = [
  "1st (lagna)",
  "2nd (dhana)",
  "3rd (sahaja)",
  "4th (sukha)",
  "5th (putra)",
  "6th (ari)",
  "7th (yuvati)",
  "8th (randhra)",
  "9th (dharma)",
  "10th (karma)",
  "11th (labha)",
  "12th (vyaya)",
];

/**
 * Look at a computed chart and list the traditional conditions it shows.
 *
 * Purely deterministic: same chart in, same conditions out. No model is
 * consulted and no key is needed.
 */
export function assessChart(chart: Chart): BirthChartConditions {
  const conditions: AstroCondition[] = [];
  const positives: AstroCondition[] = [];

  const lagnaLord = RASHIS[chart.lagna.signIndex].lord;
  const lagnaLordHouse = houseOf(chart, lagnaLord);
  const lagnaLordPlace = placementOf(chart, lagnaLord);
  const saturn = placementOf(chart, "saturn");
  const saturnHouse = houseOf(chart, "saturn");
  const mars = placementOf(chart, "mars");
  const marsHouse = houseOf(chart, "mars");
  const mercury = placementOf(chart, "mercury");
  const mercuryHouse = houseOf(chart, "mercury");
  const jupiter = placementOf(chart, "jupiter");
  const jupiterHouse = houseOf(chart, "jupiter");
  const venus = placementOf(chart, "venus");
  const venusHouse = houseOf(chart, "venus");
  const sun = placementOf(chart, "sun");
  const sunHouse = houseOf(chart, "sun");
  const moon = chart.moon;
  const moonHouse = houseOf(chart, "moon");
  const rahu = placementOf(chart, "rahu");
  const ketu = placementOf(chart, "ketu");
  const { rahu: rahuHouse, ketu: ketuHouse } = nodeHouses(chart);

  /* ---------------------------------------------------- harsh Saturn */
  if (saturn && saturnHouse) {
    const indicators: string[] = [];
    if ([6, 8, 12].includes(saturnHouse)) {
      indicators.push(`Saturn in the ${HOUSE_WORDS[saturnHouse - 1]}`);
    }
    if (isDebilitated("saturn", saturn.signIndex)) {
      indicators.push(`Saturn debilitated in ${signName(saturn.signIndex)}`);
    }
    if (saturn.retrograde) indicators.push("Saturn retrograde");
    const fromMoon = houseFromMoon(chart, saturnHouse);
    if ([7, 8, 9].includes(fromMoon)) {
      indicators.push(`Saturn in the ${fromMoon}th from the Moon (sade sati phase)`);
    }
    if (indicators.length) {
      conditions.push({
        key: "harsh-saturn",
        label: "Saturn's heavier lessons",
        description:
          "Saturn is placed where it asks for patience, delayed rewards and honest effort. Disciplined, steady work carries this chart further than quick results.",
        indicators,
      });
    }
  }

  /* ---------------------------------------------------- Maṅgala doṣa */
  if (mars && marsHouse && [1, 4, 7, 8, 12].includes(marsHouse)) {
    conditions.push({
      key: "mangal-dosha",
      label: "Maṅgala doṣa",
      description:
        "Mars sits in a kendra or a dusthāna from the lagna, the classical Maṅgala doṣa. It is read as a restless, self-assertive energy that is best given a clean, physical outlet.",
      indicators: [`Mars in the ${HOUSE_WORDS[marsHouse - 1]} (${signName(mars.signIndex)})`],
    });
  }

  /* ---------------------------------------------------- afflicted Moon */
  if (moon && moonHouse) {
    const indicators: string[] = [];
    if ([6, 8, 12].includes(moonHouse)) {
      indicators.push(`Moon in the ${HOUSE_WORDS[moonHouse - 1]}`);
    }
    if (isDebilitated("moon", moon.signIndex)) {
      indicators.push(`Moon debilitated in ${signName(moon.signIndex)}`);
    }
    if (rahuHouse === moonHouse || ketuHouse === moonHouse) {
      indicators.push("Moon on the Rahu-Ketu axis");
    }
    const moonNak = NAKSHATRAS[moon.nakshatraIndex];
    if (moonNak.gana === "Rakshasa") {
      indicators.push(`Moon in ${moonNak.name} (Rakshasa gana)`);
    }
    if (indicators.length) {
      conditions.push({
        key: "afflicted-moon",
        label: "The mind under pressure",
        description:
          "The Moon is placed where the classical texts call the mind unsettled. Rest, a steady routine and a single devotional anchor do more here than effort alone.",
        indicators,
      });
    }
  }

  /* --------------------------------------------------- weak lagna lord */
  if (lagnaLordPlace && lagnaLordHouse) {
    const indicators: string[] = [];
    if ([6, 8, 12].includes(lagnaLordHouse)) {
      indicators.push(
        `Lagna lord ${GRAHAS[lagnaLord].name} in the ${HOUSE_WORDS[lagnaLordHouse - 1]}`,
      );
    }
    if (isDebilitated(lagnaLord, lagnaLordPlace.signIndex)) {
      indicators.push(`Lagna lord debilitated in ${signName(lagnaLordPlace.signIndex)}`);
    }
    if (lagnaLordPlace.retrograde) indicators.push("Lagna lord retrograde");
    if (indicators.length) {
      conditions.push({
        key: "weak-lagna-lord",
        label: "A hesitant beginning",
        description:
          "The planet that rules the ascendant is in a demanding place, so the first steps of any undertaking take longer to find their footing. Support and mentors matter here.",
        indicators,
      });
    }
  }

  /* ------------------------------------------------- retrograde Mercury */
  if (mercury && mercuryHouse && mercury.retrograde) {
    const indicators = [`Mercury retrograde in ${signName(mercury.signIndex)}`];
    if ([6, 8, 12].includes(mercuryHouse)) {
      indicators.push(`Mercury in the ${HOUSE_WORDS[mercuryHouse - 1]}`);
    }
    conditions.push({
      key: "retrograde-mercury",
      label: "A mind that works inwards",
      description:
        "Mercury turns back on itself: the thinking is deep, revisits old questions and often understands what it read late. Written notes and one thing at a time suit this placement.",
      indicators,
    });
  }

  /* ---------------------------------------------- Rahu-Ketu emphasis */
  {
    const indicators: string[] = [];
    if (rahuHouse && [1, 4, 7, 10].includes(rahuHouse)) {
      indicators.push(`Rahu in the ${HOUSE_WORDS[rahuHouse - 1]}`);
    }
    if (ketuHouse && [1, 4, 7, 10].includes(ketuHouse)) {
      indicators.push(`Ketu in the ${HOUSE_WORDS[ketuHouse - 1]}`);
    }
    if (rahu && houseOfSign(chart, rahu.signIndex) === 1) {
      indicators.push("Rahu in the lagna");
    }
    if (ketu && houseOfSign(chart, ketu.signIndex) === 1) {
      indicators.push("Ketu in the lagna");
    }
    if (rahuHouse && rahuHouse === lagnaLordHouse) {
      indicators.push("Rahu conjunct the lagna lord");
    }
    if (rahuHouse && rahuHouse === moonHouse) {
      indicators.push("Rahu conjunct the Moon");
    }
    if (indicators.length) {
      conditions.push({
        key: "rahu-ketu-emphasis",
        label: "The nodes are active",
        description:
          "Rahu and Ketu fall in the angles of this chart, so the usual conventions of age, background and expectation are the first things to outgrow. The chart grows through an unusual path, and that is its strength.",
        indicators,
      });
    }
  }

  /* ------------------------------------------------- Venus / Sun trouble */
  if (venus && venusHouse) {
    const indicators: string[] = [];
    if (isDebilitated("venus", venus.signIndex)) {
      indicators.push(`Venus debilitated in ${signName(venus.signIndex)}`);
    }
    if ([6, 8, 12].includes(venusHouse)) {
      indicators.push(`Venus in the ${HOUSE_WORDS[venusHouse - 1]}`);
    }
    if (venus.retrograde) indicators.push("Venus retrograde");
    if (indicators.length) {
      conditions.push({
        key: "afflicted-venus",
        label: "Love and ease ask for attention",
        description:
          "Venus is placed where comfort and affection cannot be taken for granted. Relationships and sense of ease grow out of deliberate, honest effort rather than circumstance.",
        indicators,
      });
    }
  }

  if (sun && sunHouse) {
    const indicators: string[] = [];
    if ([6, 12].includes(sunHouse)) {
      indicators.push(`Sun in the ${HOUSE_WORDS[sunHouse - 1]}`);
    }
    if (isDebilitated("sun", sun.signIndex)) {
      indicators.push(`Sun debilitated in ${signName(sun.signIndex)}`);
    }
    if (rahuHouse && rahuHouse === sunHouse) indicators.push("Sun conjunct Rahu");
    if (indicators.length) {
      conditions.push({
        key: "afflicted-sun",
        label: "Recognition comes late",
        description:
          "The Sun is placed where self-recognition is not handed over easily. Authority, fathers, mentors and the public self are worked out over time rather than early.",
        indicators,
      });
    }
  }

  if (jupiter && jupiterHouse && [6, 8, 12].includes(jupiterHouse)) {
    conditions.push({
      key: "afflicted-jupiter",
      label: "Guru in a hard seat",
      description:
        "Jupiter sits in a demanding house, so faith, counsel and good teaching have to be sought rather than assumed. Study with a real teacher settles it.",
      indicators: [`Jupiter in the ${HOUSE_WORDS[jupiterHouse - 1]}`],
    });
  }

  /* ------------------------------------------- malefics in the angles */
  {
    const inAngles = NATURAL_MALEFICS.filter((key) => {
      const h = houseOf(chart, key);
      return h !== null && [1, 4, 7, 10].includes(h);
    });
    if (inAngles.length >= 2) {
      conditions.push({
        key: "malefics-in-angles",
        label: "Two malefics in the angles",
        description:
          "Two or more natural malefics sit in the kendra houses. The life takes a harder, more self-directed shape early, and tends to harden into a strength with age.",
        indicators: inAngles.map((key) => {
          const h = houseOf(chart, key) ?? 1;
          return `${GRAHAS[key].name} in the ${HOUSE_WORDS[h - 1]}`;
        }),
      });
    }
  }

  /* ------------------------------------------------------------ positives */
  if (jupiter) {
    const indicators: string[] = [];
    if (isExalted("jupiter", jupiter.signIndex)) {
      indicators.push(`Jupiter exalted in ${signName(jupiter.signIndex)}`);
    }
    if (isOwnSign("jupiter", jupiter.signIndex)) {
      indicators.push(`Jupiter in its own sign ${signName(jupiter.signIndex)}`);
    }
    if (isTrikona("jupiter", jupiter.signIndex)) {
      indicators.push(`Jupiter in its mūlatrikona ${signName(jupiter.signIndex)}`);
    }
    if (jupiterHouse && [1, 4, 5, 9, 11].includes(jupiterHouse)) {
      indicators.push(`Jupiter in the ${HOUSE_WORDS[jupiterHouse - 1]}`);
    }
    if (jupiterHouse) {
      const fromMoon = houseFromMoon(chart, jupiterHouse);
      if ([1, 4, 7, 10].includes(fromMoon)) {
        indicators.push("Jupiter in a kendra from the Moon (gaja kesari)");
      }
    }
    if (indicators.length) {
      positives.push({
        key: "strong-jupiter",
        label: "Guru is well placed",
        description:
          "Jupiter is in one of its own strong positions, so learning, guidance and generosity come easily here — this is the chart's own resource for turning effort into wisdom.",
        indicators,
      });
    }
  }

  {
    const exaltedBenefics = NATURAL_BENEFICS.filter((key) => {
      const p = placementOf(chart, key);
      return p ? isExalted(key, p.signIndex) : false;
    });
    if (exaltedBenefics.length) {
      positives.push({
        key: "exalted-benefic",
        label: "A benefic at its peak",
        description:
          "A natural benefic stands in its exaltation, so generosity, balance and good fortune are unusually available in this life when they are asked for.",
        indicators: exaltedBenefics.map((key) => {
          const p = placementOf(chart, key)!;
          return `${GRAHAS[key].name} exalted in ${signName(p.signIndex)}`;
        }),
      });
    }
  }

  {
    const ownBenefics = NATURAL_BENEFICS.filter((key) => {
      const p = placementOf(chart, key);
      return p ? isOwnSign(key, p.signIndex) : false;
    });
    if (ownBenefics.length) {
      positives.push({
        key: "own-sign-benefic",
        label: "A benefic on its own ground",
        description:
          "A benefic sits in a sign it rules, so its virtues are lived rather than borrowed: they are simply this chart's natural way of being.",
        indicators: ownBenefics.map((key) => {
          const p = placementOf(chart, key)!;
          return `${GRAHAS[key].name} in ${signName(p.signIndex)}`;
        }),
      });
    }
  }

  {
    const moonNak = chart.moonNakshatra;
    const favourable = moonNak.gana === "Deva" || NATURAL_BENEFICS.includes(moonNak.lord);
    if (favourable) {
      positives.push({
        key: "favourable-moon-nakshatra",
        label: "A gracious nakshatra",
        description:
          "The Moon rests in a nakshatra of the Deva gana or under a benefic lord, which is the classical sign of a mind that settles well and takes guidance kindly.",
        indicators: [
          `Moon in ${moonNak.name} (${moonNak.gana} gana, lord ${GRAHAS[moonNak.lord].name})`,
        ],
      });
    }
  }

  {
    const indicators: string[] = [];
    if (lagnaLordPlace && lagnaLordHouse) {
      if ([1, 4, 5, 9, 11].includes(lagnaLordHouse)) {
        indicators.push(
          `Lagna lord ${GRAHAS[lagnaLord].name} in the ${HOUSE_WORDS[lagnaLordHouse - 1]}`,
        );
      }
      if (
        isOwnSign(lagnaLord, lagnaLordPlace.signIndex) ||
        isExalted(lagnaLord, lagnaLordPlace.signIndex)
      ) {
        indicators.push(`Lagna lord strong in ${signName(lagnaLordPlace.signIndex)}`);
      }
    }
    if (indicators.length) {
      positives.push({
        key: "strong-lagna-lord",
        label: "The ascendant is well supported",
        description:
          "The planet that rules the ascendant sits in a fortunate house, so the person carries their own centre of weight and starts things from a solid base.",
        indicators,
      });
    }
  }

  /* A waxing Moon is a soft, always-applicable positive. */
  if (moon && isWaxingMoon(chart)) {
    positives.push({
      key: "waxing-moon",
      label: "A waxing Moon",
      description:
        "The Moon is waxing in this chart — the classical sign of a mind that gathers, rather than one that only spends.",
      indicators: [`Moon waxing in ${signName(moon.signIndex)}`],
    });
  }

  return { conditions, positives };
}

/* -------------------------------------------------------------- fact sheet */

const HOUSE_NAMES = [
  "lagna", "dhana", "sahaja", "sukha", "putra", "ari",
  "yuvati", "randhra", "dharma", "karma", "labha", "vyaya",
];

/**
 * The compact fact sheet — the ONLY thing the language model ever sees.
 *
 * `facts` is the structured form (used by the art prompt builder); `text` is
 * the flat, token-optimised version that goes into the prompt. It is kept
 * under roughly 1200 characters so the request stays cheap.
 */
export function chartFactSheet(
  chart: Chart,
  // Optional precomputed assessment (e.g. from `src/server/ai.ts`): when given,
  // the condition pass is reused instead of running `assessChart()` a second
  // time. The parameter is optional, so `chartFactSheet(chart)` is unchanged.
  assessment?: BirthChartConditions,
): { facts: Record<string, string>; text: string } {
  const nak = chart.moonNakshatra;
  const lagnaRashi = RASHIS[chart.lagna.signIndex];
  const lagnaLord = lagnaRashi.lord;
  const ruling = GRAHAS[chart.rulingPlanet];

  const houseList = chart.houses
    .map((h, i) => {
      const names = h.planets.map((k) => GRAHAS[k].name).join(",");
      return `${i + 1}(${HOUSE_NAMES[i]}):${names || "-"}`;
    })
    .join(" ");

  const planetList = chart.planets
    .map((p) => {
      const house = houseOf(chart, p.key);
      const retro = p.retrograde ? " R" : "";
      return `${GRAHAS[p.key].name} ${signName(p.signIndex)}${retro} H${house ?? "-"}`;
    })
    .join("; ");

  // Reuse the caller's assessment when supplied so `assessChart` does not run
  // a second time per request; `chartFactSheet(chart)` still works unchanged.
  const { conditions, positives } = assessment ?? assessChart(chart);

  const facts: Record<string, string> = {
    nakshatra: nak.name,
    nakshatraDevanagari: nak.devanagari,
    pada: String(chart.moonPada),
    deity: nak.deity,
    deityRoman: nak.deityRoman,
    symbol: nak.symbol,
    gana: nak.gana,
    syllableDevanagari: chart.syllable.devanagari,
    syllableRoman: chart.syllable.roman,
    lagna: lagnaRashi.name,
    lagnaEnglish: lagnaRashi.english,
    lagnaLord: GRAHAS[lagnaLord].name,
    rulingPlanet: ruling.name,
    rulingPlanetEnglish: ruling.english,
    rulingColour: `${ruling.colour.accent} ${ruling.colour.deep} ${ruling.colour.glow}`,
    rulingMantraDevanagari: ruling.mantra.devanagari,
    rulingMantraRoman: ruling.mantra.roman,
    moonRashi: signName(chart.moonSign),
    sunRashi: signName(chart.sunSign),
    houses: houseList,
    planets: planetList,
    conditions: conditions.map((c) => c.label).join("; ") || "none detected",
    positives: positives.map((p) => p.label).join("; ") || "none detected",
  };

  const lines: { text: string; required: boolean }[] = [
    {
      text: `Nakshatra: ${nak.name} (pada ${chart.moonPada}). Deity: ${nak.deity}. Gana: ${nak.gana}. Symbol: ${nak.symbol}.`,
      required: true,
    },
    {
      text: `Lagna: ${lagnaRashi.name} (${lagnaRashi.english}); lagna lord ${GRAHAS[lagnaLord].name}.`,
      required: true,
    },
    {
      text: `Ruling planet: ${ruling.name} (${ruling.english}) - colours ${ruling.colour.accent}, ${ruling.colour.deep}, ${ruling.colour.glow}; bija mantra ${ruling.mantra.roman} / ${ruling.mantra.devanagari}.`,
      required: true,
    },
    {
      text: `Moon rashi: ${signName(chart.moonSign)}. Sun rashi: ${signName(chart.sunSign)}. Nakshatra lord: ${GRAHAS[nak.lord].name}.`,
      required: true,
    },
    { text: `Planets: ${planetList}.`, required: false },
    { text: `Houses: ${houseList}.`, required: false },
    {
      text: `Conditions found: ${conditions.map((c) => `${c.label} (${c.indicators.join("; ")})`).join(" | ") || "none"}.`,
      required: false,
    },
    {
      text: `Strengths found: ${positives.map((p) => `${p.label} (${p.indicators.join("; ")})`).join(" | ") || "none"}.`,
      required: false,
    },
  ];

  // Keep every required line, then add the optional ones while they fit.
  const budget = 1150;
  const kept: string[] = [];
  let used = 0;
  for (const line of lines) {
    const add = used + line.text.length + 1;
    if (!line.required && add > budget) continue;
    kept.push(line.text);
    used = add;
  }
  let text = kept.join("\n");
  if (text.length > 1400) text = text.slice(0, 1400);

  return { facts, text };
}