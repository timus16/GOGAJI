/**
 * Wallpaper renderer. A single pure function turns a chart + a style preset
 * into one SVG document string. The same string is used for the live preview
 * (dropped into the DOM) and for the PNG export (rasterised through an <img>),
 * so what you see is exactly what you download.
 *
 * Every visual element is derived from the chart: the yantra grid is the
 * ruling planet's magic square, the mandala petal count and ring count come
 * from the style preset, the motif is the nakshatra's classical symbol, the
 * kundli square holds the real whole-sign house placements, and the palette
 * comes from the ruling planet's classical graha-varṇa.
 */
import type { Chart } from "~/lib/astro";
import { dms, rashiOf } from "~/lib/astro";
import {
  GRAHAS, NAKSHATRAS, presetById, type MotifKey, type StylePreset,
} from "~/content/vedic-mapping";
import {
  houseBhavaName, lifeAreaProfiles, type EmblemKey, type LifeAreaProfile,
} from "~/content/life-areas";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const DEV = "'Noto Sans Devanagari', serif";

/**
 * Cap a font size so a text run is estimated to fit `maxWidth`. The advance is
 * modelled as 0.70 em per glyph plus any per-character letter-spacing, which is
 * deliberately on the generous side for the display font, so the wide header and
 * ruling-planet / yantra-note footer lines (Rāhu and Ketu carry long notes) can
 * never run off the frame.
 */
const GLYPH_EM = 0.70;

const fitGlyphs = (size: number, s: string, maxWidth: number, perCharExtra = 0) => {
  const n = Math.max(1, s.length);
  if (n * (GLYPH_EM * size + perCharExtra) <= maxWidth) return size;
  return Math.max(8, (maxWidth / n - perCharExtra) / GLYPH_EM);
};

/**
 * Greedy word-wrap a run into lines that each fit `maxWidth` at `size`, using
 * the same advance model as `fitGlyphs` (no letter-spacing). Used for the long
 * Rahu / Ketu yantra notes in the landscape footer so a two-sentence note stays
 * inside its column instead of running past the frame.
 */
const wrapToWidth = (size: number, s: string, maxWidth: number): string[] => {
  const limit = maxWidth / (GLYPH_EM * Math.max(1, size));
  const lines: string[] = [];
  let cur = "";
  for (const word of s.split(/\s+/).filter(Boolean)) {
    const trial = cur ? cur + " " + word : word;
    if (cur && trial.length > limit) { lines.push(cur); cur = word; } else cur = trial;
  }
  if (cur) lines.push(cur);
  return lines;
};

export interface WallpaperOptions {
  chart: Chart;
  presetId: string;
  width: number;
  height: number;
  /** @font-face rules; pass a data-URI version for exports */
  fontFaceCss?: string;
  /** exposed for the in-page preview */
  className?: string;
  /** Optional AI-generated art data URL, drawn as the base layer (cover-fit). */
  backgroundImageUrl?: string;
  /**
   * The life areas the querent asked about ("wealth", "health", ...). Plain
   * strings on purpose: the client owns this list and the renderer ignores
   * anything it does not recognise. When it is empty the poster is unchanged.
   */
  focusAreas?: readonly string[];
  /**
   * Mark the artwork as a SAMPLE: the birth data was filled in by the app to
   * show what a poster looks like, not supplied by the person it names. The
   * poster then says so on its own birth line, so a sample can never be
   * mistaken for somebody's real kundli.
   */
  sample?: boolean;
}

/* ------------------------------------------------------------------ motifs */

/** Each motif is drawn inside a unit box: x,y in [-0.5, 0.5]. */
function motifShape(m: MotifKey, sw: number): string {
  const st = `fill="none" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`;
  switch (m) {
    case "horse":
      return `<path d="M-0.34 0.5 L-0.30 -0.02 Q-0.36 -0.30 -0.10 -0.34 L0.06 -0.46 L0.16 -0.30 Q0.34 -0.16 0.24 0.06 L0.30 0.5" ${st}/>
        <circle cx="-0.16" cy="-0.20" r="0.035" fill="currentColor" stroke="none"/>
        <path d="M-0.10 -0.34 Q-0.02 -0.52 0.06 -0.46" ${st}/>`;
    case "yoni":
      return `<circle cx="0" cy="-0.06" r="0.34" ${st}/>
        <path d="M-0.26 0.04 L0.26 0.04 L0 0.40 Z" ${st}/>
        <circle cx="0" cy="-0.06" r="0.07" fill="currentColor" stroke="none"/>`;
    case "flame":
      return `<path d="M0 0.46 Q-0.34 0.14 -0.22 -0.10 Q-0.14 -0.30 0 -0.46 Q0.14 -0.30 0.22 -0.10 Q0.34 0.14 0 0.46 Z" ${st}/>
        <path d="M0 0.26 Q-0.16 0.10 -0.10 -0.04 Q-0.04 -0.16 0 -0.24 Q0.04 -0.16 0.10 -0.04 Q0.16 0.10 0 0.26 Z" ${st}/>`;
    case "chariot":
      return `<circle cx="0" cy="0.14" r="0.30" ${st}/>
        <circle cx="0" cy="0.14" r="0.07" ${st}/>
        <path d="M0 0.14 L0 -0.16 M0 0.14 L0.26 0.28 M0 0.14 L-0.26 0.28 M0 0.14 L0.16 -0.12 M0 0.14 L-0.16 -0.12" ${st}/>`;
    case "deer":
      return `<path d="M-0.20 0.50 L-0.16 0.02 Q-0.24 -0.20 -0.06 -0.24 L0.06 -0.32 L0.16 -0.20 Q0.30 -0.08 0.22 0.06 L0.26 0.50" ${st}/>
        <path d="M0.02 -0.30 L-0.06 -0.50 M-0.06 -0.50 L-0.20 -0.44 M-0.06 -0.50 L-0.12 -0.34 M0.14 -0.32 L0.30 -0.48 M0.30 -0.48 L0.18 -0.46" ${st}/>`;
    case "drop":
      return `<path d="M0 -0.46 Q0.30 -0.06 0.24 0.14 A0.24 0.24 0 1 1 -0.24 0.14 Q-0.30 -0.06 0 -0.46 Z" ${st}/>`;
    case "bow":
      return `<path d="M-0.30 -0.44 Q0.24 0 0.30 0.44" ${st}/>
        <path d="M-0.30 -0.44 L0.30 0.44 M-0.24 0.20 L0.24 -0.20" ${st}/>
        <path d="M0.30 0.44 L0.14 0.34 M0.30 0.44 L0.20 0.28" ${st}/>`;
    case "lotus":
      return Array.from({ length: 8 }, (_, i) => {
        const a = (i * 45) * Math.PI / 180;
        return `<ellipse cx="${(Math.cos(a) * 0.22).toFixed(3)}" cy="${(Math.sin(a) * 0.22 - 0.06).toFixed(3)}" rx="0.10" ry="0.22" transform="rotate(${i * 45} ${(Math.cos(a) * 0.22).toFixed(3)} ${(Math.sin(a) * 0.22 - 0.06).toFixed(3)})" ${st}/>`;
      }).join("") + `<circle cx="0" cy="-0.06" r="0.06" fill="currentColor" stroke="none"/>`;
    case "serpent":
      return `<path d="M-0.34 0.36 Q-0.34 0.06 0 0.06 Q0.34 0.06 0.34 -0.16 Q0.34 -0.36 0.02 -0.36 Q-0.22 -0.36 -0.22 -0.20" ${st}/>
        <circle cx="-0.22" cy="-0.20" r="0.045" fill="currentColor" stroke="none"/>`;
    case "throne":
      return `<path d="M-0.30 0.44 L-0.30 -0.20 Q0 -0.46 0.30 -0.20 L0.30 0.44" ${st}/>
        <path d="M-0.36 0.44 L0.36 0.44 M-0.18 -0.16 L-0.18 0.30 M0.18 -0.16 L0.18 0.30" ${st}/>`;
    case "cot":
      return `<path d="M-0.38 -0.10 L0.38 -0.10 M-0.38 0.28 L0.38 0.28" ${st}/>
        <path d="M-0.30 0.28 L-0.34 0.48 M0.30 0.28 L0.34 0.48" ${st}/>
        <path d="M-0.38 -0.10 L-0.38 0.28 M0.38 -0.10 L0.38 0.28" ${st}/>`;
    case "hand":
      return `<path d="M-0.26 0.46 L-0.26 -0.04 Q-0.26 -0.20 -0.08 -0.20 L0.20 -0.20 Q0.30 -0.20 0.30 -0.06 L0.30 0.46" ${st}/>
        <path d="M-0.08 -0.20 L-0.08 -0.42 M0.06 -0.20 L0.06 -0.46 M0.20 -0.20 L0.20 -0.40" ${st}/>`;
    case "jewel":
      return `<path d="M0 -0.44 L0.32 -0.14 L0 0.46 L-0.32 -0.14 Z" ${st}/>
        <path d="M-0.32 -0.14 L0.32 -0.14 M0 -0.44 L-0.16 -0.14 L0 0.46 M0 -0.44 L0.16 -0.14 L0 0.46" ${st}/>`;
    case "sprout":
      return `<path d="M0 0.46 L0 -0.10" ${st}/>
        <path d="M0 0.06 Q-0.34 -0.02 -0.36 -0.34 Q-0.04 -0.30 0 0.06 Z" ${st}/>
        <path d="M0 -0.04 Q0.32 -0.14 0.30 -0.44 Q0.02 -0.36 0 -0.04 Z" ${st}/>`;
    case "arch":
      return `<path d="M-0.34 0.46 L-0.34 -0.06 Q0 -0.50 0.34 -0.06 L0.34 0.46" ${st}/>
        <path d="M-0.34 0.46 L0.34 0.46 M-0.16 0.46 L-0.16 -0.02 Q0 -0.28 0.16 -0.02 L0.16 0.46" ${st}/>`;
    case "ear": // Śravaṇa's symbol: three footprints
      return [0, 1, 2].map((i) => {
        const y = -0.30 + i * 0.30;
        return `<ellipse cx="${i % 2 === 0 ? -0.10 : 0.10}" cy="${y}" rx="0.10" ry="0.15" ${st}/>
          <circle cx="${i % 2 === 0 ? -0.10 : 0.10}" cy="${y - 0.20}" r="0.045" fill="currentColor" stroke="none"/>`;
      }).join("");
    case "roots":
      return `<path d="M0 0.30 Q0.22 0.34 0.24 0.46 Q-0.22 0.46 -0.24 0.34 Q-0.20 0.30 0 0.30 Z" ${st}/>
        <path d="M0 0.30 Q-0.08 0.02 -0.30 -0.06 M0 0.30 Q0.02 -0.06 -0.06 -0.34 M0 0.30 Q0.14 0.00 0.32 -0.02 M0 0.30 Q0.06 -0.10 0.22 -0.36" ${st}/>`;
    case "fan":
      return `<path d="M-0.34 0.30 A0.34 0.34 0 0 1 0.34 0.30 Z" ${st}/>
        <path d="M0 0.30 L0 -0.04 M0 0.30 L-0.24 0.06 M0 0.30 L0.24 0.06 M0 0.30 L-0.12 -0.02 M0 0.30 L0.12 -0.02" ${st}/>
        <path d="M-0.06 0.30 L-0.06 0.48 L0.06 0.48 L0.06 0.30" ${st}/>`;
    case "tusk":
      return `<path d="M0.26 -0.44 Q-0.34 -0.24 -0.30 0.42 Q-0.10 0.26 0.06 0.06 Q0.24 -0.14 0.26 -0.44 Z" ${st}/>`;
    case "drum":
      return `<path d="M-0.30 -0.40 L0.30 -0.40 L-0.30 0.40 L0.30 0.40 Z" ${st}/>
        <path d="M-0.30 -0.40 L0.30 -0.40" ${st}/>
        <path d="M-0.36 -0.48 L0.36 -0.48 M-0.30 -0.40 L-0.36 -0.48 M0.30 -0.40 L0.36 -0.48" ${st}/>`;
    case "circle":
      return `<circle cx="0" cy="0" r="0.34" ${st}/>
        <circle cx="0" cy="0" r="0.06" fill="currentColor" stroke="none"/>`;
    case "sword":
      return `<path d="M0 -0.48 L0 0.20" ${st}/>
        <path d="M-0.24 0.20 L0.24 0.20 M0 0.20 L0 0.46 M-0.10 0.46 L0.10 0.46" ${st}/>`;
    case "twins":
      return `<path d="M-0.20 -0.14 A0.10 0.10 0 1 1 -0.20 -0.15 M0.20 -0.14 A0.10 0.10 0 1 1 0.20 -0.15" ${st}/>
        <path d="M-0.30 0.44 L-0.20 0.02 L-0.08 0.44 M0.08 0.44 L0.20 0.02 L0.30 0.44" ${st}/>`;
    case "fish":
      return `<path d="M-0.10 -0.34 Q-0.36 -0.10 -0.10 0.34 Q0.16 -0.10 -0.10 -0.34 Z" ${st}/>
        <path d="M0.14 -0.34 Q0.40 -0.10 0.14 0.34 Q-0.12 -0.10 0.14 -0.34 Z" ${st}/>
        <circle cx="-0.18" cy="-0.14" r="0.035" fill="currentColor" stroke="none"/>
        <circle cx="0.22" cy="-0.14" r="0.035" fill="currentColor" stroke="none"/>`;
  }
}

/* ------------------------------------------------------------- life areas */

/**
 * The emblem of a life area, drawn in the same unit box as `motifShape`
 * (x,y in [-0.5, 0.5]). These are NOT nakshatra motifs: the nakshatra motif
 * belongs to the chart, the emblem belongs to the question the querent asked.
 */
function emblemShape(e: EmblemKey, sw: number): string {
  const st = `fill="none" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`;
  switch (e) {
    case "coin":
      return `<circle cx="0" cy="0" r="0.36" ${st}/>
        <circle cx="0" cy="0" r="0.17" ${st}/>
        <path d="M-0.12 0 L0.12 0" ${st}/>`;
    case "rings":
      return `<circle cx="-0.15" cy="0" r="0.27" ${st}/>
        <circle cx="0.15" cy="0" r="0.27" ${st}/>`;
    case "ladder":
      return `<path d="M-0.26 -0.34 L-0.26 0.34 M0.26 -0.34 L0.26 0.34" ${st}/>
        <path d="M-0.26 -0.20 L0.26 -0.20 M-0.26 0 L0.26 0 M-0.26 0.20 L0.26 0.20" ${st}/>`;
    case "shield":
      return `<path d="M0 -0.38 L0.32 -0.24 L0.32 0.04 Q0.32 0.28 0 0.42 Q-0.32 0.28 -0.32 0.04 L-0.32 -0.24 Z" ${st}/>`;
    case "lamp":
      return `<path d="M0 -0.40 Q0.17 -0.14 0.10 0.06 Q0 0.20 -0.10 0.06 Q-0.17 -0.14 0 -0.40 Z" ${st}/>
        <path d="M-0.30 0.30 L0.30 0.30" ${st}/>`;
    case "lotus-heart":
      return `<path d="M0 0.10 Q-0.32 -0.08 -0.20 -0.30 Q-0.08 -0.44 0 -0.26 Q0.08 -0.44 0.20 -0.30 Q0.32 -0.08 0 0.10 Z" ${st}/>
        <path d="M0 0.10 L0 0.32 M-0.20 0.36 L0.20 0.36" ${st}/>`;
    case "hearth":
      return `<path d="M-0.34 -0.02 L0 -0.34 L0.34 -0.02 L0.34 0.34 L-0.34 0.34 Z" ${st}/>
        <path d="M-0.10 0.34 L-0.10 0.10 L0.10 0.10 L0.10 0.34" ${st}/>`;
    case "ascending-path":
      return `<path d="M-0.36 0.34 L-0.36 0.10 L-0.12 0.10 L-0.12 -0.12 L0.12 -0.12 L0.12 -0.34 L0.36 -0.34" ${st}/>
        <circle cx="0.30" cy="-0.30" r="0.06" fill="currentColor" stroke="none"/>`;
  }
}

/** Blend two hex colours; `t` is the weight of the second colour. */
const mixHex = (a: string, b: string, t: number): string => {
  if (!a.startsWith("#") || !b.startsWith("#")) return a;
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  if (Number.isNaN(pa) || Number.isNaN(pb)) return a;
  const ch = (shift: number) => {
    const ca = (pa >> shift) & 255, cb = (pb >> shift) & 255;
    return Math.round(ca + (cb - ca) * t).toString(16).padStart(2, "0");
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
};

/** A row of focus emblems, each in its own ring, in its own area colour. */
function emblemRow(
  profiles: LifeAreaProfile[],
  colours: string[],
  cx: number,
  cy: number,
  d: number,
  sw: number,
): string {
  if (!profiles.length) return "";
  const step = d * 1.4;
  const s = d * 0.6;
  let out = "";
  for (let i = 0; i < profiles.length; i++) {
    const x = cx + (i - (profiles.length - 1) / 2) * step;
    const colour = colours[i] ?? colours[0] ?? "";
    out += `<g transform="translate(${x.toFixed(1)} ${cy.toFixed(1)})">
      <circle cx="0" cy="0" r="${(d * 0.46).toFixed(1)}" fill="none" stroke="${colour}" stroke-width="${(sw * 0.9).toFixed(2)}" opacity="0.9"/>
      <g transform="scale(${s.toFixed(2)})" color="${colour}" stroke="${colour}">${emblemShape(profiles[i].emblem, (sw * 1.05) / s)}</g>
    </g>`;
  }
  return out;
}

/* ---------------------------------------------------------------- mandala */

function petals(cx: number, cy: number, r0: number, r1: number, n: number, sw: number, colour: string) {
  let out = "";
  for (let i = 0; i < n; i++) {
    const a = (i * 360) / n;
    const mid = ((r0 + r1) / 2);
    out += `<ellipse cx="${cx}" cy="${cy - mid}" rx="${(r1 - r0) / 2.6}" ry="${(r1 - r0) / 2}"
      transform="rotate(${a} ${cx} ${cy})" fill="none" stroke="${colour}" stroke-width="${sw}"/>`;
  }
  return out;
}

function bhupura(cx: number, cy: number, r: number, sw: number, colour: string) {
  const s = r;
  const g = r * 0.16;
  return `<rect x="${cx - s}" y="${cy - s}" width="${2 * s}" height="${2 * s}" fill="none" stroke="${colour}" stroke-width="${sw * 1.6}"/>
    <rect x="${cx - s * 0.9}" y="${cy - s * 0.9}" width="${1.8 * s}" height="${1.8 * s}" fill="none" stroke="${colour}" stroke-width="${sw * 0.7}"/>
    <path d="M${cx - g} ${cy - s} L${cx + g} ${cy - s} L${cx + g} ${cy - s * 0.82} L${cx - g} ${cy - s * 0.82} Z
             M${cx - g} ${cy + s} L${cx + g} ${cy + s} L${cx + g} ${cy + s * 0.82} L${cx - g} ${cy + s * 0.82} Z
             M${cx - s} ${cy - g} L${cx - s} ${cy + g} L${cx - s * 0.82} ${cy + g} L${cx - s * 0.82} ${cy - g} Z
             M${cx + s} ${cy - g} L${cx + s} ${cy + g} L${cx + s * 0.82} ${cy + g} L${cx + s * 0.82} ${cy - g} Z"
      fill="none" stroke="${colour}" stroke-width="${sw}"/>`;
}

/** A bhava house the poster lights up for the querent's focus area. */
interface HouseHighlight {
  house: number;
  name: string;
  colour: string;
}

/**
 * The twelve cells of the north-indian kundli, in unit-square fractions.
 *
 * The two full diagonals and the inner midpoint-diamond cut the square into
 * four central rhombi (one house each) and eight corner triangles (two houses
 * each). These polygons are the real regions, so a label can be measured
 * against the boundaries it has to live inside.
 */
const HOUSE_CELLS: [number, number][][] = [
  [[0.5, 0], [0.75, 0.25], [0.5, 0.5], [0.25, 0.25]],
  [[0, 0], [0.5, 0], [0.25, 0.25]],
  [[0, 0], [0, 0.5], [0.25, 0.25]],
  [[0, 0.25], [0.25, 0.5], [0.5, 0.25], [0.25, 0]],
  [[0, 1], [0, 0.5], [0.25, 0.75]],
  [[0, 1], [0.5, 1], [0.25, 0.75]],
  [[0.25, 0.5], [0.5, 0.75], [0.75, 0.5], [0.5, 0.5]],
  [[1, 1], [0.5, 1], [0.75, 0.75]],
  [[1, 1], [1, 0.5], [0.75, 0.75]],
  [[0.75, 0.25], [1, 0.5], [0.75, 0.75], [0.5, 0.5]],
  [[1, 0], [1, 0.5], [0.75, 0.25]],
  [[1, 0], [0.5, 0], [0.75, 0.25]],
];

/**
 * The horizontal extent of a cell at one height, in unit-square fractions.
 * Returns null when that row does not cross the cell at all.
 */
const cellSpan = (poly: [number, number][], row: number): [number, number] | null => {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    if (y1 === y2) {
      if (y1 === row) { lo = Math.min(lo, x1, x2); hi = Math.max(hi, x1, x2); }
      continue;
    }
    const t = (row - y1) / (y2 - y1);
    if (t < 0 || t > 1) continue;
    const x = x1 + t * (x2 - x1);
    lo = Math.min(lo, x);
    hi = Math.max(hi, x);
  }
  return lo <= hi ? [lo, hi] : null;
};

/** How far below its cell's centroid the focus bhava name sits. */
const LABEL_DROP = 0.062;

/** North-Indian (diamond) kundli of the real whole-sign placements.
 *
 *  The two full diagonals plus the inner midpoint-diamond cut the square into
 *  twelve cells: four central rhombi and eight corner triangles. Every label is
 *  anchored on its cell's centroid (never on a dividing line) and drawn as one
 *  centred line — sign number in the soft tint, planet glyphs in the strong
 *  tint — so the sign and the abbreviations can no longer stack into each other
 *  or spill across the diagonals. */
function kundli(
  ch: Chart, x: number, y: number, S: number, colour: string, soft: string, sw: number,
  highlights?: HouseHighlight[],
) {
  // house index -> cell centroid, in unit-square fractions of the square.
  const houseAt: [number, number][] = [
    [0.500, 0.250], [0.250, 0.083], [0.083, 0.250], [0.250, 0.500],
    [0.083, 0.750], [0.250, 0.917], [0.500, 0.750], [0.750, 0.917],
    [0.917, 0.750], [0.750, 0.500], [0.917, 0.250], [0.750, 0.083],
  ];
  const lit = new Map<number, HouseHighlight>();
  for (const hl of highlights ?? []) if (!lit.has(hl.house)) lit.set(hl.house, hl);
  // one centred line for the sign number and the planet glyphs; the size
  // steps down only when a crowded house would be wider than the widest band
  // of its triangular cell.
  const signSize = (h: number) => {
    const names = ch.houses[h].planets.map((k) => GRAHAS[k].symbol).join(" ");
    const chars = String(ch.houses[h].signIndex + 1).length + (names ? names.length + 1 : 0);
    return S * (chars > 10 ? 0.040 : 0.048);
  };
  /* The bhava name of a focused house is sized FIRST, because the highlight
     ring has to enclose the sign line AND the name together: the ring can
     then never cut through the very word it is pointing at. The size is the
     largest the cell allows - the label is measured against the real cell
     polygon at its own baseline, and it has to clear the sign number above
     it. The old 3.6% of the cell was illegible on a phone poster. */
  const labels = new Map<number, { size: number; x: number; y: number }>();
  for (const hl of lit.values()) {
    const h = hl.house - 1;
    const [fx, fy] = houseAt[h];
    const span = cellSpan(HOUSE_CELLS[h], fy + LABEL_DROP);
    const half = span ? Math.min(fx - span[0], span[1] - fx) : 0;
    const room = half * 2 * S * 0.98;
    const wanted = S * 0.062;
    const clear = (LABEL_DROP * S - signSize(h) * 0.15 - 3) / 0.78;
    const size = Math.max(
      8,
      Math.min(wanted, clear, room / Math.max(1, hl.name.length) / GLYPH_EM),
    );
    labels.set(hl.house, { size, x: x + fx * S, y: y + fy * S + S * LABEL_DROP });
  }
  let out = `<rect x="${x}" y="${y}" width="${S}" height="${S}" fill="none" stroke="${colour}" stroke-width="${sw * 1.4}"/>
    <path d="M${x} ${y} L${x + S} ${y + S} M${x + S} ${y} L${x} ${y + S}
             M${x + S / 2} ${y} L${x + S} ${y + S / 2} L${x + S / 2} ${y + S} L${x} ${y + S / 2} Z"
      fill="none" stroke="${colour}" stroke-width="${sw}"/>`;
  // the "whole-sign houses" caption now sits on a baseline of its own just above
  // the square, so the footer beneath the square never competes with it.
  out += `<text x="${x + S / 2}" y="${y - S * 0.055}" fill="${soft}" font-size="${S * 0.042}" text-anchor="middle"
    letter-spacing="${S * 0.004}" font-family="${DEV}">LAGNA ${esc(rashiOf(ch.lagna.signIndex).name.toUpperCase())} · WHOLE-SIGN HOUSES</text>`;
  // the focus bhava: a soft glow and a bright ring around the house the
  // querent's area governs. The planet glyphs inside are left exactly as the
  // engine produced them - the ring only says WHICH house the poster is about.
  for (const hl of lit.values()) {
    const h = hl.house - 1;
    const [fx, fy] = houseAt[h];
    const px = x + fx * S, py = y + fy * S;
    const lab = labels.get(hl.house);
    // the glow and its ring are kept inside the square of the kundli, so a
    // house on the rim can never bleed past the frame.
    const rx = Math.max(S * 0.05, Math.min(S * 0.135, fx * S - sw * 2, (1 - fx) * S - sw * 2));
    const glowRy = Math.max(S * 0.03, Math.min(S * 0.078, fy * S - sw * 2, (1 - fy) * S - sw * 2));
    // the ring encloses the sign line AND the bhava name, so it never crosses
    // the letters it is meant to point at.
    const top = py - signSize(h) * 0.80;
    const bottom = lab ? lab.y + lab.size * 0.28 : py + signSize(h) * 0.3;
    const ringRy = Math.max(S * 0.03, (bottom - top) / 2 + S * 0.012);
    out += `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${glowRy.toFixed(1)}" fill="${hl.colour}" opacity="0.20"/>
      <ellipse cx="${px.toFixed(1)}" cy="${((top + bottom) / 2).toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ringRy.toFixed(1)}" fill="none" stroke="${hl.colour}" stroke-width="${(sw * 1.05).toFixed(2)}" opacity="0.95"/>`;
  }
  for (let h = 0; h < 12; h++) {
    const [fx, fy] = houseAt[h];
    const px = x + fx * S, py = y + fy * S;
    const sign = ch.houses[h].signIndex + 1;
    const names = ch.houses[h].planets.map((k) => GRAHAS[k].symbol).join(" ");
    const size = signSize(h);
    const hl = lit.get(h + 1);
    out += `<text x="${px.toFixed(1)}" y="${py.toFixed(1)}" text-anchor="middle" font-family="${DEV}"
      font-size="${size.toFixed(1)}"><tspan fill="${hl ? hl.colour : soft}">${sign}</tspan>${names ? ` <tspan fill="${colour}">${esc(names)}</tspan>` : ""}</text>`;
    const lab = hl ? labels.get(h + 1) : undefined;
    if (hl && lab) {
      out += `<text x="${lab.x.toFixed(1)}" y="${lab.y.toFixed(1)}" fill="${hl.colour}" font-size="${lab.size.toFixed(1)}" text-anchor="middle" font-family="${DEV}" opacity="0.95">${esc(hl.name)}</text>`;
    }
  }
  return out;
}

/* ---------------------------------------------------------------- wallpaper */

export function buildWallpaperSvg(o: WallpaperOptions): string {
  const { chart: ch, width: w, height: h } = o;
  const preset: StylePreset = presetById(o.presetId);
  const g = GRAHAS[ch.rulingPlanet];
  const c = g.colour;
  const ink = preset.ink(c), soft = preset.inkSoft(c), rule = preset.rule(c);
  const portrait = h >= w;
  const sw = (Math.min(w, h) / 900) * preset.lineWeight;

  const nak = ch.moonNakshatra;
  const dev = "'Noto Sans Devanagari', serif";
  const display = preset.displayFont === "serif"
    ? `'Cinzel', ${dev}` : `${dev}, system-ui, sans-serif`;
  const upper = preset.uppercase ? (s: string) => s.toUpperCase() : (s: string) => s;
  const ls = preset.letterSpacing * (w / 1170);

  /* ---- the querent's focus areas ---------------------------------------
     The focus is the reason this poster exists for this person, so it has to
     be visible IN the artwork and not only in the AI prompt. Everything below
     is read from the chart: the house a life area governs is a classical
     bhava, and the planets named in the focus band are the planets the
     engine actually placed in that house of THIS chart. Nothing is invented.
     With no focus areas selected the poster is byte-for-byte what it was. */
  const areaColour = (p: LifeAreaProfile) => (preset.dark ? p.accent : p.deep);
  const focus = lifeAreaProfiles(o.focusAreas ?? []);
  const focusProfile = focus[0] ?? null;
  const focusColour = focusProfile ? areaColour(focusProfile) : "";
  // at most three areas are drawn: more than that would crowd the kundli and
  // the footer, and the band says how many were left out.
  const focusAreas = focus.slice(0, 3);
  const focusHighlights: HouseHighlight[] = focusAreas.map((p) => ({
    house: p.house,
    name: houseBhavaName(p.house),
    colour: areaColour(p),
  }));
  const focusBand = focusAreas.map((p) => {
    const house = ch.houses[p.house - 1];
    const planets = house.planets.length
      ? house.planets.map((k) => GRAHAS[k].name.toUpperCase()).join(", ")
      : "no planets";
    return {
      colour: areaColour(p),
      text: `FOCUS · ${p.sanskrit.toUpperCase()} · ${p.houseName} HOUSE · ${planets}`,
    };
  });
  const focusExtra = focus.length > focusBand.length
    ? `+${focus.length - focusBand.length} MORE FOCUS AREAS`
    : "";

  /* ---- AI art base layer (frozen composite contract) ----------------------
     `backgroundImageUrl` is a self-contained data URL; the guard rejects an
     external URL, so the export through `svgToPngBlob` stays untainted. It is
     drawn cover-fit as the FIRST element, and both `href` (SVG2) and
     `xlink:href` (SVG1.1, and some rasterisers) are emitted so either loader
     resolves the bitmap. */
  const artUrl = o.backgroundImageUrl && o.backgroundImageUrl.startsWith("data:")
    ? o.backgroundImageUrl : "";
  const hasArt = artUrl.length > 0;
  const scrimColour = preset.dark ? "#05060a" : "#f6efe1";
  const art = hasArt
    ? `<image x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"
        href="${esc(artUrl)}" xlink:href="${esc(artUrl)}"/>`
    : "";
  const artScrim = hasArt
    ? `
  <rect width="${w}" height="${h}" fill="${scrimColour}" opacity="${(preset.artScrim * 0.62).toFixed(3)}"/>
  <rect width="${w}" height="${h}" fill="url(#artScrimCol)"/>`
    : "";

  /* ---- mandala + yantra group, centred at (mx,my) */
  const mx = portrait ? w / 2 : w * 0.30;
  const my = portrait ? h * 0.335 : h * 0.50;
  const R = portrait ? Math.min(w * 0.44, h * 0.24) : Math.min(h * 0.42, w * 0.26);

  /* Ornate mandala: ring weight and opacity vary by index, the outer ring is
     stroked with the foil gradient on dark presets, and the petals sit in three
     bands of different density so the disc reads as layered filigree. */
  let rings = "";
  for (let i = 0; i < preset.rings; i++) {
    const rr = R * (1 - i * 0.115);
    const outer = i === 0;
    const op = outer ? 0.95 : Math.max(0.18, 0.62 - i * 0.085);
    rings += `<circle cx="${mx}" cy="${my}" r="${rr.toFixed(2)}" fill="none"
      stroke="${outer ? (preset.dark ? "url(#foil)" : rule) : (i % 2 ? soft : rule)}"
      stroke-width="${(outer ? sw * 1.6 : sw * (i % 2 ? 0.5 : 0.8)).toFixed(2)}" opacity="${op.toFixed(2)}"/>`;
  }
  const petalBand = `<g opacity="0.86">${petals(mx, my, R * 0.60, R * 0.93, preset.petals, sw * 0.8, soft)}</g>`;
  const petalBand1b = preset.rings >= 3
    ? `<g opacity="0.48">${petals(mx, my, R * 0.46, R * 0.60, preset.petals, sw * 0.45, rule)}</g>` : "";
  const petalBand2 = preset.rings > 3
    ? `<g opacity="0.58">${petals(mx, my, R * 0.30, R * 0.54, Math.round(preset.petals / 2), sw * 0.7, soft)}</g>` : "";
  let dotsRing = "";
  if (preset.texture !== "none") {
    const n = preset.petals * 2;
    for (let i = 0; i < n; i++) {
      const a = (i * 360) / n * Math.PI / 180;
      dotsRing += `<circle cx="${(mx + Math.cos(a) * R * 1.045).toFixed(2)}" cy="${(my + Math.sin(a) * R * 1.045).toFixed(2)}"
        r="${(sw * 1.5).toFixed(2)}" fill="${rule}" opacity="${(0.4 + (i % 3) * 0.2).toFixed(2)}"/>`;
    }
  }
  /* ---- the yantra itself: the ruling planet's magic square */
  const yantraSide = R * (portrait ? 1.12 : 1.15);
  const yx = mx - yantraSide / 2, yy = my - yantraSide / 2;
  let yantra = "";
  if (g.yantra) {
    const sq = g.yantra.square;
    const n = sq.length;
    const cell = yantraSide / n;
    yantra += `<rect x="${yx}" y="${yy}" width="${yantraSide}" height="${yantraSide}" fill="${c.deep}"
      fill-opacity="0.55" stroke="${rule}" stroke-width="${sw * 1.8}"/>`;
    for (let i = 1; i < n; i++) {
      yantra += `<line x1="${yx + i * cell}" y1="${yy}" x2="${yx + i * cell}" y2="${yy + yantraSide}" stroke="${soft}" stroke-width="${sw * 0.55}" opacity="0.75"/>`;
      yantra += `<line x1="${yx}" y1="${yy + i * cell}" x2="${yx + yantraSide}" y2="${yy + i * cell}" stroke="${soft}" stroke-width="${sw * 0.55}" opacity="0.75"/>`;
    }
    for (let r = 0; r < n; r++) {
      for (let cix = 0; cix < n; cix++) {
        const v = sq[r][cix];
        yantra += `<text x="${(yx + (cix + 0.5) * cell).toFixed(1)}" y="${(yy + (r + 0.55) * cell).toFixed(1)}"
          fill="${r === cix ? c.glow : ink}" font-size="${(cell * 0.42).toFixed(1)}" text-anchor="middle"
          font-family="${dev}" opacity="${r === cix ? 1 : 0.92}">${v}</text>`;
      }
    }
  } else {
    // Rāhu / Ketu: no classical square — geometric yantra (bhūpura, lotus, triangles, bindu)
    const s = yantraSide / 2;
    yantra += `<rect x="${yx}" y="${yy}" width="${yantraSide}" height="${yantraSide}" fill="${c.deep}" fill-opacity="0.5"
      stroke="${rule}" stroke-width="${sw * 1.8}"/>
      <path d="M${mx} ${my - s} L${mx + s} ${my + s * 0.6} L${mx - s} ${my + s * 0.6} Z
               M${mx} ${my + s} L${mx + s} ${my - s * 0.6} L${mx - s} ${my - s * 0.6} Z"
        fill="none" stroke="${soft}" stroke-width="${sw * 0.9}" opacity="0.85"/>
      <circle cx="${mx}" cy="${my}" r="${s * 0.30}" fill="none" stroke="${rule}" stroke-width="${sw}"/>
      <circle cx="${mx}" cy="${my}" r="${sw * 2.4}" fill="${c.glow}"/>`;
  }

  /* the nakshatra motif is placed AFTER the name has been measured - see the
     motif box below, which is derived from the real text geometry. */

  /* ---- star field */
  let stars = "";
  if (preset.starField > 0) {
    let seed = 20260814;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (let i = 0; i < preset.starField; i++) {
      const x = rnd() * w, y = rnd() * h, r = rnd() * sw * 1.4 + sw * 0.3;
      stars += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(2)}" fill="${preset.dark ? "#ffffff" : c.deep}" opacity="${(0.10 + rnd() * 0.30).toFixed(2)}"/>`;
    }
  }

  /* ---- texture */
  let texture = "";
  if (preset.texture === "grain") {
    texture = `<rect width="${w}" height="${h}" filter="url(#grain)" opacity="0.20"/>`;
  } else if (preset.texture === "dots") {
    const step = Math.round(w / 46);
    texture = `<pattern id="dotgrid" width="${step}" height="${step}" patternUnits="userSpaceOnUse">
        <circle cx="${step / 2}" cy="${step / 2}" r="${(step * 0.035).toFixed(2)}" fill="${rule}" opacity="0.55"/></pattern>
      <rect width="${w}" height="${h}" fill="url(#dotgrid)"/>`;
  } else if (preset.texture === "rays") {
    let rays = "";
    for (let i = 0; i < 36; i++) {
      const a = (i * 10) * Math.PI / 180;
      rays += `<line x1="${mx + Math.cos(a) * R * 1.12}" y1="${my + Math.sin(a) * R * 1.12}"
        x2="${mx + Math.cos(a) * Math.max(w, h)}" y2="${my + Math.sin(a) * Math.max(w, h)}"
        stroke="${rule}" stroke-width="${sw * 0.5}" opacity="0.14"/>`;
    }
    texture = rays;
  }

  /* ---- frame + delicate foil corner filigree */
  const pad = w * (portrait ? 0.055 : 0.035);
  const frame = `<rect x="${pad}" y="${pad}" width="${w - 2 * pad}" height="${h - 2 * pad}" fill="none"
      stroke="${preset.dark ? "url(#foil)" : rule}" stroke-width="${sw * 1.6}"/>
    <rect x="${pad * 1.06}" y="${pad * 1.06}" width="${w - 2.12 * pad}" height="${h - 2.12 * pad}" fill="none"
      stroke="${rule}" stroke-width="${sw * 0.45}" opacity="0.55"/>
    <rect x="${pad * 1.35}" y="${pad * 1.35}" width="${w - 2.7 * pad}" height="${h - 2.7 * pad}" fill="none"
      stroke="${soft}" stroke-width="${sw * 0.6}" opacity="0.75"/>`;

  // the focus colour enters the frame as a BLEND with the chart's own rule
  // colour, so the poster's identity shifts with the area while the chart
  // palette stays dominant and truthful.
  const filigRule = focus.length ? mixHex(rule, focusColour, 0.5) : rule;
  const filig = (() => {
    const inset = pad * 2.1, a = w * 0.038;
    const corners: [number, number, number, number][] = [
      [inset, inset, 1, 1], [w - inset, inset, -1, 1],
      [inset, h - inset, 1, -1], [w - inset, h - inset, -1, -1],
    ];
    return corners.map(([cx, cy, sx, sy]) => `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})">
      <path d="M0 ${(sy * a).toFixed(1)} L0 ${(sy * a * 0.35).toFixed(1)} Q0 0 ${(sx * a * 0.35).toFixed(1)} 0 L${(sx * a).toFixed(1)} 0"
        fill="none" stroke="${filigRule}" stroke-width="${(sw * 0.7).toFixed(2)}" opacity="0.72" stroke-linecap="round"/>
      <circle cx="${(sx * a * 1.16).toFixed(1)}" cy="${(sy * a * 1.16).toFixed(1)}" r="${(sw * 1.25).toFixed(2)}" fill="${filigRule}" opacity="0.7"/>
      <circle cx="${(sx * a * 0.46).toFixed(1)}" cy="${(sy * a * 0.46).toFixed(1)}" r="${(sw * 0.75).toFixed(2)}" fill="${soft}" opacity="0.55"/>
    </g>`).join("");
  })();
  /* ---- text blocks: name > Devanagari nakshatra > pada syllable > mantra >
     footer, one explicit baseline per line with a generous gap, so nothing can
     ever overprint or overflow. The translucent card behind the centre column,
     the halos behind the name and the big Devanagari name, and the fitGlyphs /
     wrapToWidth caps make it read as a designed poster at any frame size. */
  const fz = (f: number) => (f * w) / 1170;
  const nameStr = upper(ch.input.name.trim() || "Your Name");
  /* The corner filigree sits in the same band as the name, so the name is
     capped short of it: the ornaments and the person's name can never
     overprint, whatever the name happens to be. */
  const cornerHalf = w * 0.026;
  const cornerInner = pad * 2.1 - cornerHalf;
  const cornerInnerRight = w - pad * 2.1 - cornerHalf;
  const nameLimit = preset.cornerMotifs
    ? (portrait ? (w / 2 - cornerInner) * 2 - 24 : cornerInnerRight - w * 0.56 - 12)
    : Number.POSITIVE_INFINITY;
  const nameCap = Math.max(
    120,
    Math.min(portrait ? w - 2 * pad * 1.5 : w - pad * 1.6 - w * 0.56, nameLimit),
  );
  const nameSize = portrait ? fz(96) : fz(70);
  const nameText = portrait
    ? { x: w / 2, y: pad + fz(158), size: fitGlyphs(nameSize, nameStr, nameCap, ls), anchor: "middle" }
    : { x: w * 0.56, y: h * 0.18, size: fitGlyphs(nameSize, nameStr, nameCap, ls), anchor: "start" };
  const name = esc(nameStr);
  const nameCx = nameText.anchor === "middle"
    ? nameText.x
    : nameText.x + Math.min(nameCap, nameStr.length * GLYPH_EM * nameText.size) * 0.5;
  const nameHalo = `<ellipse cx="${nameCx.toFixed(1)}" cy="${(nameText.y - nameText.size * 0.30).toFixed(1)}"
    rx="${Math.min(nameCap * 0.46, nameText.size * Math.max(3, nameStr.length) * 0.42).toFixed(1)}"
    ry="${(nameText.size * 0.88).toFixed(1)}" fill="url(#halo)" opacity="0.9"/>`;

  /* ---- the nakshatra motif ------------------------------------------------
     The motif is the chart's own symbol, so it belongs on the poster - but it
     must NEVER touch the person's name. It is therefore placed in a band that
     is measured from the geometry rather than a hard-coded offset: the strip
     between the bottom of the name block and the top of the mandala in the
     portrait, and the crest strip above the name in the landscape (where the
     name heads the right-hand column). The motif is scaled to fit that band
     and dropped entirely when the band is too small to hold it. */
  const motifBox = (() => {
    const maxSize = R * 0.30;
    const minSize = 12;
    if (portrait) {
      const nameBottom = nameText.y + nameText.size * 0.28;
      const mandalaTop = my - R * 1.06;
      const top = Math.max(nameBottom, pad * 1.35) + 5;
      const bottom = mandalaTop - 5;
      const band = bottom - top;
      if (band < minSize + 6) return null;
      const size = Math.min(maxSize, band - 6, R * 0.24);
      if (size < minSize) return null;
      return { cx: mx, cy: (top + bottom) / 2, size };
    }
    const nameTop = nameText.y - nameText.size * 0.84;
    const top = pad * 1.35;
    const bottom = nameTop - 8;
    const band = bottom - top;
    if (band < minSize + 6) return null;
    const size = Math.min(maxSize, band - 6, w * 0.05);
    if (size < minSize) return null;
    return { cx: nameCx, cy: (top + bottom) / 2, size };
  })();
  const motif = motifBox
    ? `<g transform="translate(${motifBox.cx.toFixed(1)} ${motifBox.cy.toFixed(1)}) scale(${motifBox.size.toFixed(1)})"
      color="${c.glow}" stroke="${c.glow}">${motifShape(nak.motif, (sw * 1.6) / motifBox.size)}</g>`
    : "";

  const place = `${esc(ch.input.place)}`;
  // A poster drawn from data nobody supplied says so on its own face: the
  // birth line carries the SAMPLE mark, so a demo chart can never be taken
  // for somebody's real kundli.
  const birthLine = `${new Date(ch.utc.getTime() + ch.offsetMinutes * 60000).toISOString().slice(0, 10).split("-").reverse().join(" ")} · ${ch.input.time} · ${place}${o.sample ? " · SAMPLE DATA" : ""}`;

  let body = "";
  let cardTop = 0, cardBottom = 0, cardX0 = 0, cardX1 = 0;
  if (portrait) {
    const tx = w / 2;
    const fwFull = w - 2 * pad * 1.5;
    const headStr = upper("Moon in " + nak.name + " · pada " + ch.moonPada + " · " + rashiOf(ch.moonSign).name);
    const padaStr = upper("PADA SYLLABLE " + nak.syllablesRoman[ch.moonPada - 1] + " · DEITY " + nak.deityRoman + " · SYMBOL " + nak.symbol);
    const devSize = fz(82);
    let y = my + R + fz(96);
    if (focus.length) {
      // the emblem badge lives in the gap between the mandala and the
      // nakshatra headline, measured from the very numbers those two use, so
      // it can never touch the mandala, the headline or the kundli.
      const mandalaBottom = my + R * (preset.texture === "none" ? 1 : 1.045);
      const headlineTop = y - fz(28) * 0.8;
      const gap = Math.max(0, headlineTop - mandalaBottom);
      const badgeD = Math.max(12, Math.min(fz(38), gap - fz(10)));
      body += emblemRow(focusAreas, focusAreas.map(areaColour), tx, mandalaBottom + fz(4) + badgeD / 2, badgeD, sw);
    }
    body += `<text x="${tx}" y="${y}" fill="${ink}" font-size="${fitGlyphs(fz(28), headStr, fwFull, ls)}" text-anchor="middle"
      font-family="${display}" letter-spacing="${ls}">${esc(headStr)}</text>`;
    y += fz(112);
    const devRx = Math.min(nak.devanagari.length * devSize * 0.42, fwFull * 0.55);
    body += `<ellipse cx="${tx}" cy="${(y - devSize * 0.30).toFixed(1)}" rx="${devRx.toFixed(1)}" ry="${(devSize * 0.95).toFixed(1)}" fill="url(#halo)"/>`;
    body += `<text x="${tx}" y="${y}" fill="${c.glow}" font-size="${devSize}" text-anchor="middle"
      font-family="${dev}">${esc(nak.devanagari)}</text>`;
    y += fz(92);
    body += `<text x="${tx}" y="${y}" fill="${soft}" font-size="${fz(48)}" text-anchor="middle"
      font-family="${dev}">${esc(nak.syllables[ch.moonPada - 1])}</text>`;
    y += fz(54);
    body += `<text x="${tx}" y="${y}" fill="${soft}" font-size="${fitGlyphs(fz(22), padaStr, fwFull, ls * 0.8)}" text-anchor="middle"
      font-family="${display}" letter-spacing="${ls * 0.8}">${esc(padaStr)}</text>`;
    y += fz(72);
    body += `<text x="${tx}" y="${y}" fill="${ink}" font-size="${fz(44)}" text-anchor="middle"
      font-family="${dev}">${esc(g.mantra.devanagari)}</text>`;
    y += fz(50);
    body += `<text x="${tx}" y="${y}" fill="${soft}" font-size="${fitGlyphs(fz(26), g.mantra.roman, fwFull)}" text-anchor="middle"
      font-family="${dev}">${esc(g.mantra.roman)}</text>`;
    y += fz(38);
    body += `<text x="${tx}" y="${y}" fill="${soft}" font-size="${fitGlyphs(fz(20), g.mantra.gloss, fwFull)}" text-anchor="middle"
      font-family="${dev}" opacity="0.85">${esc(g.mantra.gloss)}</text>`;

    const kundliTop = y + fz(52);
    /* The footer block is ALWAYS the birth line, the lagna tail and the
       yantra note. The focus band is ADDED under the note - it never
       replaces it - and the kundli gives up exactly the height of the whole
       block, so the last line of the footer always lands inside the frame,
       with or without a focus area. */
    const footBase = fz(36) + fz(28) + fz(26);
    const focusBandH = focus.length
      ? fz(30) + focusBand.length * fz(26) + (focusExtra ? fz(20) : 0)
      : 0;
    const footBudget = footBase + focusBandH + fz(16);
    const S = Math.max(fz(120), Math.min(w * 0.56, h * 0.166, h - pad * 1.35 - footBudget - kundliTop));
    body += kundli(ch, w / 2 - S / 2, kundliTop, S, rule, soft, sw, focusHighlights);
    const lagnaTail = `LAGNA ${rashiOf(ch.lagna.signIndex).name} ${dms(ch.lagna.degreeInSign)} · RULING PLANET ${g.name}`;
    const note = upper(g.yantraNote);
    let fy = kundliTop + S + fz(36);
    body += `<text x="${tx}" y="${fy}" fill="${soft}" font-size="${fitGlyphs(fz(22), birthLine, fwFull, ls * 0.7)}" text-anchor="middle"
      font-family="${display}" letter-spacing="${ls * 0.7}">${esc(upper(birthLine))}</text>`;
    fy += fz(28);
    body += `<text x="${tx}" y="${fy}" fill="${soft}" font-size="${fitGlyphs(fz(19), lagnaTail, fwFull, ls * 0.5)}" text-anchor="middle"
      font-family="${display}" letter-spacing="${ls * 0.5}" opacity="0.85">${esc(upper(lagnaTail))}</text>`;
    fy += fz(26);
    body += `<text x="${tx}" y="${fy}" fill="${soft}" font-size="${fitGlyphs(fz(17), note, fwFull, ls * 0.4)}" text-anchor="middle"
      font-family="${display}" letter-spacing="${ls * 0.4}" opacity="0.8">${esc(note)}</text>`;
    if (focus.length) {
      // the focus band: the area, its classical bhava, and the planets that
      // are actually in that house of this chart.
      fy += fz(30);
      for (const band of focusBand) {
        fy += fz(26);
        body += `<text x="${tx}" y="${fy}" fill="${band.colour}" font-size="${fitGlyphs(fz(20), band.text, fwFull, ls * 0.5)}" text-anchor="middle"
          font-family="${display}" letter-spacing="${ls * 0.5}">${esc(band.text)}</text>`;
      }
      if (focusExtra) {
        fy += fz(20);
        body += `<text x="${tx}" y="${fy}" fill="${focusColour}" font-size="${fitGlyphs(fz(15), focusExtra, fwFull, ls * 0.4)}" text-anchor="middle"
          font-family="${display}" letter-spacing="${ls * 0.4}" opacity="0.85">${esc(focusExtra)}</text>`;
      }
    }

    cardX0 = pad * 1.35; cardX1 = w - pad * 1.35;
    cardTop = Math.max(nameText.y - nameText.size * 1.15, pad * 1.35);
    cardBottom = fy + fz(18);
  } else {
    const x0 = w * 0.56, right = w - pad * 1.6;
    const fwCol = right - x0;
    const headStr = upper("Moon in " + nak.name + " · pada " + ch.moonPada + " · " + rashiOf(ch.moonSign).name);
    const devSize = fz(66);
    let y = h * 0.235;
    body += `<text x="${x0}" y="${y}" fill="${ink}" font-size="${fitGlyphs(fz(28), headStr, fwCol, ls * 0.6)}" font-family="${display}"
      letter-spacing="${ls * 0.6}">${esc(headStr)}</text>`;
    y += focus.length ? fz(72) : fz(92);
    const devRx = Math.min(nak.devanagari.length * devSize * 0.42, fwCol * 0.7);
    body += `<ellipse cx="${(x0 + devRx * 0.5).toFixed(1)}" cy="${(y - devSize * 0.30).toFixed(1)}" rx="${devRx.toFixed(1)}" ry="${(devSize * 0.95).toFixed(1)}" fill="url(#halo)"/>`;
    body += `<text x="${x0}" y="${y}" fill="${c.glow}" font-size="${devSize}" font-family="${dev}">${esc(nak.devanagari)}</text>`;
    y += focus.length ? fz(60) : fz(80);
    body += `<text x="${x0}" y="${y}" fill="${soft}" font-size="${fz(36)}" font-family="${dev}">${esc(nak.syllables[ch.moonPada - 1])}</text>`;
    const padaCap = upper(nak.syllablesRoman[ch.moonPada - 1] + " · " + nak.deityRoman);
    body += `<text x="${x0 + fz(50)}" y="${y - fz(4)}" fill="${soft}" font-size="${fitGlyphs(fz(21), padaCap, fwCol - fz(58), ls * 0.6)}" font-family="${display}"
      letter-spacing="${ls * 0.6}">${esc(padaCap)}</text>`;
    y += focus.length ? fz(42) : fz(52);
    body += `<text x="${x0}" y="${y}" fill="${ink}" font-size="${fz(32)}" font-family="${dev}">${esc(g.mantra.devanagari)}</text>`;
    y += focus.length ? fz(34) : fz(44);
    body += `<text x="${x0}" y="${y}" fill="${soft}" font-size="${fitGlyphs(fz(22), g.mantra.roman, fwCol)}" font-family="${dev}">${esc(g.mantra.roman)}</text>`;
    y += focus.length ? fz(26) : fz(30);
    const kundliTop = y;
    // the focus band runs across the foot of the right-hand column, so the
    // kundli gives up exactly the room the band needs.
    const bandCount = focusBand.length + (focusExtra ? 1 : 0);
    const bandReserve = focus.length ? fz(10) + bandCount * fz(18) + fz(8) : 0;
    const S = Math.max(fz(120), Math.min(fwCol * 0.46, h - pad * 1.35 - kundliTop - fz(16) - bandReserve, h * 0.36));
    body += kundli(ch, x0, kundliTop, S, rule, soft, sw, focusHighlights);
    const fx = x0 + S + fz(40);
    const fw = right - fx;
    const lagnaTail = `LAGNA ${rashiOf(ch.lagna.signIndex).name} ${dms(ch.lagna.degreeInSign)} · RULING PLANET ${g.name}`;
    body += `<text x="${fx}" y="${kundliTop + fz(46)}" fill="${soft}" font-size="${fitGlyphs(fz(22), birthLine, fw, ls * 0.6)}" font-family="${display}"
      letter-spacing="${ls * 0.6}">${esc(upper(birthLine))}</text>`;
    body += `<text x="${fx}" y="${kundliTop + fz(78)}" fill="${soft}" font-size="${fitGlyphs(fz(20), lagnaTail, fw, ls * 0.5)}" font-family="${display}"
      letter-spacing="${ls * 0.5}" opacity="0.85">${esc(upper(lagnaTail))}</text>`;
    // the note is wrapped at the size it is PRINTED at, so a wrapped line can
    // never be wider than the column it lives in.
    const noteSize = fz(15);
    const noteLines = wrapToWidth(noteSize, upper(g.yantraNote), fw);
    let ny = kundliTop + fz(112);
    for (const ln of noteLines) {
      body += `<text x="${fx}" y="${ny}" fill="${soft}" font-size="${fitGlyphs(noteSize, ln, fw)}" font-family="${display}"
        opacity="0.8">${esc(ln)}</text>`;
      ny += fz(18);
    }
    if (focus.length) {
      // the emblem badge sits in the free space at the top of the right-hand
      // column, above the footer, clear of the kundli and of the band.
      const badgeN = focusAreas.length;
      const badgeD = Math.max(12, Math.min(fz(50), fz(46) - fz(10), (fw * 0.92) / (1.4 * badgeN - 0.4)));
      body += emblemRow(focusAreas, focusAreas.map(areaColour), fx + fw / 2, kundliTop + fz(5) + badgeD / 2, badgeD, sw);
      // the focus band itself: the area, its classical bhava, and the planets
      // that are actually in that house of this chart.
      const bandTop = Math.max(ny, kundliTop + S) + fz(8);
      const bandStep = Math.max(fz(11), Math.min(fz(18), (h - pad * 1.35 - fz(6) - bandTop) / Math.max(1, bandCount)));
      const bandFont = Math.min(fz(20), bandStep * 0.82);
      let by = bandTop;
      for (const band of focusBand) {
        body += `<text x="${x0}" y="${by}" fill="${band.colour}" font-size="${fitGlyphs(bandFont, band.text, fwCol, ls * 0.4)}" font-family="${display}"
          letter-spacing="${ls * 0.4}">${esc(band.text)}</text>`;
        by += bandStep;
      }
      if (focusExtra) {
        body += `<text x="${x0}" y="${by}" fill="${focusColour}" font-size="${fitGlyphs(Math.min(bandFont, fz(15)), focusExtra, fwCol, ls * 0.4)}" font-family="${display}"
          letter-spacing="${ls * 0.4}" opacity="0.85">${esc(focusExtra)}</text>`;
        by += bandStep;
      }
      ny = Math.max(ny, by);
    }
    cardX0 = x0 - fz(30); cardX1 = right + fz(18);
    cardTop = Math.max(nameText.y - nameText.size * 1.15, pad * 1.35);
    cardBottom = Math.max(kundliTop + S + fz(20), ny);
  }

  const cardRx = w * 0.022;
  const cardW = Math.max(0, cardX1 - cardX0);
  const cardH = Math.max(0, cardBottom - cardTop);
  const card = cardW > 0 && cardH > 0
    ? `<rect x="${cardX0.toFixed(1)}" y="${cardTop.toFixed(1)}" width="${cardW.toFixed(1)}" height="${cardH.toFixed(1)}"
        rx="${cardRx.toFixed(1)}" ry="${cardRx.toFixed(1)}" fill="${preset.dark ? "#000000" : "#ffffff"}" opacity="${preset.dark ? 0.22 : 0.28}"/>
      <rect x="${cardX0.toFixed(1)}" y="${cardTop.toFixed(1)}" width="${cardW.toFixed(1)}" height="${cardH.toFixed(1)}"
        rx="${cardRx.toFixed(1)}" ry="${cardRx.toFixed(1)}" fill="none" stroke="${rule}" stroke-width="${(sw * 0.6).toFixed(2)}" opacity="0.5"/>`
    : "";
const cornerMotifs = preset.cornerMotifs
    ? [[pad * 2.1, pad * 2.1], [w - pad * 2.1, pad * 2.1], [pad * 2.1, h - pad * 2.1], [w - pad * 2.1, h - pad * 2.1]]
      .map(([cx, cy]) => `<g transform="translate(${cx} ${cy}) scale(${(w * 0.052).toFixed(1)})" color="${rule}" stroke="${rule}">${motifShape("lotus", (sw * 1.4) / (w * 0.052))}</g>`)
      .join("") : "";

  const xlinkNs = hasArt ? ` xmlns:xlink="http://www.w3.org/1999/xlink"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg"${xlinkNs} width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="${o.className ?? ""}">
  <defs>
    <style>${o.fontFaceCss ?? ""}</style>
    <linearGradient id="bg" gradientTransform="rotate(${preset.bg.angle - 90} 0.5 0.5)">
      <stop offset="0%" stop-color="${preset.bg.from}"/>
      <stop offset="45%" stop-color="${preset.bg.via}"/>
      <stop offset="100%" stop-color="${preset.bg.to}"/>
    </linearGradient>
    <radialGradient id="aurora" cx="28%" cy="16%" r="86%">
      <stop offset="0%" stop-color="${c.accent}" stop-opacity="${preset.dark ? 0.26 : 0.14}"/>
      <stop offset="46%" stop-color="${c.accent}" stop-opacity="${preset.dark ? 0.08 : 0.05}"/>
      <stop offset="100%" stop-color="${c.accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="35%" r="70%">
      <stop offset="0%" stop-color="${c.accent}" stop-opacity="${preset.dark ? 0.30 : 0.20}"/>
      <stop offset="60%" stop-color="${c.accent}" stop-opacity="${preset.dark ? 0.10 : 0.06}"/>
      <stop offset="100%" stop-color="${c.accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${c.glow}" stop-opacity="${preset.dark ? 0.50 : 0.34}"/>
      <stop offset="45%" stop-color="${c.glow}" stop-opacity="${preset.dark ? 0.20 : 0.12}"/>
      <stop offset="100%" stop-color="${c.glow}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="foil" gradientTransform="rotate(38 0.5 0.5)">
      <stop offset="0%" stop-color="${rule}" stop-opacity="0.85"/>
      <stop offset="30%" stop-color="${c.glow}" stop-opacity="1"/>
      <stop offset="55%" stop-color="${rule}" stop-opacity="0.7"/>
      <stop offset="80%" stop-color="${c.glow}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${rule}" stop-opacity="0.8"/>
    </linearGradient>
    <radialGradient id="vig" cx="50%" cy="45%" r="78%">
      <stop offset="58%" stop-color="${preset.bg.vignette}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${preset.bg.vignette}" stop-opacity="${preset.dark ? 0.6 : 0.2}"/>
    </radialGradient>
    <radialGradient id="artScrimCol" cx="${portrait ? "50%" : "80%"}" cy="${portrait ? "68%" : "58%"}" r="${portrait ? "62%" : "46%"}">
      <stop offset="0%" stop-color="${scrimColour}" stop-opacity="${preset.artScrim}"/>
      <stop offset="55%" stop-color="${scrimColour}" stop-opacity="${(preset.artScrim * 0.6).toFixed(3)}"/>
      <stop offset="100%" stop-color="${scrimColour}" stop-opacity="0"/>
    </radialGradient>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>
  ${art}${artScrim}${hasArt ? "" : `<rect width="${w}" height="${h}" fill="url(#bg)"/>`}
  <rect width="${w}" height="${h}" fill="url(#aurora)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  ${stars}
  ${texture}
  ${card}
  ${frame}
  ${filig}
  ${cornerMotifs}
  ${rings}
  ${preset.bhupura ? bhupura(mx, my, R * 1.02, sw, soft) : ""}
  ${petalBand}
  ${petalBand1b}
  ${petalBand2}
  ${dotsRing}
  ${yantra}
  ${nameHalo}
  ${motif}
  <text x="${nameText.x}" y="${nameText.y}" fill="${ink}" font-size="${nameText.size}" text-anchor="${nameText.anchor}"
    font-family="${display}" letter-spacing="${ls}" font-weight="600">${name}</text>
  ${body}
  <rect width="${w}" height="${h}" fill="url(#vig)"/>
</svg>`;
}

/** Filename for a download, based on the person's own name. */
export function wallpaperFilename(ch: Chart, width: number, height: number): string {
  const slug = (ch.input.name.trim() || "nakshatra")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "nakshatra";
  const kind = width >= height ? "desktop" : "phone";
  return `nakshatra-canvas-${slug}-${kind}-${width}x${height}.png`;
}

/** Re-exported so callers can label the wallpaper without importing two modules. */
export { NAKSHATRAS };
