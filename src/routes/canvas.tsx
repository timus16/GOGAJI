import { Link, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Starfield from '~/components/Starfield';
import ZodiacWheel from '~/components/ZodiacWheel';
import RashiChart from '~/components/RashiChart';
import GenerateWallpaper from '~/components/GenerateWallpaper';
import { Reveal, Chapter, Readout, Tag, Divider, cx } from '~/lib/ui';
import { computeChart, computePanchang, vimshottariDasha, type Chart, type BirthInput, type Placement } from '~/lib/astro';
import { GRAHAS, RASHIS, NAKSHATRAS, NAK_SPAN } from '~/content/vedic-mapping';
import { dms, rashiOf } from '~/lib/astro';
import { createFileRoute } from '@tanstack/react-router';

function formatFixedDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

type ViewMode = 'wheel' | 'north' | 'south';

interface PlanetDetailProps {
  planet: Placement;
  chart: Chart;
  onClose: () => void;
}

function PlanetDetail({ planet, chart, onClose }: PlanetDetailProps) {
  const meta = GRAHAS[planet.key];
  const graha = GRAHAS[planet.key];
  const sign = RASHIS[planet.signIndex];
  const nakshatra = NAKSHATRAS[planet.nakshatraIndex];
  const house = ((planet.signIndex - chart.lagna.signIndex + 12) % 12) + 1;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="planet-detail-title"
    >
      <motion.div
        className="panel w-full max-w-md max-h-[90vh] overflow-auto"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h2 id="planet-detail-title" className="display text-2xl font-semibold text-bone">
                {meta.name} <span className="text-gold">({meta.symbol})</span>
              </h2>
              <p className="text-mute mt-1">{meta.english} -- {graha.devanagari}</p>
            </div>
            <button onClick={onClose} className="text-mute hover:text-gold transition-colors" aria-label="Close">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Readout label="Longitude" value={dms(planet.longitude)} tone={planet.key === 'moon' ? 'steel' : 'gold'} />
              <Readout label="Sign" value={`${sign.name}`} tone="mute" />
              <Readout label="Degree in Sign" value={`${dms(planet.degreeInSign)}`} tone="mute" />
              <Readout label="House" value={String(house)} tone="gold" />
              <Readout label="Nakshatra" value={`${nakshatra.name} -- Pada ${nakshatra.pada}`} tone="violet" />
              <Readout label="Retrograde" value={planet.retrograde ? 'Yes' : 'No'} tone={planet.retrograde ? 'crimson' : 'jade'} />
            </div>

            <Divider />

            <div>
              <h3 className="display text-lg font-semibold text-bone mb-3">Bija Mantra</h3>
              <div className="font-devanagari text-xl text-gold leading-relaxed">{graha.mantra.devanagari}</div>
              <div className="mono text-sm text-mute mt-1">{graha.mantra.roman}</div>
              <div className="text-sm text-mute/60 mt-1">{graha.mantra.gloss}</div>
            </div>

            {graha.yantra && (
              <div>
                <h3 className="display text-lg font-semibold text-bone mb-3">Yantra</h3>
                <p className="text-sm text-mute">{graha.yantraNote}</p>
                <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${graha.yantra.order}, 1fr)` }}>
                  {graha.yantra.square.flat().map((n, i) => (
                    <div key={i} className="mono text-xs text-mute/60 aspect-square flex items-center justify-center bg-void/40 rounded">
                      {n}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Divider />

            <div className="flex gap-2">
              <Link
                to="/dasha"
                className="flex-1 rounded-xl border border-gold/30 bg-void/60 px-4 py-2 text-center font-serif text-sm tracking-wide text-bone hover:border-gold hover:bg-gold/10"
              >
                View Dasa
              </Link>
              <Link
                to="/sky"
                className="flex-1 rounded-xl border border-gold/30 bg-void/60 px-4 py-2 text-center font-serif text-sm tracking-wide text-bone hover:border-gold hover:bg-gold/10"
              >
                View Sky
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

interface NakshatraDetailProps {
  nakshatra: typeof NAKSHATRAS[0];
  onClose: () => void;
}

function NakshatraDetail({ nakshatra, onClose }: NakshatraDetailProps) {
  const graha = GRAHAS[nakshatra.lord];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="nakshatra-detail-title"
    >
      <motion.div
        className="panel w-full max-w-md max-h-[90vh] overflow-auto"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h2 id="nakshatra-detail-title" className="display text-2xl font-semibold text-bone">
                {nakshatra.name} <span className="text-gold">({nakshatra.devanagari})</span>
              </h2>
              <p className="text-mute mt-1">#{nakshatra.index} -- {nakshatra.gana} gana</p>
            </div>
            <button onClick={onClose} className="text-mute hover:text-gold transition-colors" aria-label="Close">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Readout label="Deity" value={nakshatra.deityRoman} tone="gold" />
              <Readout label="Symbol" value={nakshatra.symbol} tone="mute" />
              <Readout label="Lord" value={`${graha.name}`} tone="violet" />
              <Readout label="Gana" value={nakshatra.gana} tone="steel" />
            </div>

            <Divider />

            <div>
              <h3 className="display text-lg font-semibold text-bone mb-3">Pada Syllables</h3>
              <div className="flex flex-wrap gap-2">
                {nakshatra.syllables.map((s, i) => (
                  <span key={i} className="mono text-sm px-3 py-1.5 rounded-lg bg-gold/10 text-gold border border-gold/20">
                    {s} <span className="text-mute/60 ml-1">({nakshatra.syllablesRoman[i]})</span>
                  </span>
                ))}
              </div>
            </div>

            <Divider />

            <div>
              <h3 className="display text-lg font-semibold text-bone mb-3">Lord's Bija Mantra</h3>
              <div className="font-devanagari text-xl text-gold leading-relaxed">{graha.mantra.devanagari}</div>
              <div className="mono text-sm text-mute mt-1">{graha.mantra.roman}</div>
              <div className="text-sm text-mute/60 mt-1">{graha.mantra.gloss}</div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CanvasPage() {
  const search = useSearch({ from: '/canvas' });
  const [chart, setChart] = useState<Chart | null>(null);
  const [view, setView] = useState<ViewMode>('wheel');
  const [showDrishti, setShowDrishti] = useState(true);
  const [selectedPlanet, setSelectedPlanet] = useState<string | null>(null);
  const [selectedNakshatra, setSelectedNakshatra] = useState<number | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);

  useEffect(() => {
    if (search.chart) {
      try {
        const parsed = JSON.parse(search.chart as string);
        setChart(parsed);
      } catch {
        // Invalid chart data
      }
    }
  }, [search.chart]);

  if (!chart) {
    return (
      <>
        <Starfield density={0.5} className="fixed inset-0 -z-10" aria-hidden="true" />
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="display text-3xl font-semibold text-bone">No chart data</h1>
          <p className="mt-4 text-mute">Create a chart first to view the canvas.</p>
          <Link to="/chart" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-deep px-6 py-3 font-serif text-base tracking-wide text-void">
            Create Chart
          </Link>
        </div>
      </>
    );
  }

  const moon = chart.GRAHAS.find((p) => p.key === 'moon')!;
  const panchang = computePanchang(chart.utc, chart.offsetMinutes);
  const dasha = vimshottariDasha(chart, 9);

  return (
    <>
      <Starfield density={0.5} className="fixed inset-0 -z-10" aria-hidden="true" />

      <div className="mx-auto max-w-7xl px-4 md:px-8 pb-16">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="display text-2xl md:text-3xl font-semibold text-bone">
              {chart.input.name}&apos;s Canvas
            </h1>
            <p className="text-mute mt-1">
              {NAKSHATRAS[moon.nakshatraIndex].name} -- Pada {moon.pada} -- {RASHIS[chart.lagna.signIndex].name} Lagna
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGenerate(true)}
              className="rounded-xl bg-gradient-to-r from-gold to-gold-deep px-4 py-2 font-serif text-sm tracking-wide text-void hover:from-gold-light hover:to-gold shadow-lg"
            >
              Generate Wallpaper
            </button>
            <Link
              to="/chart"
              className="rounded-xl border border-gold/30 bg-void/60 px-4 py-2 font-serif text-sm tracking-wide text-bone hover:border-gold hover:bg-gold/10"
            >
              New Chart
            </Link>
            <Link
              to="/dasha"
              className="rounded-xl border border-gold/30 bg-void/60 px-4 py-2 font-serif text-sm tracking-wide text-bone hover:border-gold hover:bg-gold/10"
            >
              Dasa
            </Link>
            <Link
              to="/sky"
              className="rounded-xl border border-gold/30 bg-void/60 px-4 py-2 font-serif text-sm tracking-wide text-bone hover:border-gold hover:bg-gold/10"
            >
              Sky
            </Link>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Chart view">
          {(['wheel', 'north', 'south'] as ViewMode[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cx(
                'rounded-xl px-4 py-2 font-serif text-sm tracking-wide transition-all',
                view === v
                  ? 'bg-gradient-to-r from-gold to-gold-deep text-void shadow-lg'
                  : 'border border-gold/30 bg-void/60 text-bone hover:border-gold hover:bg-gold/10'
              )}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
          <label className="flex items-center gap-2 ml-auto rounded-xl border border-gold/30 bg-void/60 px-4 py-2 text-sm text-bone">
            <input
              type="checkbox"
              checked={showDrishti}
              onChange={(e) => setShowDrishti(e.target.checked)}
              className="h-4 w-4 accent-gold"
            />
            Drishti
          </label>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="space-y-8">
            {view === 'wheel' && (
              <Reveal>
                <ZodiacWheel
                  chart={chart}
                  selectedNak={selectedNakshatra}
                  selectedPlanet={selectedPlanet as any}
                  onSelectNak={(i) => setSelectedNakshatra(i)}
                  onSelectPlanet={(k) => setSelectedPlanet(k)}
                  showAspects={showDrishti}
                  spin={true}
                />
              </Reveal>
            )}
            {view === 'north' && (
              <Reveal>
                <div className="aspect-square max-w-[500px] mx-auto">
                  <RashiChart chart={chart} style="north" onSelectPlanet={setSelectedPlanet as any} selectedPlanet={selectedPlanet as any} />
                </div>
              </Reveal>
            )}
            {view === 'south' && (
              <Reveal>
                <div className="aspect-square max-w-[500px] mx-auto">
                  <RashiChart chart={chart} style="south" onSelectPlanet={setSelectedPlanet as any} selectedPlanet={selectedPlanet as any} />
                </div>
              </Reveal>
            )}

            <Reveal>
              <div className="panel p-6">
                <h3 className="display text-lg font-semibold text-bone mb-4">Graha Positions</h3>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-mute border-b border-gold/20">
                        <th className="pb-2 font-mono">Graha</th>
                        <th className="pb-2">Rasi</th>
                        <th className="pb-2">Degree</th>
                        <th className="pb-2">Nakshatra</th>
                        <th className="pb-2">Pada</th>
                        <th className="pb-2">House</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chart.GRAHAS.map((p) => {
                        const meta = GRAHAS[p.key];
                        const sign = RASHIS[p.signIndex];
                        const nak = NAKSHATRAS[p.nakshatraIndex];
                        const house = ((p.signIndex - chart.lagna.signIndex + 12) % 12) + 1;
                        return (
                          <tr key={p.key} className="border-b border-gold/10 hover:bg-gold/5 transition-colors cursor-pointer" onClick={() => setSelectedPlanet(p.key)}>
                            <td className="py-2 font-mono">
                              <span style={{ color: meta.colour.glow }}>{meta.symbol}</span> {meta.name}
                            </td>
                            <td className="py-2">{sign.name}</td>
                            <td className="py-2 font-mono">{dms(p.degreeInSign)}</td>
                            <td className="py-2">{nak.name}</td>
                            <td className="py-2 text-center">{p.pada}</td>
                            <td className="py-2 text-center font-mono text-gold">{house}</td>
                            <td className="py-2">
                              {p.retrograde && <span className="text-crimson mono text-xs">Rx</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </Reveal>

            <Reveal>
              <div className="panel p-6">
                <h3 className="display text-lg font-semibold text-bone mb-4">Pancha?ga</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Readout label="Tithi" value={`${panchang.tithiName}`} tone="gold" />
                  <Readout label="Vara" value={panchang.varaName} tone="steel" />
                  <Readout label="Yoga" value={panchang.yogaName} tone="violet" />
                  <Readout label="Kara?a" value={panchang.karanaName} tone="mute" />
                  <Readout label="Masa (Amanta)" value={panchang.lunarMonth.amantaName} tone="jade" />
                  <Readout label="Masa (Pur?imanta)" value={panchang.lunarMonth.purnimantaName} tone="rust" />
                  <Readout label="Saka" value={String(panchang.samvat.shaka)} tone="mute" />
                  <Readout label="Vikrama" value={String(panchang.samvat.vikram)} tone="mute" />
                </div>
              </div>
            </Reveal>

            <Reveal>
              <div className="panel p-6">
                <h3 className="display text-lg font-semibold text-bone mb-4">Vimsottari Dasa</h3>
                <div className="space-y-2">
                  {dasha.periods.slice(0, 5).map((period, i) => (
                    <div key={i} className={cx('flex items-center justify-between p-3 rounded-lg', i === 0 ? 'bg-gold/10 border border-gold/30' : 'bg-void/40 border border-gold/10')}>
                      <div>
                        <div className="font-semibold text-bone">{period.lord} ({period.lordDevanagari})</div>
                        <div className="text-sm text-mute">{formatFixedDate(period.start)} -- {formatFixedDate(period.end)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-gold">{period.years.toFixed(2)} years</div>
                        {i === 0 && <span className="badge badge-gold text-xs">Current</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>

          <aside className="space-y-6">
            <Reveal>
              <div className="panel p-6 sticky top-24">
                <h3 className="display text-lg font-semibold text-bone mb-4">Quick Facts</h3>
                <div className="space-y-3">
                  <Readout label="Name" value={chart.input.name} tone="gold" />
                  <Readout label="Birth" value={`${chart.input.date}`} tone="mute" />
                  <Readout label="Place" value={chart.input.place} tone="mute" />
                  <Readout label="Lagna" value={`${RASHIS[chart.lagna.signIndex].name}`} tone="gold" />
                  <Readout label="Moon" value={`${RASHIS[chart.moonSign].name} -- Pd ${moon.pada}`} tone="steel" />
                  <Readout label="Sun" value={RASHIS[chart.sunSign].name} tone="gold" />
                  <Readout label="Ruling Planet" value={GRAHAS[chart.rulingPlanet].name} tone="violet" />
                  <Readout label="Ayana?sa" value={`${chart.ayanamsa.toFixed(4)}deg`} tone="mute" />
                </div>
              </div>
            </Reveal>

            <Reveal>
              <div className="panel p-6">
                <h3 className="display text-lg font-semibold text-bone mb-4">Next Steps</h3>
                <div className="space-y-2">
                  <Link to="/dasha" className="block rounded-xl border border-gold/30 bg-void/60 p-4 hover:border-gold hover:bg-gold/10 transition-all">
                    <div className="font-semibold text-bone">Dasa Timeline</div>
                    <div className="text-sm text-mute mt-1">5-level Vimsottari recursion with current periods</div>
                  </Link>
                  <Link to="/sky" className="block rounded-xl border border-gold/30 bg-void/60 p-4 hover:border-gold hover:bg-gold/10 transition-all">
                    <div className="font-semibold text-bone">Live Transits</div>
                    <div className="text-sm text-mute mt-1">Gochara overlaid on natal chart with Saturn/Jupiter windows</div>
                  </Link>
                  <Link to="/match" className="block rounded-xl border border-gold/30 bg-void/60 p-4 hover:border-gold hover:bg-gold/10 transition-all">
                    <div className="font-semibold text-bone">Matchmaking</div>
                    <div className="text-sm text-mute mt-1">A??aku?a 36-gu?a compatibility analysis</div>
                  </Link>
                  <Link to="/atlas" className="block rounded-xl border border-gold/30 bg-void/60 p-4 hover:border-gold hover:bg-gold/10 transition-all">
                    <div className="font-semibold text-bone">Nakshatra Atlas</div>
                    <div className="text-sm text-mute mt-1">All 27 nakshatras with deity, symbol, syllables</div>
                  </Link>
                </div>
              </div>
            </Reveal>
          </aside>
        </div>
      </div>

      {selectedPlanet && (
        <PlanetDetail
          planet={chart.GRAHAS.find((p) => p.key === selectedPlanet)!}
          chart={chart}
          onClose={() => setSelectedPlanet(null)}
        />
      )}

      {selectedNakshatra !== null && (
        <NakshatraDetail
          nakshatra={NAKSHATRAS[selectedNakshatra]}
          onClose={() => setSelectedNakshatra(null)}
        />
      )}

      {showGenerate && (
        <GenerateWallpaper
          chart={chart}
          input={chart.input}
          onClose={() => setShowGenerate(false)}
        />
      )}
    </>
  );
}

export const Route = createFileRoute("/canvas")({
  validateSearch: (search) => search as { chart?: string },
  component: CanvasPage,
});



