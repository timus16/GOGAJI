import { useMemo, useRef, useState, useEffect } from 'react';
import { GRAHAS, RASHIS, NAKSHATRAS, NAK_SPAN, type PlanetKey } from "~/content/vedic-mapping";
import type { Chart, Placement } from "~/lib/astro";
import { cx } from "~/lib/ui";

const C = 400;
const DEG = Math.PI / 180;

const NAK_OUT = 374;
const NAK_IN = 306;
const RASHI_OUT = 296;
const RASHI_IN = 232;
const HOUSE_OUT = 226;
const HOUSE_IN = 158;
const PLANET_R = 196;
const CORE = 150;

function pt(r: number, aDeg: number): [number, number] {
  const a = aDeg * DEG;
  return [C + r * Math.cos(a), C - r * Math.sin(a)];
}

function sector(r1: number, r2: number, a1: number, a2: number): string {
  const [x1, y1] = pt(r2, a1);
  const [x2, y2] = pt(r2, a2);
  const [x3, y3] = pt(r1, a2);
  const [x4, y4] = pt(r1, a1);
  const large = a2 - a1 > 180 ? 1 : 0;
  return `M${x1},${y1} A${r2},${r2} 0 ${large} 0 ${x2},${y2} L${x3},${y3} A${r1},${r1} 0 ${large} 1 ${x4},${y4} Z`;
}

const DRISHTI: Partial<Record<PlanetKey, number[]>> = {
  mars: [4, 7, 8],
  jupiter: [5, 7, 9],
  saturn: [3, 7, 10],
  rahu: [5, 7, 9],
  ketu: [5, 7, 9],
};

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(800);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export interface WheelProps {
  chart: Chart;
  selectedNak?: number | null;
  selectedPlanet?: PlanetKey | null;
  onSelectNak?: (i: number) => void;
  onSelectPlanet?: (k: PlanetKey) => void;
  showAspects?: boolean;
  spin?: boolean;
}

export default function ZodiacWheel({
  chart,
  selectedNak = null,
  selectedPlanet = null,
  onSelectNak,
  onSelectPlanet,
  showAspects = true,
  spin = true,
}: WheelProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const compact = width < 520;

  const ang = (lon: number) => 180 + ((((lon - chart.lagna.longitude) % 360) + 360) % 360);

  const moon = chart.GRAHAS.find((p) => p.key === 'moon')!;

  const placed = useMemo(() => {
    const sorted = [...chart.GRAHAS].sort((a, b) => a.longitude - b.longitude);
    const out: { p: Placement; r: number }[] = [];
    for (const p of sorted) {
      let r = PLANET_R;
      let guard = 0;
      while (
        guard++ < 6 &&
        out.some((o) => {
          const d = Math.abs(o.p.longitude - p.longitude);
          const dd = Math.min(d, 360 - d);
          return dd < 9 && Math.abs(o.r - r) < 14;
        })
      ) {
        r -= 15;
      }
      out.push({ p, r });
    }
    return out;
  }, [chart]);

  const aspectLines = useMemo(() => {
    if (!showAspects) return [];
    const lines: { from: Placement; to: Placement; color: string }[] = [];
    for (const p of chart.GRAHAS) {
      const houses = DRISHTI[p.key];
      if (!houses) continue;
      for (const h of houses) {
        const targetSign = (p.signIndex + h - 1) % 12;
        const found = chart.GRAHAS.filter((t) => t.signIndex === targetSign && t.key !== p.key);
        for (const f of found) lines.push({ from: p, to: f, color: GRAHAS[p.key].colour.accent });
      }
    }
    return lines;
  }, [chart, showAspects]);

  return (
    <div ref={ref} className="relative w-full">
      <svg viewBox="0 0 800 800" className="block w-full select-none" role="img" aria-label="Nakshatra birth wheel">
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e8b566" stopOpacity="0.22" />
            <stop offset="55%" stopColor="#e8b566" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="rimGlow" cx="50%" cy="50%" r="50%">
            <stop offset="72%" stopColor="#e8b566" stopOpacity="0" />
            <stop offset="94%" stopColor="#e8b566" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#e8b566" stopOpacity="0" />
          </radialGradient>
          <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
        </defs>

        <circle cx={C} cy={C} r={392} fill="url(#rimGlow)" />
        <circle cx={C} cy={C} r={CORE} fill="url(#coreGlow)" />

        <g className={spin ? 'animate-spin-slow' : ''} style={{ transformOrigin: '400px 400px' }}>
          <circle cx={C} cy={C} r={386} fill="none" stroke="#e8b566" strokeOpacity="0.22" strokeWidth="0.7" strokeDasharray="1 5" />
          <circle cx={C} cy={C} r={379} fill="none" stroke="#e6e3dc" strokeOpacity="0.1" strokeWidth="0.6" />
          {Array.from({ length: 360 }, (_, i) => {
            const major = i % 10 === 0;
            const [x1, y1] = pt(379, i);
            const [x2, y2] = pt(major ? 370 : 375, i);
            return (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={major ? '#e8b566' : '#8a8f9c'}
                strokeOpacity={major ? 0.5 : 0.2}
                strokeWidth={major ? 0.9 : 0.5}
              />
            );
          })}
        </g>

        {NAKSHATRAS.map((n) => {
          const a1 = ang(n.index * NAK_SPAN);
          const a2 = ang((n.index + 1) * NAK_SPAN);
          const isMoonNak = n.index === moon.nakshatraIndex;
          const isSel = selectedNak === n.index;
          const midA = (a1 + a2) / 2;
          const [tx, ty] = pt((NAK_OUT + NAK_IN) / 2 + 3, midA);
          const flip = midA > 90 && midA < 270;
          const label = compact ? n.name.slice(0, 3) : n.name;
          return (
            <g key={n.name}>
              <path
                d={sector(NAK_IN, NAK_OUT, a1, a2)}
                fill={
                  isSel ? 'rgba(232,181,102,0.3)'
                  : isMoonNak ? 'rgba(232,181,102,0.2)'
                  : n.index % 2 ? 'rgba(20,26,38,0.85)' : 'rgba(10,14,23,0.85)'
                }
                stroke="#e8b566"
                strokeOpacity={isSel ? 0.9 : isMoonNak ? 0.6 : 0.13}
                strokeWidth={isSel ? 1.5 : 0.7}
                className={onSelectNak ? 'cursor-pointer' : ''}
                onClick={() => onSelectNak?.(n.index)}
              />
              <line
                x1={pt(NAK_IN, a1)[0]} y1={pt(NAK_IN, a1)[1]}
                x2={pt(NAK_OUT, a1)[0]} y2={pt(NAK_OUT, a1)[1]}
                stroke="#e8b566" strokeOpacity={isMoonNak ? 0.55 : 0.2} strokeWidth={0.6}
              />
              {compact
                ? null
                : [1, 2, 3].map((k) => {
                    const pa = ang(n.index * NAK_SPAN + (k * NAK_SPAN) / 4);
                    const [x1, y1] = pt(NAK_IN, pa);
                    const [x2, y2] = pt(NAK_IN + 9, pa);
                    return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8a8f9c" strokeOpacity={0.3} strokeWidth={0.45} />;
                  })}
              <text
                x={tx}
                y={ty}
                fill={isSel || isMoonNak ? '#e8b566' : '#b8bcc7'}
                fontSize={compact ? 11 : 13}
                fontFamily="IBM Plex Mono, monospace"
                textAnchor="middle"
                dominantBaseline="middle"
                opacity={isSel || isMoonNak ? 1 : 0.62}
                transform={`rotate(${flip ? -midA + 180 : -midA} ${tx} ${ty})`}
                className="pointer-events-none"
              >
                {label.toUpperCase()}
              </text>
            </g>
          );
        })}

        {RASHIS.map((r) => {
          const a1 = ang(r.index * 30);
          const a2 = ang((r.index + 1) * 30);
          const isLagna = r.index === chart.lagna.signIndex;
          const midA = (a1 + a2) / 2;
          const [gx, gy] = pt((RASHI_OUT + RASHI_IN) / 2 - 2, midA);
          const [nx, ny] = pt(RASHI_IN + 17, midA);
          const flip = midA > 90 && midA < 270;
          const occupants = chart.GRAHAS.filter((p) => p.signIndex === r.index);
          return (
            <g key={r.name}>
              <path
                d={sector(RASHI_IN, RASHI_OUT, a1, a2)}
                fill={isLagna ? 'rgba(232,181,102,0.13)' : r.index % 3 === 0 ? 'rgba(179,53,46,0.09)' : r.index % 3 === 1 ? 'rgba(127,180,214,0.08)' : 'rgba(169,143,224,0.07)'}
                stroke="#e6e3dc"
                strokeOpacity={isLagna ? 0.5 : 0.16}
                strokeWidth={isLagna ? 1.2 : 0.6}
              />
              <text x={gx} y={gy} fill={isLagna ? '#e8b566' : '#e6e3dc'} fontSize={compact ? 20 : 26} textAnchor="middle" dominantBaseline="middle" opacity={isLagna ? 1 : 0.75}>
                {r.devanagari.charAt(0)}
              </text>
              {!compact && (
                <text
                  x={nx} y={ny}
                  fill="#8a8f9c" fontSize={9} fontFamily="IBM Plex Mono, monospace"
                  letterSpacing="1.4" textAnchor="middle" dominantBaseline="middle" opacity={0.75}
                  transform={`rotate(${flip ? -midA + 180 : -midA} ${nx} ${ny})`}
                >
                  {r.name.toUpperCase()}
                </text>
              )}
              {occupants.length > 0 && (
                <text
                  x={pt(RASHI_IN + 4, midA)[0]} y={pt(RASHI_IN + 4, midA)[1]}
                  fill="#e8b566" fontSize={8} fontFamily="IBM Plex Mono, monospace"
                  textAnchor="middle" dominantBaseline="middle" opacity={0.85}
                >
                  {'\u25CF'.repeat(occupants.length)}
                </text>
              )}
            </g>
          );
        })}

        {RASHIS.map((r) => {
          const a1 = ang(r.index * 30);
          const a2 = ang((r.index + 1) * 30);
          const house = ((r.index - chart.lagna.signIndex + 12) % 12) + 1;
          const midA = (a1 + a2) / 2;
          const [hx, hy] = pt((HOUSE_OUT + HOUSE_IN) / 2, midA);
          const isKendra = [1, 4, 7, 10].includes(house);
          return (
            <g key={`h${r.index}`}>
              <path
                d={sector(HOUSE_IN, HOUSE_OUT, a1, a2)}
                fill={isKendra ? 'rgba(232,181,102,0.05)' : 'rgba(7,10,18,0.6)'}
                stroke="#e8b566" strokeOpacity={0.1} strokeWidth={0.5}
              />
              <text
                x={hx} y={hy}
                fill={house === 1 ? '#e8b566' : isKendra ? '#c9963f' : '#6b7280'}
                fontSize={compact ? 11 : 13} fontFamily="Cinzel, serif"
                textAnchor="middle" dominantBaseline="middle"
                opacity={house === 1 ? 1 : isKendra ? 0.9 : 0.6}
              >
                {house}
              </text>
            </g>
          );
        })}

        {[0, 90, 180, 270].map((axis) => {
          const lon = chart.lagna.longitude + axis;
          const a = ang(lon);
          const [x1, y1] = pt(HOUSE_IN - 6, a);
          const [x2, y2] = pt(NAK_IN, a);
          return (
            <line
              key={axis}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={axis === 0 ? '#e8b566' : axis === 180 ? '#7fb4d6' : '#8a8f9c'}
              strokeOpacity={axis === 0 ? 0.75 : 0.3}
              strokeWidth={axis === 0 ? 1.4 : 0.7}
              strokeDasharray={axis === 90 || axis === 270 ? '3 4' : undefined}
            />
          );
        })}

        {aspectLines.map((l, i) => {
          const [x1, y1] = pt(PLANET_R - 30, ang(l.from.longitude));
          const [x2, y2] = pt(PLANET_R - 30, ang(l.to.longitude));
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={l.color} strokeOpacity={0.3} strokeWidth={0.7}
              strokeDasharray="2 6" className="orbit-dash"
            />
          );
        })}

        {placed.map(({ p, r }) => {
          const a = ang(p.longitude);
          const [x, y] = pt(r, a);
          const meta = GRAHAS[p.key];
          const isSel = selectedPlanet === p.key;
          const isMoon = p.key === 'moon';
          return (
            <g key={p.key} className={onSelectPlanet ? 'cursor-pointer' : ''} onClick={() => onSelectPlanet?.(p.key)}>
              {isMoon && <circle cx={x} cy={y} r={30} fill={meta.colour.accent} opacity={0.14} filter="url(#soft)" />}
              {isSel && <circle cx={x} cy={y} r={26} fill="none" stroke="#e8b566" strokeWidth={1} strokeDasharray="3 3" />}
              <circle cx={x} cy={y} r={19} fill="rgba(7,10,18,0.9)" stroke={meta.colour.accent} strokeOpacity={isSel ? 1 : 0.65} strokeWidth={isSel ? 1.4 : 0.9} />
              <text
                x={x} y={y}
                fill={meta.colour.glow} fontSize={21}
                textAnchor="middle" dominantBaseline="middle"
                transform={p.retrograde ? `scale(-1,1) translate(${-2 * x} 0)` : undefined}
              >
                {meta.symbol}
              </text>
              {!compact && (
                <text x={x} y={y + 30} fill="#8a8f9c" fontSize={8} fontFamily="IBM Plex Mono, monospace" textAnchor="middle">
                  {Math.floor(p.degreeInSign)}{'\u00B0'}{String(Math.floor((p.degreeInSign % 1) * 60)).padStart(2, '0')}{'\u2032'}
                </text>
              )}
              {p.retrograde && (
                <text x={x} y={y - 26} fill="#b3352e" fontSize={9} fontFamily="IBM Plex Mono, monospace" textAnchor="middle" letterSpacing="1">
                  Rx
                </text>
              )}
            </g>
          );
        })}

        <g className={spin ? 'animate-spin-slower' : ''} style={{ transformOrigin: '400px 400px' }}>
          <circle cx={C} cy={C} r={CORE - 8} fill="none" stroke="#7fb4d6" strokeOpacity="0.25" strokeWidth="0.8" strokeDasharray="14 10 3 10" />
        </g>
        <circle cx={C} cy={C} r={CORE - 26} fill="none" stroke="#e8b566" strokeOpacity="0.18" strokeWidth="0.7" />
        <circle cx={C} cy={C} r={4} fill="#e8b566" opacity="0.9" className="breathe" />

        <path d={`M${C - NAK_OUT - 6},${C} L${C - NAK_OUT + 16},${C - 8} L${C - NAK_OUT + 16},${C + 8} Z`} fill="#e8b566" opacity="0.85" />

        <text x={C} y={C - 52} textAnchor="middle" fill="#8a8f9c" fontSize={10} fontFamily="IBM Plex Mono, monospace" letterSpacing="4" opacity={0.9}>
          LAGNA
        </text>
        <text x={C} y={C - 30} textAnchor="middle" fill="#e8b566" fontSize={compact ? 22 : 28} fontFamily="Cinzel, serif">
          {RASHIS[chart.lagna.signIndex].name}
        </text>
        <text x={C} y={C - 8} textAnchor="middle" fill="#8a8f9c" fontSize={compact ? 11 : 13} fontFamily="IBM Plex Mono, monospace">
          {Math.floor(chart.lagna.degreeInSign)}{'\u00B0'}{String(Math.floor((chart.lagna.degreeInSign % 1) * 60)).padStart(2, '0')}{'\u2032'} \u00b7 {NAKSHATRAS[chart.lagna.nakshatraIndex].name}
        </text>
        <line x1={C - 60} y1={C + 8} x2={C + 60} y2={C + 8} stroke="#e8b566" strokeOpacity="0.35" strokeWidth="0.7" />

        <text x={C} y={C + 34} textAnchor="middle" fill="#8a8f9c" fontSize={10} fontFamily="IBM Plex Mono, monospace" letterSpacing="4">
          JANMA NAKSHATRA
        </text>
        <text x={C} y={C + 58} textAnchor="middle" fill="#e6e3dc" fontSize={compact ? 20 : 26} fontFamily="Cinzel, serif">
          {NAKSHATRAS[moon.nakshatraIndex].name}
        </text>
        <text x={C} y={C + 80} textAnchor="middle" fill="#e8b566" fontSize={compact ? 11 : 13} fontFamily="IBM Plex Mono, monospace">
          PADA {moon.pada} \u00b7 {NAKSHATRAS[moon.nakshatraIndex].lord.toUpperCase()}
        </text>
      </svg>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {chart.GRAHAS.map((p) => (
          <button
            key={p.key}
            onClick={() => onSelectPlanet?.(p.key)}
            className={cx(
              'mono flex items-center gap-1.5 text-[10px] uppercase tracking-widest transition-colors',
              selectedPlanet === p.key ? 'text-gold' : 'text-mute hover:text-bone'
            )}
          >
            <span className="text-sm" style={{ color: GRAHAS[p.key].colour.glow }}>
              {GRAHAS[p.key].symbol}
            </span>
            {GRAHAS[p.key].name}
            {p.retrograde && <span className="text-crimson">Rx</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
