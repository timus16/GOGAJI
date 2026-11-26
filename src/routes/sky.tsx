import { Link, useSearch, createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Starfield from '~/components/Starfield';
import ZodiacWheel from '~/components/ZodiacWheel';
import { Reveal, Readout, Divider, Tag, cx } from '~/lib/ui';
import { computeChart, type Chart, type Placement } from '~/lib/astro';
import { GRAHAS, RASHIS, NAKSHATRAS, NAK_SPAN } from '~/content/vedic-mapping';
import { dms, rashiOf } from '~/lib/astro';

export default function SkyPage() {
  const search = useSearch({ from: '/sky' });
  const [chart, setChart] = useState<Chart | null>(null);
  const [transits, setTransits] = useState<Placement[]>([]);
  const [selectedPlanet, setSelectedPlanet] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (search.chart && isClient) {
      try {
        const parsed = JSON.parse(search.chart as string);
        setChart(parsed);
        const now = new Date();
        const transitInput = {
          name: 'Now',
          date: now.toISOString().split('T')[0],
          time: now.toTimeString().slice(0, 5),
          place: parsed.input.place,
          latitude: parsed.input.latitude,
          longitude: parsed.input.longitude,
          timezone: parsed.input.timezone,
        };
        const transitChart = computeChart(transitInput);
        setTransits(transitChart.GRAHAS);
      } catch { }
    }
  }, [search.chart, isClient]);

  if (!chart) {
    return (
      <>
        <Starfield density={0.5} className="fixed inset-0 -z-10" aria-hidden="true" />
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="display text-3xl font-semibold text-bone">Live Sky</h1>
          <p className="mt-4 text-mute">Create a chart first to view current transits.</p>
          <Link to="/chart" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-deep px-6 py-3 font-serif text-base tracking-wide text-void">
            Create Chart
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Starfield density={0.5} className="fixed inset-0 -z-10" aria-hidden="true" />

      <div className="mx-auto max-w-7xl px-4 md:px-8 pb-16">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="display text-2xl md:text-3xl font-semibold text-bone">
              Gochara · {chart.input.name}
            </h1>
            <p className="text-mute mt-1">Current planetary transits overlaid on your natal chart</p>
          </div>
          <Link to="/canvas" className="rounded-xl border border-gold/30 bg-void/60 px-4 py-2 font-serif text-sm tracking-wide text-bone hover:border-gold hover:bg-gold/10">
            Back to Canvas
          </Link>
        </div>

        <Reveal>
          <div className="panel p-6 mb-8">
            <ZodiacWheel
              chart={chart}
              selectedPlanet={selectedPlanet as any}
              onSelectPlanet={(k) => setSelectedPlanet(k)}
              showAspects={false}
              spin={false}
            />
          </div>
        </Reveal>

        <div className="grid gap-8 lg:grid-cols-2">
          <Reveal>
            <div className="panel p-6">
              <h3 className="display text-lg font-semibold text-bone mb-4">Transit Positions</h3>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-mute border-b border-gold/20">
                      <th className="pb-2 font-mono">Graha</th>
                      <th className="pb-2">Rāśi</th>
                      <th className="pb-2">Degree</th>
                      <th className="pb-2">Nakshatra</th>
                      <th className="pb-2">Natal House</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transits.map((tp) => {
                      const meta = GRAHAS[tp.key];
                      const sign = RASHIS[tp.signIndex];
                      const nak = NAKSHATRAS[tp.nakshatraIndex];
                      const natalHouse = ((tp.signIndex - chart.lagna.signIndex + 12) % 12) + 1;
                      return (
                        <tr key={tp.key} className="border-b border-gold/10 hover:bg-gold/5 transition-colors cursor-pointer" onClick={() => setSelectedPlanet(tp.key)}>
                          <td className="py-2 font-mono">
                            <span style={{ color: meta.colour.glow }}>{meta.symbol}</span> {meta.name}
                          </td>
                          <td className="py-2">{sign.name}</td>
                          <td className="py-2 font-mono">{dms(tp.degreeInSign)}</td>
                          <td className="py-2">{nak.name}</td>
                          <td className="py-2 text-center font-mono text-gold">{natalHouse}</td>
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
              <h3 className="display text-lg font-semibold text-bone mb-4">Key Transit Windows</h3>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-crimson/10 border border-crimson/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ color: GRAHAS.saturn.colour.glow }}>⚳</span>
                    <span className="font-semibold text-bone">Saturn Return</span>
                    <Tag tone="crimson">Major</Tag>
                  </div>
                  <p className="text-sm text-mute">First return: ages 28-30 · Second: 57-59 · Third: 87-89</p>
                </div>
                <div className="p-4 rounded-lg bg-steel/10 border border-steel/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ color: GRAHAS.jupiter.colour.glow }}>⚴</span>
                    <span className="font-semibold text-bone">Jupiter Transits</span>
                    <Tag tone="steel">Benefic</Tag>
                  </div>
                  <p className="text-sm text-mute">~12-year cycle through each rāśi. Current: {RASHIS[transits.find(t => t.key === 'jupiter')?.signIndex ?? 0].name}</p>
                </div>
                <div className="p-4 rounded-lg bg-violet/10 border border-violet/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ color: GRAHAS.rahu.colour.glow }}>☊</span>
                    <span className="font-semibold text-bone">Rāhu/Ketu Axis</span>
                    <Tag tone="violet">Karmic</Tag>
                  </div>
                  <p className="text-sm text-mute">18-month cycle per sign. Current axis: {RASHIS[transits.find(t => t.key === 'rahu')?.signIndex ?? 0].name}/{RASHIS[(transits.find(t => t.key === 'rahu')?.signIndex ?? 0 + 6) % 12].name}</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </>
  );
}

export const Route = createFileRoute("/sky")({
  validateSearch: (search) => search as { chart?: string },
  component: SkyPage,
});
