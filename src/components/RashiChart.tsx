import { GRAHAS, RASHIS, type PlanetKey } from "~/content/vedic-mapping";
import type { Chart } from "~/lib/astro";
import { cx } from "~/lib/ui";

export type ChartStyle = 'north' | 'south';

const NORTH_CELLS: { house: number; pts: [number, number][] }[] = [
  { house: 1, pts: [[200, 0], [100, 100], [300, 100]] },
  { house: 2, pts: [[0, 0], [200, 0], [100, 100]] },
  { house: 3, pts: [[0, 0], [100, 100], [0, 200]] },
  { house: 4, pts: [[0, 200], [100, 100], [100, 300]] },
  { house: 5, pts: [[0, 200], [100, 300], [0, 400]] },
  { house: 6, pts: [[0, 400], [100, 300], [200, 400]] },
  { house: 7, pts: [[200, 400], [100, 300], [300, 300]] },
  { house: 8, pts: [[400, 400], [200, 400], [300, 300]] },
  { house: 9, pts: [[400, 400], [300, 300], [400, 200]] },
  { house: 10, pts: [[400, 200], [300, 300], [300, 100]] },
  { house: 11, pts: [[400, 200], [300, 100], [400, 0]] },
  { house: 12, pts: [[400, 0], [300, 100], [200, 0]] },
];

const SOUTH_POS: { sign: number; col: number; row: number }[] = [
  { sign: 11, col: 0, row: 0 }, { sign: 0, col: 1, row: 0 }, { sign: 1, col: 2, row: 0 }, { sign: 2, col: 3, row: 0 },
  { sign: 3, col: 3, row: 1 }, { sign: 4, col: 3, row: 2 }, { sign: 5, col: 3, row: 3 },
  { sign: 6, col: 2, row: 3 }, { sign: 7, col: 1, row: 3 }, { sign: 8, col: 0, row: 3 },
  { sign: 9, col: 0, row: 2 }, { sign: 10, col: 0, row: 1 },
];

function centroid(pts: [number, number][]): [number, number] {
  const n = pts.length;
  return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
}

export default function RashiChart({
  chart,
  style,
  onSelectPlanet,
  selectedPlanet,
}: {
  chart: Chart;
  style: ChartStyle;
  onSelectPlanet?: (k: PlanetKey) => void;
  selectedPlanet?: PlanetKey | null;
}) {
  const byHouse = (house: number) => chart.GRAHAS.filter((p) => ((p.signIndex - chart.lagna.signIndex + 12) % 12) + 1 === house);
  const bySign = (sign: number) => chart.GRAHAS.filter((p) => p.signIndex === sign);

  if (style === 'south') {
    const cell = 100;
    return (
      <svg viewBox="-20 -20 440 440" className="block w-full">
        {SOUTH_POS.map((s) => {
          const x = s.col * cell;
          const y = s.row * cell;
          const isLagna = s.sign === chart.lagna.signIndex;
          const occ = bySign(s.sign);
          const house = ((s.sign - chart.lagna.signIndex + 12) % 12) + 1;
          return (
            <g key={s.sign}>
              <rect
                x={x} y={y} width={cell} height={cell}
                fill={isLagna ? 'rgba(232,181,102,0.13)' : 'rgba(10,14,23,0.75)'}
                stroke="#e8b566" strokeOpacity={isLagna ? 0.75 : 0.2} strokeWidth={isLagna ? 1.3 : 0.7}
              />
              {isLagna && (
                <line x1={x + 4} y1={y + 4} x2={x + 30} y2={y + 30} stroke="#e8b566" strokeOpacity="0.8" strokeWidth="1.2" />
              )}
              <text x={x + 7} y={y + 20} fill="#8a8f9c" fontSize="10" fontFamily="IBM Plex Mono, monospace">
                {house}
              </text>
              <text x={x + 62} y={y + 20} fill="#e8b566" fontSize="13" textAnchor="middle" fontFamily="Cinzel, serif">
                {RASHIS[s.sign].devanagari.charAt(0)}
              </text>
              <text
                x={x + 94} y={y + 20} fill="#6b7280" fontSize="8" textAnchor="end"
                fontFamily="IBM Plex Mono, monospace" letterSpacing="1"
              >
                {RASHIS[s.sign].name.slice(0, 3).toUpperCase()}
              </text>
              {occ.map((p, i) => {
                const col = i % 3;
                const row = Math.floor(i / 3);
                return (
                  <g key={p.key} className={onSelectPlanet ? 'cursor-pointer' : ''} onClick={() => onSelectPlanet?.(p.key)}>
                    <text
                      x={x + 26 + col * 26}
                      y={y + 48 + row * 24}
                      fill={selectedPlanet === p.key ? '#e8b566' : GRAHAS[p.key].colour.glow}
                      fontSize="17"
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      {GRAHAS[p.key].symbol}
                    </text>
                    <text x={x + 36 + col * 26} y={y + 48 + row * 24} fill="#8a8f9c" fontSize="8" fontFamily="IBM Plex Mono, monospace">
                      {Math.floor(p.degreeInSign)}
                    </text>
                    {p.retrograde && <text x={x + 26 + col * 26} y={y + 62 + row * 24} fill="#b3352e" fontSize="7" fontFamily="IBM Plex Mono, monospace">R</text>}
                  </g>
                );
              })}
            </g>
          );
        })}
        <rect x={100} y={100} width={200} height={200} fill="rgba(7,10,18,0.9)" stroke="#e8b566" strokeOpacity="0.25" strokeWidth="0.8" />
        <text x={200} y={188} textAnchor="middle" fill="#e8b566" fontSize="19" fontFamily="Cinzel, serif">
          {RASHIS[chart.lagna.signIndex].name}
        </text>
        <text x={200} y={210} textAnchor="middle" fill="#8a8f9c" fontSize="9" letterSpacing="3" fontFamily="IBM Plex Mono, monospace">
          LAGNA
        </text>
        <text x={200} y={232} textAnchor="middle" fill="#6b7280" fontSize="8" letterSpacing="2" fontFamily="IBM Plex Mono, monospace">
          D1 \u00b7 RASHI
        </text>
      </svg>
    );
  }

  return (
    <svg viewBox="-20 -20 440 440" className="block w-full">
      <rect x={0} y={0} width={400} height={400} fill="rgba(10,14,23,0.6)" stroke="#e8b566" strokeOpacity="0.45" strokeWidth="1.1" />
      <line x1={0} y1={0} x2={400} y2={400} stroke="#e8b566" strokeOpacity="0.2" strokeWidth="0.8" />
      <line x1={400} y1={0} x2={0} y2={400} stroke="#e8b566" strokeOpacity="0.2" strokeWidth="0.8" />
      <polygon points="200,0 400,200 200,400 0,200" fill="none" stroke="#e8b566" strokeOpacity="0.3" strokeWidth="0.9" />

      {NORTH_CELLS.map((cell) => {
        const sign = (chart.lagna.signIndex + cell.house - 1) % 12;
        const occ = bySign(sign);
        const [cxp, cyp] = centroid(cell.pts);
        const isLagna = cell.house === 1;
        const labelAnchor = centroid(cell.pts);
        const nudge: [number, number] = [
          cell.house === 1 ? 0 : cell.house === 4 ? 14 : cell.house === 7 ? 0 : cell.house === 10 ? -14 : 0,
          cell.house === 1 ? 16 : cell.house === 4 ? 0 : cell.house === 7 ? -16 : cell.house === 10 ? 0 : 0,
        ];
        return (
          <g key={cell.house}>
            <polygon
              points={cell.pts.map((p) => p.join(',')).join(' ')}
              fill={isLagna ? 'rgba(232,181,102,0.14)' : 'transparent'}
              className={cx(onSelectPlanet ? 'cursor-pointer' : '')}
            />
            <text
              x={labelAnchor[0] + nudge[0]}
              y={labelAnchor[1] + nudge[1]}
              fill={isLagna ? '#e8b566' : '#c9963f'}
              fontSize="11"
              fontFamily="Cinzel, serif"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {RASHIS[sign].devanagari.charAt(0)} {cell.house}
            </text>
            {occ.map((p, i) => (
              <g
                key={p.key}
                className={onSelectPlanet ? 'cursor-pointer' : ''}
                onClick={() => onSelectPlanet?.(p.key)}
              >
                <text
                  x={cxp + (i % 2 ? 34 : -12) + (cell.house % 2 === 1 ? 0 : 0)}
                  y={cyp + 22 + Math.floor(i / 2) * 20}
                  fill={selectedPlanet === p.key ? '#e8b566' : GRAHAS[p.key].colour.glow}
                  fontSize="18"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {GRAHAS[p.key].symbol}
                </text>
                <text x={cxp + (i % 2 ? 50 : 4)} y={cyp + 22 + Math.floor(i / 2) * 20} fill="#8a8f9c" fontSize="8.5" fontFamily="IBM Plex Mono, monospace">
                  {Math.floor(p.degreeInSign)}{p.retrograde ? 'R' : ''}
                </text>
              </g>
            ))}
          </g>
        );
      })}
      <text x={200} y={-6} textAnchor="middle" fill="#6b7280" fontSize="8" letterSpacing="2" fontFamily="IBM Plex Mono, monospace">
        NORTH INDIAN \u00b7 D1
      </text>
    </svg>
  );
}
