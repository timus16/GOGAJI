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

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const DEV = "'Noto Sans Devanagari', serif";

export interface WallpaperOptions {
  chart: Chart;
  presetId: string;
  width: number;
  height: number;
  /** @font-face rules; pass a data-URI version for exports */
  fontFaceCss?: string;
  /** exposed for the in-page preview */
  className?: string;
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

/** North-Indian (diamond) kundli of the real whole-sign placements. */
function kundli(ch: Chart, x: number, y: number, S: number, colour: string, soft: string, sw: number) {
  const P = (fx: number, fy: number) => [x + fx * S, y + fy * S] as const;
  const houseAt: [number, number][] = [
    [0.50, 0.26], [0.27, 0.11], [0.11, 0.27], [0.26, 0.50],
    [0.11, 0.73], [0.27, 0.89], [0.50, 0.74], [0.73, 0.89],
    [0.89, 0.73], [0.74, 0.50], [0.89, 0.27], [0.73, 0.11],
  ];
  let out = `<rect x="${x}" y="${y}" width="${S}" height="${S}" fill="none" stroke="${colour}" stroke-width="${sw * 1.4}"/>
    <path d="M${x} ${y} L${x + S} ${y + S} M${x + S} ${y} L${x} ${y + S}
             M${x + S / 2} ${y} L${x + S} ${y + S / 2} L${x + S / 2} ${y + S} L${x} ${y + S / 2} Z"
      fill="none" stroke="${colour}" stroke-width="${sw}"/>`;
  for (let h = 0; h < 12; h++) {
    const [fx, fy] = houseAt[h];
    const [px, py] = P(fx, fy);
    const signs = ch.houses[h].signIndex;
    const names = ch.houses[h].planets.map((k) => GRAHAS[k].symbol).join(" ");
    out += `<text x="${px}" y="${py - S * 0.012}" fill="${soft}" font-size="${S * 0.055}"
      text-anchor="middle" font-family="${DEV}">${signs + 1}</text>`;
    if (names) {
      out += `<text x="${px}" y="${py + S * 0.058}" fill="${colour}" font-size="${S * 0.062}"
        text-anchor="middle" font-family="${DEV}" letter-spacing="0.5">${esc(names)}</text>`;
    }
  }
  const [lx, ly] = P(0.5, 1.10);
  out += `<text x="${lx}" y="${ly}" fill="${soft}" font-size="${S * 0.05}" text-anchor="middle"
    letter-spacing="${S * 0.006}" font-family="${DEV}">LAGNA ${esc(rashiOf(ch.lagna.signIndex).name.toUpperCase())} · WHOLE-SIGN HOUSES</text>`;
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

  /* ---- mandala + yantra group, centred at (mx,my) */
  const mx = portrait ? w / 2 : w * 0.30;
  const my = portrait ? h * 0.335 : h * 0.50;
  const R = portrait ? Math.min(w * 0.44, h * 0.24) : Math.min(h * 0.42, w * 0.26);

  let rings = "";
  for (let i = 0; i < preset.rings; i++) {
    const rr = R * (1 - i * (0.115));
    rings += `<circle cx="${mx}" cy="${my}" r="${rr.toFixed(2)}" fill="none" stroke="${i === 0 ? rule : soft}"
      stroke-width="${(i === 0 ? sw * 1.5 : sw * 0.7).toFixed(2)}" opacity="${i === 0 ? 0.95 : 0.55}"/>`;
  }
  const petalBand = `<g>${petals(mx, my, R * 0.60, R * 0.93, preset.petals, sw * 0.8, soft)}</g>`;
  const petalBand2 = preset.rings > 3
    ? `<g>${petals(mx, my, R * 0.30, R * 0.54, Math.round(preset.petals / 2), sw * 0.7, soft)}</g>` : "";
  let dotsRing = "";
  if (preset.texture !== "none") {
    const n = preset.petals * 2;
    for (let i = 0; i < n; i++) {
      const a = (i * 360) / n * Math.PI / 180;
      dotsRing += `<circle cx="${(mx + Math.cos(a) * R * 1.045).toFixed(2)}" cy="${(my + Math.sin(a) * R * 1.045).toFixed(2)}"
        r="${(sw * 1.5).toFixed(2)}" fill="${rule}" opacity="0.8"/>`;
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

  const motif = `<g transform="translate(${mx} ${my - R - (portrait ? w * 0.085 : h * 0.10)}) scale(${(R * 0.30).toFixed(1)})"
      color="${c.glow}" stroke="${c.glow}">${motifShape(nak.motif, (sw * 1.6) / (R * 0.30))}</g>`;

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

  /* ---- frame */
  const pad = w * (portrait ? 0.055 : 0.035);
  const frame = `<rect x="${pad}" y="${pad}" width="${w - 2 * pad}" height="${h - 2 * pad}" fill="none"
      stroke="${rule}" stroke-width="${sw * 1.6}"/>
    <rect x="${pad * 1.35}" y="${pad * 1.35}" width="${w - 2.7 * pad}" height="${h - 2.7 * pad}" fill="none"
      stroke="${soft}" stroke-width="${sw * 0.6}" opacity="0.75"/>`;

  /* ---- text blocks */
  const fz = (f: number) => (f * w) / 1170;
  const nameText = portrait
    ? { x: w / 2, y: pad + fz(150), size: fz(74), anchor: "middle" }
    : { x: w * 0.56, y: h * 0.16, size: fz(64), anchor: "start" };
  const name = esc(upper(ch.input.name.trim() || "Your Name"));

  const place = `${esc(ch.input.place)}`;
  const birthLine = `${new Date(ch.utc.getTime() + ch.offsetMinutes * 60000).toISOString().slice(0, 10).split("-").reverse().join(" ")} · ${ch.input.time} · ${place}`;

  let body = "";
  if (portrait) {
    const tx = w / 2;
    let y = my + R + fz(140);
    body += `<text x="${tx}" y="${y}" fill="${ink}" font-size="${fz(30)}" text-anchor="middle"
      font-family="${display}" letter-spacing="${ls}">${esc(upper("Moon in " + nak.name + " · pada " + ch.moonPada + " · " + rashiOf(ch.moonSign).name))}</text>`;
    y += fz(86);
    body += `<text x="${tx}" y="${y}" fill="${c.glow}" font-size="${fz(92)}" text-anchor="middle"
      font-family="${dev}">${esc(nak.devanagari)}</text>`;
    body += `<text x="${tx + fz(150)}" y="${y - fz(58)}" fill="${soft}" font-size="${fz(58)}" text-anchor="middle"
      font-family="${dev}">${esc(nak.syllables[ch.moonPada - 1])}</text>`;
    y += fz(46);
    body += `<text x="${tx}" y="${y}" fill="${soft}" font-size="${fz(26)}" text-anchor="middle"
      font-family="${display}" letter-spacing="${ls * 0.8}">${esc(upper("PADA SYLLABLE " + nak.syllablesRoman[ch.moonPada - 1] + " · DEITY " + nak.deityRoman + " · SYMBOL " + nak.symbol))}</text>`;
    y += fz(78);
    body += `<text x="${tx}" y="${y}" fill="${ink}" font-size="${fz(56)}" text-anchor="middle"
      font-family="${dev}">${esc(g.mantra.devanagari)}</text>`;
    y += fz(44);
    body += `<text x="${tx}" y="${y}" fill="${soft}" font-size="${fz(28)}" text-anchor="middle"
      font-family="${dev}">${esc(g.mantra.roman)}</text>`;
    y += fz(30);
    body += `<text x="${tx}" y="${y}" fill="${soft}" font-size="${fz(22)}" text-anchor="middle"
      font-family="${dev}" opacity="0.85">${esc(g.mantra.gloss)}</text>`;
    // kundli
    const S = Math.min(w * 0.66, h * 0.20);
    body += kundli(ch, w / 2 - S / 2, h - pad - S - fz(96), S, rule, soft, sw);
    body += `<text x="${tx}" y="${h - pad - fz(30)}" fill="${soft}" font-size="${fz(23)}" text-anchor="middle"
      font-family="${display}" letter-spacing="${ls * 0.7}">${esc(upper(birthLine))}</text>`;
    body += `<text x="${tx}" y="${h - pad - fz(4)}" fill="${soft}" font-size="${fz(20)}" text-anchor="middle"
      font-family="${display}" letter-spacing="${ls * 0.6}" opacity="0.8">${esc(upper("LAGNA " + rashiOf(ch.lagna.signIndex).name + " " + dms(ch.lagna.degreeInSign) + " · RULING PLANET " + g.name + " · " + g.yantraNote))}</text>`;
  } else {
    const x0 = w * 0.56, right = w - pad * 1.6;
    let y = h * 0.235;
    body += `<text x="${x0}" y="${y}" fill="${ink}" font-size="${fz(30)}" font-family="${display}" letter-spacing="${ls}"
      >${esc(upper("Moon in " + nak.name + " · pada " + ch.moonPada + " · " + rashiOf(ch.moonSign).name))}</text>`;
    y += fz(96);
    body += `<text x="${x0}" y="${y}" fill="${c.glow}" font-size="${fz(88)}" font-family="${dev}">${esc(nak.devanagari)}</text>`;
    body += `<text x="${x0 + fz(210)}" y="${y - fz(46)}" fill="${soft}" font-size="${fz(54)}" font-family="${dev}">${esc(nak.syllables[ch.moonPada - 1])}</text>`;
    body += `<text x="${x0 + fz(290)}" y="${y - fz(44)}" fill="${soft}" font-size="${fz(24)}" font-family="${display}" letter-spacing="${ls * 0.7}">${esc(upper(nak.syllablesRoman[ch.moonPada - 1] + " · " + nak.deityRoman))}</text>`;
    y += fz(70);
    body += `<text x="${x0}" y="${y}" fill="${ink}" font-size="${fz(44)}" font-family="${dev}">${esc(g.mantra.devanagari)}</text>`;
    y += fz(38);
    body += `<text x="${x0}" y="${y}" fill="${soft}" font-size="${fz(26)}" font-family="${dev}">${esc(g.mantra.roman)}</text>`;
    y += fz(30);
    const S = Math.min((right - x0) * 0.5, h * 0.42);
    body += kundli(ch, x0, y + fz(30), S, rule, soft, sw);
    body += `<text x="${x0 + S + fz(40)}" y="${y + fz(70)}" fill="${soft}" font-size="${fz(24)}" font-family="${display}"
      letter-spacing="${ls * 0.6}">${esc(upper(birthLine))}</text>`;
    body += `<text x="${x0 + S + fz(40)}" y="${y + fz(110)}" fill="${soft}" font-size="${fz(23)}" font-family="${display}"
      letter-spacing="${ls * 0.5}" opacity="0.85">${esc(upper("LAGNA " + rashiOf(ch.lagna.signIndex).name + " " + dms(ch.lagna.degreeInSign)))}</text>`;
    body += `<text x="${x0 + S + fz(40)}" y="${y + fz(146)}" fill="${soft}" font-size="${fz(22)}" font-family="${display}"
      opacity="0.8">${esc(g.name + " · " + g.yantraNote)}</text>`;
  }

  const cornerMotifs = preset.cornerMotifs
    ? [[pad * 2.1, pad * 2.1], [w - pad * 2.1, pad * 2.1], [pad * 2.1, h - pad * 2.1], [w - pad * 2.1, h - pad * 2.1]]
      .map(([cx, cy]) => `<g transform="translate(${cx} ${cy}) scale(${(w * 0.052).toFixed(1)})" color="${rule}" stroke="${rule}">${motifShape("lotus", (sw * 1.4) / (w * 0.052))}</g>`)
      .join("") : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="${o.className ?? ""}">
  <defs>
    <style>${o.fontFaceCss ?? ""}</style>
    <linearGradient id="bg" gradientTransform="rotate(${preset.bg.angle - 90} 0.5 0.5)">
      <stop offset="0%" stop-color="${preset.bg.from}"/>
      <stop offset="55%" stop-color="${preset.bg.via}"/>
      <stop offset="100%" stop-color="${preset.bg.to}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="35%" r="70%">
      <stop offset="0%" stop-color="${c.accent}" stop-opacity="${preset.dark ? 0.30 : 0.20}"/>
      <stop offset="100%" stop-color="${c.accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vig" cx="50%" cy="45%" r="78%">
      <stop offset="60%" stop-color="${preset.bg.vignette}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${preset.bg.vignette}" stop-opacity="${preset.dark ? 0.55 : 0.18}"/>
    </radialGradient>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  ${stars}
  ${texture}
  ${frame}
  ${cornerMotifs}
  ${rings}
  ${preset.bhupura ? bhupura(mx, my, R * 1.02, sw, soft) : ""}
  ${petalBand}
  ${petalBand2}
  ${dotsRing}
  ${yantra}
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
