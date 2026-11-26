import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Starfield from '~/components/Starfield';
import { Reveal, Chapter, Readout, Divider, Tag, cx } from '~/lib/ui';
import { computeChart, vimshottariDasha, type Chart } from '~/lib/astro';
import { RASHIS, NAKSHATRAS } from '~/content/vedic-mapping';
import { dms, rashiOf } from '~/lib/astro';

function formatFixedDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function DashaPage() {
  const search = useSearch({ from: '/dasha' });
  const [chart, setChart] = useState<Chart | null>(null);
  const [dashaData, setDashaData] = useState<ReturnType<typeof vimshottariDasha> | null>(null);
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (search.chart) {
      try {
        const parsed = JSON.parse(search.chart as string);
        setChart(parsed);
        setDashaData(vimshottariDasha(parsed, 9));
      } catch { }
    }
  }, [search.chart]);

  if (!chart || !dashaData) {
    return (
      <>
        <Starfield density={0.5} className="fixed inset-0 -z-10" aria-hidden="true" />
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="display text-3xl font-semibold text-bone">Dasa Timeline</h1>
          <p className="mt-4 text-mute">Create a chart first to view your Vimsottari dasa.</p>
          <Link to="/chart" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-deep px-6 py-3 font-serif text-base tracking-wide text-void">
            Create Chart
          </Link>
        </div>
      </>
    );
  }

  const moon = chart.GRAHAS.find((p) => p.key === 'moon')!;
  const current = dashaData.periods[0];
  const balance = dashaData.balance;

  return (
    <>
      <Starfield density={0.5} className="fixed inset-0 -z-10" aria-hidden="true" />

      <div className="mx-auto max-w-5xl px-4 md:px-8 pb-16">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="display text-2xl md:text-3xl font-semibold text-bone">
              Vimsottari Dasa -- {chart.input.name}
            </h1>
            <p className="text-mute mt-1">
              {NAKSHATRAS[moon.nakshatraIndex].name} . Pada {moon.pada} . 120-year cycle
            </p>
          </div>
          <Link to="/canvas" className="rounded-xl border border-gold/30 bg-void/60 px-4 py-2 font-serif text-sm tracking-wide text-bone hover:border-gold hover:bg-gold/10">
            Back to Canvas
          </Link>
        </div>

        <Reveal>
          <div className="panel p-6 mb-8">
            <div className="grid gap-4 md:grid-cols-3">
              <Readout label="Mahadasa Lord" value={`${current?.lord || '--'}`} tone="gold" />
              <Readout label="Balance" value={`${balance} years remaining`} tone="steel" />
              <Readout label="Period" value={`${balance ? '...' : 'Complete'}`} tone="violet" />
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="panel p-6">
            <h3 className="display text-lg font-semibold text-bone mb-4">Complete Dasa Sequence</h3>
            <div className="space-y-2">
              {dashaData.periods.map((period, i) => (
                <motion.div
                  key={i}
                  className={cx('flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg transition-all', i === 0 ? 'bg-gold/10 border border-gold/30' : 'bg-void/40 border border-gold/10 hover:border-gold/30')}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                >
                  <div className="flex items-center gap-4">
                    <div className={cx('w-10 h-10 rounded-lg flex items-center justify-center font-mono text-lg', i === 0 ? 'bg-gold/20 text-gold' : 'bg-slate2 text-mute')}>
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-bone">{period.lord} <span className="text-gold">({period.lordDevanagari})</span></div>
                      <div className="text-sm text-mute">{formatFixedDate(period.start)} -- {formatFixedDate(period.end)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right md:text-left">
                    <div className="font-mono text-gold">{period.years.toFixed(2)} years</div>
                    {i === 0 && <Tag tone="gold">Current</Tag>}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="panel p-6 mt-8">
            <h3 className="display text-lg font-semibold text-bone mb-4">Upcoming Transitions</h3>
            <div className="space-y-2">
              {dashaData.periods.slice(1, 4).map((period, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-void/40 border border-gold/10">
                  <div>
                    <div className="font-semibold text-bone">{period.lord} <span className="text-gold">({period.lordDevanagari})</span></div>
                    <div className="text-sm text-mute">Begins {formatFixedDate(period.start)}</div>
                  </div>
                  <div className="font-mono text-gold">{period.years.toFixed(2)} years</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </>
  );
}

export const Route = createFileRoute("/dasha")({
  validateSearch: (search) => search as { chart?: string },
  component: DashaPage,
});





