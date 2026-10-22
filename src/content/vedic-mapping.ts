/**
 * ============================================================================
 * PROVISIONAL VEDIC CONTENT — PENDING DOMAIN REVIEW
 * ============================================================================
 * This is the ONE place where all Vedic / astrological content lives: the 27
 * nakshatras, the 9 grahas, their yantras (planetary magic squares), beeja
 * mantras, graha colours, and the aesthetic style archetypes.
 *
 * Nothing in the renderer or the chart engine hard-codes any of it — a domain
 * specialist can correct or extend this file as a pure data change.
 *
 * SOURCES USED FOR THIS FIRST PASS (all standard, checkable sets):
 *  - Nakṣatra order (27), ruling graha (Vimśottarī dasha lords), presiding
 *    deity and classical symbol: the standard nakshatra tables of jyotiṣa,
 *    as given in Bṛhat Parāśara Horā Śāstra and reproduced in the standard
 *    modern references (Hart de Fouw & Robert Svoboda, *Light on Life*;
 *    David Frawley, *Astrology of the Seers*). Names in Devanagari from the
 *    same tables.
 *  - Nakshatra pada syllables (nāma-akṣara, the syllables used for naming a
 *    child): the standard 4-syllables-per-nakshatra table. Pada 1..4 of each
 *    nakshatra map to its four syllables, so the syllable shown is the
 *    person's own pada syllable.
 *  - Gana (Deva / Manuṣya / Rākṣasa) and Yoni-free quality tags: standard.
 *  - Graha colours (graha-varṇa): classical associations — Sun copper/red,
 *    Moon white, Mars red, Mercury green, Jupiter yellow, Venus white/
 *    variegated, Saturn black-deep-blue, Rāhu smoke, Ketu smoke-grey.
 *  - Beeja mantras: the standard navagraha bīja mantras (e.g. "oṃ hrāṃ hrīṃ
 *    hrauṃ saḥ sūryāya namaḥ"). Transliteration is IAST-free roman (the form
 *    commonly written in mantra books); the gloss is a plain translation of
 *    the words ("oṃ … salutations to Sūrya"), not an added claim.
 *  - Planetary magic squares (yantra grids): the classical planetary squares
 *    in Chaldean order — Saturn 3×3 … Moon 9×9 (order 3..9), as published in
 *    Agrippa, *De Occulta Philosophia* II, and carried into Indian graha-
 *    yantra practice. Orders 3..8 below are the classical arrays; every one
 *    is magic (all rows, columns and the two main diagonals sum to the magic
 *    constant — verified in scripts/validate-chart.ts). The 9×9 is built by
 *    the standard Siamese construction (verified to constant 369) because a
 *    hand-copied 81-cell array cannot be checked by eye.
 *
 * WHAT WE COULD NOT VERIFY, SO DID NOT INVENT (route to the researcher):
 *  1. Nakshatra-specific COLOUR associations. Sources disagree widely and we
 *     could not confirm a single authoritative set, so the palette is derived
 *     from the RULING PLANET's classical colour instead — never from a made-up
 *     nakshatra colour. Add `colour` per nakshatra here if you have a source.
 *  2. The Indian-tradition (as opposed to Chaldean) assignment of magic-square
 *     ORDER to planets, e.g. some Indian sources give Sūrya a 3×3. We ship the
 *     Chaldean order because it is the documented, checkable one. Changing it
 *     is a one-line change per planet (`yantra.order`) — the renderer follows
 *     whatever order it is given, and re-verifies the magic constant.
 *  3. Rāhu and Ketu have NO planetary magic square in the classical set, so we
 *     deliberately ship no numbers for them (`yantra: null`): their yantra is
 *     rendered as the geometric form only (bhūpura, lotus, triangles, bindu).
 *  4. Per-nakshatra English "qualities" blurbs were left out: they are mostly
 *     modern editorial prose, not classical attribution.
 */

export type PlanetKey =
  | "sun" | "moon" | "mars" | "mercury" | "jupiter" | "venus"
  | "saturn" | "rahu" | "ketu";

export type MotifKey =
  | "horse" | "yoni" | "flame" | "chariot" | "deer" | "drop" | "bow" | "lotus"
  | "serpent" | "throne" | "cot" | "hand" | "jewel" | "sprout" | "arch" | "ear"
  | "roots" | "fan" | "tusk" | "drum" | "circle" | "sword" | "twins" | "fish";

export interface Graha {
  key: PlanetKey;
  name: string;          // roman Sanskrit name
  english: string;
  devanagari: string;
  symbol: string;        // single-glyph shorthand used in the kundli grid
  /** classical graha-varṇa rendered as a workable design palette */
  colour: { accent: string; deep: string; glow: string };
  /** classical bīja mantra */
  mantra: { devanagari: string; roman: string; gloss: string };
  /** planetary magic square order, or null when none is classically attributed */
  yantra: { order: number; square: number[][] } | null;
  /** what the square/geometry stands for in the yantra */
  yantraNote: string;
}

export interface Nakshatra {
  index: number;         // 1..27
  name: string;          // roman
  devanagari: string;
  lord: PlanetKey;       // Vimśottarī dasha lord
  deity: string;
  deityRoman: string;
  symbol: string;        // classical symbol, in words
  motif: MotifKey;       // the vector form we draw for it
  gana: "Deva" | "Manushya" | "Rakshasa";
  /** four nāma-akṣaras, pada 1..4 */
  syllables: string[];
  syllablesRoman: string[];
}

export interface StylePreset {
  id: string;
  name: string;
  blurb: string;
  /** background treatment */
  bg: { from: string; via: string; to: string; angle: number; vignette: string };
  /** text + line colours as functions of the planet palette (c = planet colour) */
  ink: (c: Graha["colour"]) => string;
  inkSoft: (c: Graha["colour"]) => string;
  rule: (c: Graha["colour"]) => string;
  accentOpacity: number;
  texture: "grain" | "dots" | "rays" | "none";
  /** motif density */
  rings: number;
  petals: number;
  bhupura: boolean;
  cornerMotifs: boolean;
  starField: number;
  lineWeight: number;
  displayFont: "serif" | "sans";
  letterSpacing: number;
  uppercase: boolean;
  dark: boolean;
  /**
   * Opacity (0..1) of the full-bleed scrim drawn over an AI background image,
   * strongest behind the text column, so the Devanagari, mantra, kundli and
   * footer stay crisp over a photograph. Dark presets lay a near-black scrim,
   * light presets a warm off-white one. Unused when backgroundImageUrl is absent.
   */
  artScrim: number;
}

/* ------------------------------------------------------------------ grahas */

/** Siamese (De la Loubère) construction for odd order; verified magic. */
function siamese(n: number): number[][] {
  const g = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  let r = 0, c = Math.floor(n / 2);
  for (let k = 1; k <= n * n; k++) {
    g[r][c] = k;
    const r2 = (r - 1 + n) % n, c2 = (c + 1) % n;
    if (g[r2][c2]) r = (r + 1) % n; else { r = r2; c = c2; }
  }
  return g;
}

export const GRAHAS: Record<PlanetKey, Graha> = {
  sun: {
    key: "sun", name: "Sūrya", english: "Sun", devanagari: "सूर्य", symbol: "Su",
    colour: { accent: "#e0a23c", deep: "#3a2010", glow: "#ffd9a0" },
    mantra: {
      devanagari: "ॐ ह्रां ह्रीं ह्रौं सः सूर्याय नमः",
      roman: "Oṃ hrāṃ hrīṃ hrauṃ saḥ sūryāya namaḥ",
      gloss: "Oṃ — salutations to Sūrya, the Sun.",
    },
    yantra: {
      order: 6,
      square: [
        [6, 32, 3, 34, 35, 1],
        [7, 11, 27, 28, 8, 30],
        [19, 14, 16, 15, 23, 24],
        [18, 20, 22, 21, 17, 13],
        [25, 29, 10, 9, 26, 12],
        [36, 5, 33, 4, 2, 31],
      ],
    },
    yantraNote: "6×6 Sūrya yantra — every line totals 111.",
  },
  moon: {
    key: "moon", name: "Candra", english: "Moon", devanagari: "चन्द्र", symbol: "Mo",
    colour: { accent: "#dbe6f4", deep: "#141c2b", glow: "#ffffff" },
    mantra: {
      devanagari: "ॐ श्रां श्रीं श्रौं सः चन्द्राय नमः",
      roman: "Oṃ śrāṃ śrīṃ śrauṃ saḥ candrāya namaḥ",
      gloss: "Oṃ — salutations to Candra, the Moon.",
    },
    yantra: { order: 9, square: siamese(9) },
    yantraNote: "9×9 Candra yantra — every line totals 369 (Siamese construction).",
  },
  mars: {
    key: "mars", name: "Maṅgala", english: "Mars", devanagari: "मंगल", symbol: "Ma",
    colour: { accent: "#c8452c", deep: "#2b0f0b", glow: "#ff9a76" },
    mantra: {
      devanagari: "ॐ क्रां क्रीं क्रौं सः भौमाय नमः",
      roman: "Oṃ krāṃ krīṃ krauṃ saḥ bhaumāya namaḥ",
      gloss: "Oṃ — salutations to Bhauma (Maṅgala), Mars.",
    },
    yantra: {
      order: 5,
      square: [
        [11, 24, 7, 20, 3],
        [4, 12, 25, 8, 16],
        [17, 5, 13, 21, 9],
        [10, 18, 1, 14, 22],
        [23, 6, 19, 2, 15],
      ],
    },
    yantraNote: "5×5 Maṅgala yantra — every line totals 65.",
  },
  mercury: {
    key: "mercury", name: "Budha", english: "Mercury", devanagari: "बुध", symbol: "Bu",
    colour: { accent: "#4f9d6c", deep: "#0f2318", glow: "#a8e6c1" },
    mantra: {
      devanagari: "ॐ ब्रां ब्रीं ब्रौं सः बुधाय नमः",
      roman: "Oṃ brāṃ brīṃ brauṃ saḥ budhāya namaḥ",
      gloss: "Oṃ — salutations to Budha, Mercury.",
    },
    yantra: {
      order: 8,
      square: [
        [8, 58, 59, 5, 4, 62, 63, 1],
        [49, 15, 14, 52, 53, 11, 10, 56],
        [41, 23, 22, 44, 45, 19, 18, 48],
        [32, 34, 35, 29, 28, 38, 39, 25],
        [40, 26, 27, 37, 36, 30, 31, 33],
        [17, 47, 46, 20, 21, 43, 42, 24],
        [9, 55, 54, 12, 13, 51, 50, 16],
        [64, 2, 3, 61, 60, 6, 7, 57],
      ],
    },
    yantraNote: "8×8 Budha yantra — every line totals 260.",
  },
  jupiter: {
    key: "jupiter", name: "Guru", english: "Jupiter", devanagari: "गुरु", symbol: "Gu",
    colour: { accent: "#d7a62a", deep: "#332609", glow: "#ffe6a0" },
    mantra: {
      devanagari: "ॐ ग्रां ग्रीं ग्रौं सः गुरवे नमः",
      roman: "Oṃ grāṃ grīṃ grauṃ saḥ gurave namaḥ",
      gloss: "Oṃ — salutations to Guru (Bṛhaspati), Jupiter.",
    },
    yantra: {
      order: 4,
      square: [
        [4, 14, 15, 1],
        [9, 7, 6, 12],
        [5, 11, 10, 8],
        [16, 2, 3, 13],
      ],
    },
    yantraNote: "4×4 Guru yantra — every line totals 34.",
  },
  venus: {
    key: "venus", name: "Śukra", english: "Venus", devanagari: "शुक्र", symbol: "Śu",
    colour: { accent: "#e3c7a2", deep: "#2c241d", glow: "#fff3dd" },
    mantra: {
      devanagari: "ॐ द्रां द्रीं द्रौं सः शुक्राय नमः",
      roman: "Oṃ drāṃ drīṃ drauṃ saḥ śukrāya namaḥ",
      gloss: "Oṃ — salutations to Śukra, Venus.",
    },
    yantra: {
      order: 7,
      square: [
        [22, 47, 16, 41, 10, 35, 4],
        [5, 23, 48, 17, 42, 11, 29],
        [30, 6, 24, 49, 18, 36, 12],
        [13, 31, 7, 25, 43, 19, 37],
        [38, 14, 32, 1, 26, 44, 20],
        [21, 39, 8, 33, 2, 27, 45],
        [46, 15, 40, 9, 34, 3, 28],
      ],
    },
    yantraNote: "7×7 Śukra yantra — every line totals 175.",
  },
  saturn: {
    key: "saturn", name: "Śani", english: "Saturn", devanagari: "शनि", symbol: "Śa",
    colour: { accent: "#5b6b8c", deep: "#0b0f16", glow: "#b9c6e0" },
    mantra: {
      devanagari: "ॐ प्रां प्रीं प्रौं सः शनये नमः",
      roman: "Oṃ prāṃ prīṃ prauṃ saḥ śanaye namaḥ",
      gloss: "Oṃ — salutations to Śani, Saturn.",
    },
    yantra: {
      order: 3,
      square: [
        [4, 9, 2],
        [3, 5, 7],
        [8, 1, 6],
      ],
    },
    yantraNote: "3×3 Śani yantra — every line totals 15.",
  },
  rahu: {
    key: "rahu", name: "Rāhu", english: "Rahu", devanagari: "राहु", symbol: "Rā",
    colour: { accent: "#7d6c95", deep: "#16121f", glow: "#cbb9e0" },
    mantra: {
      devanagari: "ॐ भ्रां भ्रीं भ्रौं सः राहवे नमः",
      roman: "Oṃ bhrāṃ bhrīṃ bhrauṃ saḥ rāhave namaḥ",
      gloss: "Oṃ — salutations to Rāhu.",
    },
    yantra: null,
    yantraNote:
      "No planetary magic square is classically attributed to Rāhu, so this yantra " +
      "is geometric only: bhūpura, lotus, interlaced triangles and bindu.",
  },
  ketu: {
    key: "ketu", name: "Ketu", english: "Ketu", devanagari: "केतु", symbol: "Ke",
    colour: { accent: "#a9744f", deep: "#1d1512", glow: "#e0b48f" },
    mantra: {
      devanagari: "ॐ स्त्रां स्त्रीं स्त्रौं सः केतवे नमः",
      roman: "Oṃ strāṃ strīṃ strauṃ saḥ ketave namaḥ",
      gloss: "Oṃ — salutations to Ketu.",
    },
    yantra: null,
    yantraNote:
      "No planetary magic square is classically attributed to Ketu, so this yantra " +
      "is geometric only: bhūpura, lotus, inverted triangles and bindu.",
  },
};

export const PLANET_ORDER: PlanetKey[] = [
  "sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu",
];

/* --------------------------------------------------------------- nakshatras */

type NRow = [
  string, string, PlanetKey, string, string, string, MotifKey,
  Nakshatra["gana"], string, string,
];

// [name, devanagari, lord, deity, deity roman, symbol, motif, gana, 4 syllables, 4 syllables roman]
const NAK_ROWS: NRow[] = [
  ["Ashwinī", "अश्विनी", "ketu", "Aśvins", "Ashwini Kumaras", "horse's head", "horse", "Deva", "चु|चे|चो|ला", "Chu|Che|Cho|La"],
  ["Bharaṇī", "भरणी", "venus", "Yama", "Yama", "yoni (organ of generation)", "yoni", "Manushya", "ली|लू|ले|लो", "Li|Lu|Le|Lo"],
  ["Kṛttikā", "कृत्तिका", "sun", "Agni", "Agni", "razor or flame", "flame", "Rakshasa", "अ|ई|उ|ए", "A|I|U|E"],
  ["Rohiṇī", "रोहिणी", "moon", "Brahmā", "Brahma (Prajapati)", "ox-cart", "chariot", "Manushya", "ओ|वा|वी|वु", "O|Va|Vi|Vu"],
  ["Mṛgaśirā", "मृगशिरा", "mars", "Soma", "Soma", "deer's head", "deer", "Deva", "वे|वो|का|की", "Ve|Vo|Ka|Ki"],
  ["Ārdrā", "आर्द्रा", "rahu", "Rudra", "Rudra", "teardrop", "drop", "Manushya", "कु|घ|ङ|छ", "Ku|Gha|Nga|Chha"],
  ["Punarvasu", "पुनर्वसु", "jupiter", "Aditi", "Aditi", "bow and quiver", "bow", "Deva", "के|को|हा|ही", "Ke|Ko|Ha|Hi"],
  ["Puṣya", "पुष्य", "saturn", "Bṛhaspati", "Brihaspati", "cow's udder, lotus", "lotus", "Deva", "हु|हे|हो|डा", "Hu|He|Ho|Da"],
  ["Āśleṣā", "आश्लेषा", "mercury", "Nāgas", "Nagas (serpents)", "coiled serpent", "serpent", "Rakshasa", "डी|डू|डे|डो", "Di|Du|De|Do"],
  ["Maghā", "मघा", "ketu", "Pitṛs", "Pitris (ancestors)", "royal throne", "throne", "Rakshasa", "मा|मी|मू|मे", "Ma|Mi|Mu|Me"],
  ["Pūrva Phalgunī", "पूर्व फाल्गुनी", "venus", "Bhaga", "Bhaga", "front legs of a bed", "cot", "Manushya", "मो|टा|टी|टू", "Mo|Ta|Ti|Tu"],
  ["Uttara Phalgunī", "उत्तर फाल्गुनी", "sun", "Aryaman", "Aryaman", "back legs of a bed", "cot", "Manushya", "टे|टो|पा|पी", "Te|To|Pa|Pi"],
  ["Hasta", "हस्त", "moon", "Savitṛ", "Savitar", "hand", "hand", "Deva", "पू|ष|ण|ठ", "Pu|Sha|Na|Tha"],
  ["Citrā", "चित्रा", "mars", "Tvaṣṭṛ", "Tvashtar (Vishwakarma)", "bright jewel", "jewel", "Rakshasa", "पे|पो|रा|री", "Pe|Po|Ra|Ri"],
  ["Svātī", "स्वाती", "rahu", "Vāyu", "Vayu", "young sprout in the wind", "sprout", "Deva", "रू|रे|रो|ता", "Ru|Re|Ro|Ta"],
  ["Viśākhā", "विशाखा", "jupiter", "Indrāgni", "Indragni", "triumphal arch", "arch", "Rakshasa", "ती|तू|ते|तो", "Ti|Tu|Te|To"],
  ["Anurādhā", "अनुराधा", "saturn", "Mitra", "Mitra", "lotus", "lotus", "Deva", "ना|नी|नू|ने", "Na|Ni|Nu|Ne"],
  ["Jyeṣṭhā", "ज्येष्ठा", "mercury", "Indra", "Indra", "earring or umbrella", "jewel", "Rakshasa", "नो|या|यी|यू", "No|Ya|Yi|Yu"],
  ["Mūla", "मूल", "ketu", "Nirṛti", "Nirriti", "bunch of tied roots", "roots", "Rakshasa", "ये|यो|भा|भी", "Ye|Yo|Bha|Bhi"],
  ["Pūrva Āṣāḍhā", "पूर्व आषाढा", "venus", "Āpas", "Apas (the waters)", "winnowing fan", "fan", "Manushya", "भू|धा|फा|ढा", "Bhu|Dha|Pha|Dha"],
  ["Uttara Āṣāḍhā", "उत्तर आषाढा", "sun", "Viśvedevās", "Vishvedevas", "elephant tusk", "tusk", "Manushya", "भे|भो|जा|जी", "Bhe|Bho|Ja|Ji"],
  ["Śravaṇa", "श्रवण", "moon", "Viṣṇu", "Vishnu", "three footprints", "ear", "Deva", "खी|खू|खे|खो", "Khi|Khu|Khe|Kho"],
  ["Dhaniṣṭhā", "धनिष्ठा", "mars", "Vasus", "Vasus", "drum", "drum", "Rakshasa", "गा|गी|गु|गे", "Ga|Gi|Gu|Ge"],
  ["Śatabhiṣā", "शतभिषा", "rahu", "Varuṇa", "Varuna", "empty circle", "circle", "Rakshasa", "गो|सा|सी|सू", "Go|Sa|Si|Su"],
  ["Pūrva Bhādrapadā", "पूर्व भाद्रपदा", "jupiter", "Aja Ekapāda", "Aja Ekapada", "sword", "sword", "Manushya", "से|सो|दा|दी", "Se|So|Da|Di"],
  ["Uttara Bhādrapadā", "उत्तर भाद्रपदा", "saturn", "Ahirbudhnya", "Ahirbudhnya", "twins", "twins", "Manushya", "दू|थ|झ|ञ", "Du|Tha|Jha|Nya"],
  ["Revatī", "रेवती", "mercury", "Pūṣan", "Pushan", "fish or drum", "fish", "Deva", "दे|दो|चा|ची", "De|Do|Cha|Chi"],
];

export const NAKSHATRAS: Nakshatra[] = NAK_ROWS.map((r, i) => ({
  index: i + 1,
  name: r[0],
  devanagari: r[1],
  lord: r[2],
  deity: r[3],
  deityRoman: r[4],
  symbol: r[5],
  motif: r[6],
  gana: r[7],
  syllables: r[8].split("|"),
  syllablesRoman: r[9].split("|"),
}));

/** Nakṣatra is 13°20' of the sidereal zodiac; each of its 4 padas is 3°20'. */
export const NAK_SPAN = 360 / 27;
export const PADA_SPAN = NAK_SPAN / 4;

/* ------------------------------------------------------------------- rashis */

export const RASHIS: { name: string; devanagari: string; english: string; lord: PlanetKey }[] = [
  { name: "Meṣa", devanagari: "मेष", english: "Aries", lord: "mars" },
  { name: "Vṛṣabha", devanagari: "वृषभ", english: "Taurus", lord: "venus" },
  { name: "Mithuna", devanagari: "मिथुन", english: "Gemini", lord: "mercury" },
  { name: "Karka", devanagari: "कर्क", english: "Cancer", lord: "moon" },
  { name: "Siṃha", devanagari: "सिंह", english: "Leo", lord: "sun" },
  { name: "Kanyā", devanagari: "कन्या", english: "Virgo", lord: "mercury" },
  { name: "Tulā", devanagari: "तुला", english: "Libra", lord: "venus" },
  { name: "Vṛścika", devanagari: "वृश्चिक", english: "Scorpio", lord: "mars" },
  { name: "Dhanu", devanagari: "धनु", english: "Sagittarius", lord: "jupiter" },
  { name: "Makara", devanagari: "मकर", english: "Capricorn", lord: "saturn" },
  { name: "Kumbha", devanagari: "कुम्भ", english: "Aquarius", lord: "saturn" },
  { name: "Mīna", devanagari: "मीन", english: "Pisces", lord: "jupiter" },
];

/* ------------------------------------------------------------- style presets */

/**
 * Aesthetic archetypes. Grounded (per the brief) in temple / Tanjore gold,
 * Mughal-night indigo, modern line-art minimalism and dense yantra ornament.
 * PROVISIONAL — the researcher owns the final word on these.
 */
export const PRESETS: StylePreset[] = [
  {
    id: "temple-gold",
    name: "Temple Gold",
    blurb: "Deep umber ground, beaten gold linework, dense lotus mandala.",
    bg: { from: "#2a1a0d", via: "#3d2513", to: "#160d06", angle: 90, vignette: "#000000" },
    ink: (_c) => "#f6e6c8",
    inkSoft: (_c) => "#cbb08a",
    rule: (_c) => "#b98a3c",
    accentOpacity: 1,
    texture: "grain",
    rings: 4, petals: 24, bhupura: true, cornerMotifs: true, starField: 40,
    lineWeight: 1.6, displayFont: "serif", letterSpacing: 4, uppercase: true, dark: true,
    artScrim: 0.64,
  },
  {
    id: "indigo-midnight",
    name: "Indigo Midnight",
    blurb: "Night-indigo field, moonlit silver, medium motif density.",
    bg: { from: "#0d1230", via: "#151c47", to: "#05060f", angle: 105, vignette: "#000010" },
    ink: () => "#e8ecfa",
    inkSoft: () => "#98a3cd",
    rule: (c) => c.accent,
    accentOpacity: 0.95,
    texture: "rays",
    rings: 3, petals: 16, bhupura: true, cornerMotifs: false, starField: 90,
    lineWeight: 1.2, displayFont: "serif", letterSpacing: 6, uppercase: true, dark: true,
    artScrim: 0.66,
  },
  {
    id: "minimal-line",
    name: "Minimal Line-Art",
    blurb: "Parchment ground, one hairline weight, wide calm space.",
    bg: { from: "#f4efe6", via: "#efe7da", to: "#e6dccc", angle: 80, vignette: "#c9bda7" },
    ink: () => "#241d16",
    inkSoft: () => "#6b5f50",
    rule: (c) => c.deep,
    accentOpacity: 0.9,
    texture: "none",
    rings: 2, petals: 12, bhupura: false, cornerMotifs: true, starField: 0,
    lineWeight: 0.9, displayFont: "sans", letterSpacing: 2, uppercase: false, dark: false,
    artScrim: 0.55,
  },
  {
    id: "dense-mandala",
    name: "Dense Mandala",
    blurb: "Saturated ground, maximal ornament — every ring filled.",
    bg: { from: "#1a0f1c", via: "#2c1226", to: "#0a0509", angle: 120, vignette: "#000000" },
    ink: () => "#f7ecdf",
    inkSoft: () => "#c9a7a0",
    rule: (c) => c.accent,
    accentOpacity: 1,
    texture: "dots",
    rings: 6, petals: 32, bhupura: true, cornerMotifs: true, starField: 140,
    lineWeight: 1.1, displayFont: "serif", letterSpacing: 3, uppercase: true, dark: true,
    artScrim: 0.70,
  },
  {
    id: "royal-marigold",
    name: "Royal Marigold",
    blurb: "Oxblood-and-marigold showpiece — foil double frame, dense lotus mandala.",
    bg: { from: "#3a0f14", via: "#5a1a12", to: "#12060a", angle: 100, vignette: "#000000" },
    ink: () => "#ffeccc",
    inkSoft: () => "#e0a878",
    rule: (_c) => "#e0a838",
    accentOpacity: 1,
    texture: "rays",
    rings: 5, petals: 28, bhupura: true, cornerMotifs: true, starField: 70,
    lineWeight: 1.4, displayFont: "serif", letterSpacing: 5, uppercase: true, dark: true,
    artScrim: 0.60,
  },
];

export function presetById(id: string): StylePreset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}
