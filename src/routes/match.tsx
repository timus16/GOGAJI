import { Link, useSearch, createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Starfield from '~/components/Starfield';
import { Reveal, Readout, Divider, Tag, Chapter, cx } from '~/lib/ui';
import { computeChart, type Chart, type BirthInput } from '~/lib/astro';
import { GRAHAS, RASHIS, NAKSHATRAS, NAK_SPAN } from '~/content/vedic-mapping';
import { dms, rashiOf } from '~/lib/astro';

const KOOTAS = [
  { key: 'varna', name: 'Varṇa', max: 1, desc: 'Spiritual compatibility' },
  { key: 'vashya', name: 'Vaśya', max: 2, desc: 'Mutual attraction' },
  { key: 'tara', name: 'Tāra', max: 3, desc: 'Birth star harmony' },
  { key: 'yoni', name: 'Yoni', max: 4, desc: 'Sexual compatibility' },
  { key: 'grahaMaitri', name: 'Graha Maitrī', max: 5, desc: 'Planetary friendship' },
  { key: 'gana', name: 'Gaṇa', max: 6, desc: 'Temperament match' },
  { key: 'bhakoota', name: 'Bhakūṭa', max: 7, desc: 'Moon sign relationship' },
  { key: 'nadi', name: 'Nāḍī', max: 8, desc: 'Genetic compatibility' },
] as const;

function calculateAshtakoota(chart1: Chart, chart2: Chart) {
  const moon1 = chart1.GRAHAS.find(p => p.key === 'moon')!;
  const moon2 = chart2.GRAHAS.find(p => p.key === 'moon')!;
  const nak1 = NAKSHATRAS[moon1.nakshatraIndex];
  const nak2 = NAKSHATRAS[moon2.nakshatraIndex];
  const rasi1 = moon1.signIndex;
  const rasi2 = moon2.signIndex;
  const lord1 = GRAHAS[nak1.lord];
  const lord2 = GRAHAS[nak2.lord];

  const diff = (rasi1 - rasi2 + 12) % 12;
  const taraDiff = (moon2.nakshatraIndex - moon1.nakshatraIndex + 27) % 27;

  let varna = 0;
  const varnaMap: Record<number, number> = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 1, 5: 2, 6: 3, 7: 4, 8: 1, 9: 2, 10: 3, 11: 4 };
  if (varnaMap[rasi1] >= varnaMap[rasi2]) varna = 1;

  let vashya = 0;
  const vashyaGroups = [[0, 4, 7, 10], [1, 5, 8, 11], [2, 6, 9], [3]];
  const g1 = vashyaGroups.findIndex(g => g.includes(rasi1));
  const g2 = vashyaGroups.findIndex(g => g.includes(rasi2));
  if (g1 === g2) vashya = 2;

  let tara = 0;
  if (taraDiff <= 9 || taraDiff >= 18) tara = 3;
  else if (taraDiff <= 13 || taraDiff >= 14) tara = 1.5;

  let yoni = 0;
  const yoniAnimals = ['Horse', 'Elephant', 'Sheep', 'Serpent', 'Dog', 'Cat', 'Rat', 'Cow', 'Buffalo', 'Tiger', 'Hare', 'Mongoose', 'Monkey', 'Lion', 'Horse', 'Elephant', 'Sheep', 'Serpent', 'Dog', 'Cat', 'Rat', 'Cow', 'Buffalo', 'Tiger', 'Hare', 'Mongoose', 'Monkey'];
  if (yoniAnimals[moon1.nakshatraIndex] === yoniAnimals[moon2.nakshatraIndex]) yoni = 4;
  else if (Math.abs(moon1.nakshatraIndex - moon2.nakshatraIndex) % 14 === 0) yoni = 2;

  let grahaMaitri = 0;
  const friends: Record<string, string[]> = {
    sun: ['moon', 'mars', 'jupiter'],
    moon: ['sun', 'mercury'],
    mars: ['sun', 'moon', 'jupiter'],
    mercury: ['sun', 'venus'],
    jupiter: ['sun', 'moon', 'mars'],
    venus: ['mercury', 'saturn'],
    saturn: ['mercury', 'venus'],
    rahu: ['venus', 'saturn'],
    ketu: ['mars', 'saturn'],
  };
  if (friends[nak1.lord]?.includes(nak2.lord)) grahaMaitri = 5;
  else if (nak1.lord === nak2.lord) grahaMaitri = 4;

  let gana = 0;
  if (nak1.gana === nak2.gana) gana = 6;
  else if ((nak1.gana === 'Deva' && nak2.gana === 'Manushya') || (nak1.gana === 'Manushya' && nak2.gana === 'Deva')) gana = 5;

  let bhakoota = 0;
  if (diff === 0 || diff === 7) bhakoota = 7;
  else if (diff === 1 || diff === 6 || diff === 11) bhakoota = 0;

  let nadi = 0;
  const nadiMap: Record<number, number> = { 0: 1, 1: 2, 2: 3, 3: 1, 4: 2, 5: 3, 6: 1, 7: 2, 8: 3, 9: 1, 10: 2, 11: 3, 12: 1, 13: 2, 14: 3, 15: 1, 16: 2, 17: 3, 18: 1, 19: 2, 20: 3, 21: 1, 22: 2, 23: 3, 24: 1, 25: 2, 26: 3 };
  if (nadiMap[moon1.nakshatraIndex] !== nadiMap[moon2.nakshatraIndex]) nadi = 8;

  const total = varna + vashya + tara + yoni + grahaMaitri + gana + bhakoota + nadi;

  return {
    varna, vashya, tara, yoni, grahaMaitri, gana, bhakoota, nadi, total,
    details: { nak1, nak2, rasi1, rasi2, lord1, lord2 },
  };
}

export default function MatchPage() {
  const search = useSearch({ from: '/match' });
  const [chart1, setChart1] = useState<Chart | null>(null);
  const [chart2, setChart2] = useState<Chart | null>(null);
  const [result, setResult] = useState<ReturnType<typeof calculateAshtakoota> | null>(null);
  const [input2, setInput2] = useState<Partial<BirthInput>>({});

  useEffect(() => {
    if (search.chart) {
      try {
        const parsed = JSON.parse(search.chart as string);
        setChart1(parsed);
      } catch { }
    }
  }, [search.chart]);

  const handleGenerate = () => {
    if (!chart1) return;
    if (!input2.name || !input2.date || !input2.time || !input2.latitude || !input2.longitude || !input2.timezone) {
      alert('Please fill all fields for the second person');
      return;
    }
    const c2 = computeChart(input2 as BirthInput);
    setChart2(c2);
    setResult(calculateAshtakoota(chart1, c2));
  };

  if (!chart1) {
    return (
      <>
        <Starfield density={0.5} className="fixed inset-0 -z-10" aria-hidden="true" />
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="display text-3xl font-semibold text-bone">Matchmaking</h1>
          <p className="mt-4 text-mute">Create your chart first, then compare with another.</p>
          <Link to="/chart" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-deep px-6 py-3 font-serif text-base tracking-wide text-void">
            Create Chart
          </Link>
        </div>
      </>
    );
  }

  const moon1 = chart1.GRAHAS.find(p => p.key === 'moon')!;

  return (
    <>
      <Starfield density={0.5} className="fixed inset-0 -z-10" aria-hidden="true" />

      <div className="mx-auto max-w-5xl px-4 md:px-8 pb-16">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="display text-2xl md:text-3xl font-semibold text-bone">
              Aṣṭakūṭa Match · {chart1.input.name}
            </h1>
            <p className="text-mute mt-1">
              {NAKSHATRAS[moon1.nakshatraIndex].name} · Pada {moon1.pada} · 36 Guṇas
            </p>
          </div>
          <Link to="/canvas" className="rounded-xl border border-gold/30 bg-void/60 px-4 py-2 font-serif text-sm tracking-wide text-bone hover:border-gold hover:bg-gold/10">
            Back to Canvas
          </Link>
        </div>

        {!chart2 && (
          <Reveal>
            <div className="panel p-6 max-w-xl">
              <h3 className="display text-lg font-semibold text-bone mb-4">Enter Second Person's Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-mute mb-1">Name</label>
                  <input value={input2.name || ''} onChange={e => setInput2({ ...input2, name: e.target.value })} placeholder="Name" className="w-full rounded-xl border border-gold/20 bg-void/60 px-4 py-2 text-bone outline-none focus:border-gold" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-mute mb-1">Date (YYYY-MM-DD)</label>
                    <input value={input2.date || ''} onChange={e => setInput2({ ...input2, date: e.target.value })} placeholder="1995-03-22" className="w-full rounded-xl border border-gold/20 bg-void/60 px-4 py-2 text-bone outline-none focus:border-gold" />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-mute mb-1">Time (HH:MM)</label>
                    <input value={input2.time || ''} onChange={e => setInput2({ ...input2, time: e.target.value })} placeholder="14:30" className="w-full rounded-xl border border-gold/20 bg-void/60 px-4 py-2 text-bone outline-none focus:border-gold" />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-mute mb-1">Timezone</label>
                    <input value={input2.timezone || 'Asia/Kolkata'} onChange={e => setInput2({ ...input2, timezone: e.target.value })} placeholder="Asia/Kolkata" className="w-full rounded-xl border border-gold/20 bg-void/60 px-4 py-2 text-bone outline-none focus:border-gold" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-mute mb-1">Latitude</label>
                    <input value={input2.latitude || ''} onChange={e => setInput2({ ...input2, latitude: Number(e.target.value) })} placeholder="28.6139" type="number" step="any" className="w-full rounded-xl border border-gold/20 bg-void/60 px-4 py-2 text-bone outline-none focus:border-gold" />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-mute mb-1">Longitude</label>
                    <input value={input2.longitude || ''} onChange={e => setInput2({ ...input2, longitude: Number(e.target.value) })} placeholder="77.209" type="number" step="any" className="w-full rounded-xl border border-gold/20 bg-void/60 px-4 py-2 text-bone outline-none focus:border-gold" />
                  </div>
                </div>
                <button onClick={handleGenerate} className="w-full rounded-xl bg-gradient-to-r from-gold to-gold-deep px-6 py-3 font-serif text-base tracking-wide text-void hover:from-gold-light hover:to-gold">
                  Calculate Match
                </button>
              </div>
            </div>
          </Reveal>
        )}

        {chart2 && result && (
          <>
            <Reveal>
              <div className="panel p-6 mb-8">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center p-4 rounded-xl bg-gold/10 border border-gold/30">
                    <div className="display text-4xl font-semibold text-gold">{result.total}</div>
                    <div className="text-mute mt-1">/ 36 Guṇas</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-void/40 border border-gold/10">
                    <div className="font-semibold text-bone">{chart1.input.name}</div>
                    <div className="text-sm text-mute">{NAKSHATRAS[moon1.nakshatraIndex].name} · {RASHIS[moon1.signIndex].name}</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-void/40 border border-gold/10">
                    <div className="font-semibold text-bone">{chart2.input.name}</div>
                    <div className="text-sm text-mute">{NAKSHATRAS[chart2.GRAHAS.find(p => p.key === 'moon')!.nakshatraIndex].name} · {RASHIS[chart2.GRAHAS.find(p => p.key === 'moon')!.signIndex].name}</div>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal>
              <Chapter index="01" title="Koṭa Breakdown" accent="text-gold" />
              <div className="panel p-6 space-y-2">
                {KOOTAS.map((k, i) => {
                  const score = result[k.key as keyof typeof result] as number;
                  const max = k.max;
                  const pct = max > 0 ? (score / max) * 100 : 0;
                  return (
                    <motion.div
                      key={k.key}
                      className="flex items-center justify-between gap-4 p-3 rounded-lg bg-void/40 border border-gold/10"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-bone">{k.name}</span>
                          <Tag tone={pct === 100 ? 'jade' : pct >= 75 ? 'gold' : pct >= 50 ? 'steel' : 'crimson'}>{score}/{max}</Tag>
                        </div>
                        <div className="mt-1 h-1.5 bg-void/40 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-gold to-gold-deep"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, delay: 0.2 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                          />
                        </div>
                      </div>
                      <div className="text-sm text-mute/60 w-40 text-right">{k.desc}</div>
                    </motion.div>
                  );
                })}
              </div>
            </Reveal>

            <Reveal>
              <Chapter index="02" title="Interpretation" accent="text-steel" />
              <div className="panel p-6">
                <div className="prose text-mute leading-relaxed">
                  {result.total >= 28 && (
                    <p className="text-jade">Excellent match (≥28/36). Strong compatibility across most koṭas.</p>
                  )}
                  {result.total >= 21 && result.total < 28 && (
                    <p className="text-gold">Good match (21-27/36). Favorable with some areas needing attention.</p>
                  )}
                  {result.total >= 18 && result.total < 21 && (
                    <p className="text-rust">Average match (18-20/36). Significant differences in key koṭas; remedies recommended.</p>
                  )}
                  {result.total < 18 && (
                    <p className="text-crimson">Challenging match ({'<'}18/36). Major incompatibilities; detailed analysis advised.</p>
                  )}
                  <p className="mt-4 text-sm text-mute/60">
                    Note: Aṣṭakūṭa is one of several compatibility systems. Consider Graha Maitrī, Daśā sandhi, and individual chart strengths for a complete picture.
                  </p>
                </div>
              </div>
            </Reveal>
          </>
        )}
      </div>
    </>
  );
}

export const Route = createFileRoute("/match")({
  validateSearch: (search) => search as { chart?: string },
  component: MatchPage,
});
