import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Starfield from '~/components/Starfield';
import { Reveal, Chapter, Readout, Divider, Tag, cx } from '~/lib/ui';
import { computeChart, computePanchang, vimshottariDasha, computeTransits, type Chart, type BirthInput, type TransitPosition } from '~/lib/astro';
import { GRAHAS, RASHIS, NAKSHATRAS, PROBLEM_AREA_MANTRAS, type ProblemArea } from '~/content/vedic-mapping';
import { dms, rashiOf } from '~/lib/astro';

function formatFixedDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getTodaysPanchang(chart: Chart): ReturnType<typeof computePanchang> {
  const now = new Date();
  return computePanchang(now, chart.offsetMinutes);
}

function getTransitPositions(chart: Chart): TransitPosition[] {
  const now = new Date();
  return computeTransits(now);
}

export default function RashifalPage() {
  const search = useSearch({ from: '/rashifal' });
  const [chart, setChart] = useState<Chart | null>(null);
  const [input, setInput] = useState<BirthInput | null>(null);
  const [today, setToday] = useState(new Date());

  useEffect(() => {
    if (search.chart) {
      try {
        const parsed = JSON.parse(search.chart as string);
        setChart(parsed);
        setInput(parsed.input);
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
          <h1 className="display text-3xl font-semibold text-bone">Daily Rashifal</h1>
          <p className="mt-4 text-mute">Create a chart first to view your daily horoscope.</p>
          <Link to="/chart" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-deep px-6 py-3 font-serif text-base tracking-wide text-void">
            Create Chart
          </Link>
        </div>
      </>
    );
  }

  const moon = chart.GRAHAS.find((p) => p.key === 'moon')!;
  const panchang = useMemo(() => getTodaysPanchang(chart), [chart]);
  const dasha = useMemo(() => vimshottariDasha(chart, 9), [chart]);
  const transit = useMemo(() => getTransitPositions(chart), [chart]);
  const moonRashi = RASHIS[chart.moonSign];
  const lagnaRashi = RASHIS[chart.lagna.signIndex];
  const currentDasha = dasha.periods[0];
  const balance = dasha.balance;

  const focusAreas: ProblemArea[] = ['career', 'wealth', 'relationships', 'health', 'education', 'spiritual', 'protection', 'family'];

  return (
    <>
      <Starfield density={0.5} className="fixed inset-0 -z-10" aria-hidden="true" />

      <div className="mx-auto max-w-7xl px-4 md:px-8 pb-16">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="display text-2xl md:text-3xl font-semibold text-bone">
              Daily Rashifal — {chart.input.name}
            </h1>
            <p className="text-mute mt-1">
              {formatFixedDate(today)} · {panchang.varaName} · {panchang.tithiName} {panchang.paksha} Paksha
            </p>
          </div>
          <Link to="/canvas" className="rounded-xl border border-gold/30 bg-void/60 px-4 py-2 font-serif text-sm tracking-wide text-bone hover:border-gold hover:bg-gold/10">
            Back to Canvas
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="space-y-8">
            <Reveal>
              <Chapter index="01" title="Today's Pañchāṅga" sub="The five limbs of time for today" accent="text-gold" />
              <div className="panel p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Readout label="Tithi" value={`${panchang.tithiName} (${panchang.paksha})`} tone="gold" />
                  <Readout label="Vāra" value={panchang.varaName} tone="steel" />
                  <Readout label="Nakṣatra" value={NAKSHATRAS[moon.nakshatraIndex].name} tone="violet" />
                  <Readout label="Yoga" value={panchang.yogaName} tone="jade" />
                  <Readout label="Karaṇa" value={panchang.karanaName} tone="rust" />
                  <Readout label="Māsa (Amānta)" value={panchang.lunarMonth.amantaName} tone="mute" />
                  <Readout label="Māsa (Pūrṇimānta)" value={panchang.lunarMonth.purnimantaName} tone="mute" />
                  <Readout label="Saṃvat" value={`${panchang.samvat.shaka} Śaka / ${panchang.samvat.vikram} Vikrama`} tone="mute" />
                </div>
              </div>
            </Reveal>

            <Reveal>
              <Chapter index="02" title="Current Daśā Period" sub="Vimśottarī daśā balance and running period" accent="text-gold" />
              <div className="panel p-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className={cx('p-4 rounded-lg border', 'bg-gold/10 border-gold/30')}>
                    <div className="text-xs text-mute uppercase tracking-widest">Mahādaśā Lord</div>
                    <div className="font-semibold text-bone mt-1">{currentDasha.lord} <span className="text-gold">({currentDasha.lordDevanagari})</span></div>
                    <div className="text-sm text-mute mt-1">{formatFixedDate(currentDasha.start)} — {formatFixedDate(currentDasha.end)}</div>
                    <div className="text-sm font-mono text-gold mt-1">{currentDasha.years.toFixed(2)} years</div>
                    <Tag tone="gold" className="mt-2">Current</Tag>
                  </div>
                  <div className={cx('p-4 rounded-lg border', 'bg-void/40 border-gold/10')}>
                    <div className="text-xs text-mute uppercase tracking-widest">Balance Remaining</div>
                    <div className="font-semibold text-bone mt-1">{balance.lord} ({balance.lordDevanagari})</div>
                    <div className="text-sm font-mono text-gold mt-1">{balance.yearsLeft.toFixed(2)} years</div>
                  </div>
                  <div className={cx('p-4 rounded-lg border', 'bg-void/40 border-gold/10')}>
                    <div className="text-xs text-mute uppercase tracking-widest">Janma Nakṣatra</div>
                    <div className="font-semibold text-bone mt-1">{NAKSHATRAS[moon.nakshatraIndex].name} <span className="text-gold">({NAKSHATRAS[moon.nakshatraIndex].devanagari})</span></div>
                    <div className="text-sm text-mute mt-1">Pada {moon.pada} · Syllable {NAKSHATRAS[moon.nakshatraIndex].syllablesRoman[moon.pada - 1]}</div>
                  </div>
                </div>
                <div className="mt-6 space-y-2">
                  {dasha.periods.slice(1, 4).map((period, i) => (
                    <div key={i} className={cx('flex items-center justify-between p-3 rounded-lg', 'bg-void/40 border border-gold/10')}>
                      <div>
                        <div className="font-semibold text-bone">{period.lord} ({period.lordDevanagari})</div>
                        <div className="text-sm text-mute">{formatFixedDate(period.start)} — {formatFixedDate(period.end)}</div>
                      </div>
                      <div className="font-mono text-gold">{period.years.toFixed(2)} years</div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal>
              <Chapter index="03" title="Planetary Transits Today" sub="Current sidereal positions" accent="text-gold" />
              <div className="panel p-6">
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-mute border-b border-gold/20">
                        <th className="pb-2 font-mono">Graha</th>
                        <th className="pb-2">Rāśi</th>
                        <th className="pb-2">Degree</th>
                        <th className="pb-2">Nakṣatra</th>
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
                          <tr key={p.key} className="border-b border-gold/10 hover:bg-gold/5 transition-colors">
                            <td className="py-2 font-mono">
                              <span style={{ color: meta.colour.glow }}>{meta.symbol}</span> {meta.name}
                            </td>
                            <td className="py-2">{sign.name}</td>
                            <td className="py-2 font-mono">{dms(p.degreeInSign)}</td>
                            <td className="py-2">{nak.name}</td>
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
              <Chapter index="04" title="Rashifal by Moon Sign" sub={moonRashi.name} accent="text-steel" />
              <div className="panel p-6">
                <div className="mb-6 p-4 bg-steel/10 border border-steel/30 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="text-4xl font-devanagari text-steel">{moonRashi.devanagari}</div>
                    <div>
                      <div className="display text-xl font-semibold text-bone">{moonRashi.name} Rāśi</div>
                      <div className="text-mute mt-1">Moon in {NAKSHATRAS[moon.nakshatraIndex].name} · Pada {moon.pada}</div>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {focusAreas.map((area) => {
                    const mantra = PROBLEM_AREA_MANTRAS[area];
                    const graha = GRAHAS[mantra.planet];
                    return (
                      <div key={area} className="p-4 bg-void/40 border border-gold/10 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="display text-sm font-semibold text-bone capitalize">{area}</h4>
                          <span className="text-xs text-gold">{graha.name}</span>
                        </div>
                        <p className="text-sm text-mute mb-3">{getRashifalText(area, moonRashi.name, chart)}</p>
                        <div className="text-[10px] text-gold/60 font-mono">{mantra.roman}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Reveal>

            <Reveal>
              <Chapter index="05" title="Lagna-Based Guidance" sub={lagnaRashi.name} accent="text-gold" />
              <div className="panel p-6">
                <div className="mb-6 p-4 bg-gold/10 border border-gold/30 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="text-4xl font-devanagari text-gold">{lagnaRashi.devanagari}</div>
                    <div>
                      <div className="display text-xl font-semibold text-bone">{lagnaRashi.name} Lagna</div>
                      <div className="text-mute mt-1">Ruling planet: {GRAHAS[lagnaRashi.lord].name} ({GRAHAS[lagnaRashi.lord].devanagari})</div>
                    </div>
                  </div>
                </div>
                <div className="prose prose-invert max-w-none text-sm text-mute">
                  <p>{getLagnaGuidance(lagnaRashi.name, chart)}</p>
                </div>
              </div>
            </Reveal>

            <Reveal>
              <Chapter index="06" title="Remedies & Mantras" sub="For today's planetary influences" accent="text-violet" />
              <div className="panel p-6 space-y-4">
                <div className="bg-violet/10 border border-violet/30 p-4 rounded-xl">
                  <h4 className="display text-sm font-semibold text-violet mb-2">Today's Primary Mantra</h4>
                  <div className="font-devanagari text-xl text-gold">{PROBLEM_AREA_MANTRAS.career.devanagari}</div>
                  <div className="mono text-sm text-mute mt-1">{PROBLEM_AREA_MANTRAS.career.roman}</div>
                  <div className="text-sm text-mute/60 mt-1">{PROBLEM_AREA_MANTRAS.career.gloss}</div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {['health', 'wealth', 'relationships', 'spiritual'].map((area) => {
                    const m = PROBLEM_AREA_MANTRAS[area as ProblemArea];
                    const g = GRAHAS[m.planet];
                    return (
                      <div key={area} className="p-3 bg-void/40 border border-gold/10 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <span style={{ color: g.colour.glow }} className="font-mono">{g.symbol}</span>
                          <span className="font-semibold text-bone capitalize">{area}</span>
                        </div>
                        <div className="text-[10px] text-gold/60 font-mono">{m.roman}</div>
                      </div>
                    );
                  })}
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
                  <Readout label="Birth" value={`${chart.input.date} · ${chart.input.time}`} tone="mute" />
                  <Readout label="Place" value={chart.input.place} tone="mute" />
                  <Readout label="Lagna" value={`${lagnaRashi.name} ({lagnaRashi.devanagari})`} tone="gold" />
                  <Readout label="Moon" value={`${moonRashi.name} · Pd {moon.pada} ({moonRashi.devanagari})`} tone="steel" />
                  <Readout label="Sun" value={RASHIS[chart.sunSign].name} tone="gold" />
                  <Readout label="Ruling Planet" value={GRAHAS[chart.rulingPlanet].name} tone="violet" />
                  <Readout label="Janma Nakṣatra" value={`${NAKSHATRAS[moon.nakshatraIndex].name} · Pada {moon.pada}`} tone="jade" />
                  <Readout label="Ayanaṃśa" value={`${chart.ayanamsa.toFixed(4)}°`} tone="mute" />
                </div>
              </div>
            </Reveal>

            <Reveal>
              <div className="panel p-6">
                <h3 className="display text-lg font-semibold text-bone mb-4">Navigate</h3>
                <div className="space-y-2">
                  <Link to="/dasha" className="block rounded-xl border border-gold/30 bg-void/60 p-4 hover:border-gold hover:bg-gold/10 transition-all">
                    <div className="font-semibold text-bone">Full Daśā Timeline</div>
                    <div className="text-sm text-mute mt-1">5-level Vimśottarī recursion with current periods</div>
                  </Link>
                  <Link to="/canvas" className="block rounded-xl border border-gold/30 bg-void/60 p-4 hover:border-gold hover:bg-gold/10 transition-all">
                    <div className="font-semibold text-bone">Chart Canvas</div>
                    <div className="text-sm text-mute mt-1">Zodiac wheel, rāśi charts, graha details</div>
                  </Link>
                  <Link to="/atlas" className="block rounded-xl border border-gold/30 bg-void/60 p-4 hover:border-gold hover:bg-gold/10 transition-all">
                    <div className="font-semibold text-bone">Nakṣatra Atlas</div>
                    <div className="text-sm text-mute mt-1">All 27 nakṣatras with deity, symbol, syllables</div>
                  </Link>
                  <Link to="/sky" className="block rounded-xl border border-gold/30 bg-void/60 p-4 hover:border-gold hover:bg-gold/10 transition-all">
                    <div className="font-semibold text-bone">Live Transits</div>
                    <div className="text-sm text-mute mt-1">Gochara overlaid on natal chart</div>
                  </Link>
                </div>
              </div>
            </Reveal>
          </aside>
        </div>
      </div>
    </>
  );
}

function getRashifalText(area: ProblemArea, moonSign: string, chart: Chart): string {
  const templates: Record<string, Record<string, string>> = {
    career: {
      'Meṣa': 'Strong initiative today. Lead with confidence but avoid impulsive decisions.',
      'Vṛṣabha': 'Steady progress. Financial matters favor careful planning over risks.',
      'Mithuna': 'Communication opens doors. Network and share ideas for opportunities.',
      'Karka': 'Emotional intelligence guides you. Trust instincts in professional matters.',
      'Siṃha': 'Natural leadership shines. Recognition comes through visible effort.',
      'Kanyā': 'Detail-oriented work excels. Perfectionism serves you well today.',
      'Tulā': 'Collaboration brings success. Seek partnerships and balanced decisions.',
      'Vṛścika': 'Deep focus yields results. Research and strategy favored over action.',
      'Dhanu': 'Expand horizons. Learning and teaching activities are highlighted.',
      'Makara': 'Discipline pays off. Long-term planning and structure bring rewards.',
      'Kumbha': 'Innovation leads. Unconventional approaches solve persistent problems.',
      'Mīna': 'Intuition guides career moves. Creative and service-oriented work thrives.',
    },
    wealth: {
      'Meṣa': 'Impulse spending risk. Delay major purchases; review budget first.',
      'Vṛṣabha': 'Excellent for investments. Tangible assets and savings grow steadily.',
      'Mithuna': 'Multiple income streams possible. Diversify but avoid speculation.',
      'Karka': 'Protect resources. Family-related expenses may arise unexpectedly.',
      'Siṃha': 'Generosity returns. Investments in self-development pay dividends.',
      'Kanyā': 'Meticulous accounting reveals savings. Cut waste, optimize resources.',
      'Tulā': 'Partnership ventures favorable. Joint finances need clear agreements.',
      'Vṛścika': 'Research before investing. Hidden opportunities in deep analysis.',
      'Dhanu': 'Foreign or distant connections bring gains. Expand financial horizons.',
      'Makara': 'Conservative growth. Long-term vehicles outperform quick trades.',
      'Kumbha': 'Innovative assets attract. Technology and future-sector investments.',
      'Mīna': 'Intuitive financial sense. Avoid schemes; trust proven methods.',
    },
    relationships: {
      'Meṣa': 'Direct communication clears air. Patience with loved ones essential.',
      'Vṛṣabha': 'Sensual connection deepens. Quality time over grand gestures.',
      'Mithuna': 'Intellectual bond strengthens. Talk through feelings openly.',
      'Karka': 'Emotional nurturing needed. Create safe space for vulnerability.',
      'Siṃha': 'Warmth and loyalty shine. Generosity of spirit attracts love.',
      'Kanyā': 'Service expresses love. Practical support means more than words.',
      'Tulā': 'Harmony is paramount. Compromise and fairness resolve tensions.',
      'Vṛścika': 'Depth and trust tested. Intimacy requires emotional honesty.',
      'Dhanu': 'Shared adventures bond. Freedom within commitment works best.',
      'Makara': 'Commitment demonstrated. Reliability builds lasting foundation.',
      'Kumbha': 'Friendship base essential. Mental connection precedes emotional.',
      'Mīna': 'Spiritual connection deepens. Compassion and forgiveness heal.',
    },
    health: {
      'Meṣa': 'Head/eyes sensitive. Cool down; avoid overheating and stress.',
      'Vṛṣabha': 'Throat/neck area. Hydrate; gentle stretches for tension.',
      'Mithuna': 'Shoulders/arms/breathing. Regular movement; avoid mental fatigue.',
      'Karka': 'Chest/stomach. Nourishing foods; emotional stress affects digestion.',
      'Siṃha': 'Heart/spine. Cardio moderation; posture awareness; joy as medicine.',
      'Kanyā': 'Digestive/nervous system. Routine meals; anxiety management.',
      'Tulā': 'Kidneys/lower back. Hydration; balance work-rest; harmony heals.',
      'Vṛścika': 'Reproductive/eliminatory. Detox; deep breathing; transformative rest.',
      'Dhanu': 'Hips/thighs/liver. Movement; moderation in indulgences; optimism.',
      'Makara': 'Knees/bones/skin. Calcium; structure; disciplined self-care.',
      'Kumbha': 'Ankles/circulation/nerves. Grounding practices; tech breaks.',
      'Mīna': 'Feet/lymphatic/immune. Rest; boundaries; water; spiritual practice.',
    },
    education: {
      'Meṣa': 'Quick learning but retention needs review. Active methods work.',
      'Vṛṣabha': 'Slow, deep mastery. Repetition and practice solidify knowledge.',
      'Mithuna': 'Natural curiosity. Multiple subjects; connect ideas across fields.',
      'Karka': 'Memory strong for emotional content. Story-based learning helps.',
      'Siṃha': 'Creative expression aids learning. Teach to learn; lead study groups.',
      'Kanyā': 'Analytical excellence. Detailed notes; systematic approach wins.',
      'Tulā': 'Collaborative learning. Discussions and debates clarify understanding.',
      'Vṛścika': 'Research depth. Investigative study; penetrate to core principles.',
      'Dhanu': 'Big picture first. Philosophy and principles; expand horizons.',
      'Makara': 'Structured curriculum. Milestones and credentials motivate.',
      'Kumbha': 'Innovative methods. Technology-aided; interdisciplinary synthesis.',
      'Mīna': 'Intuitive grasp. Artistic/creative approaches; holistic understanding.',
    },
    spiritual: {
      'Meṣa': 'Active meditation. Mantra with movement; fire ceremony.',
      'Vṛṣabha': 'Grounded practice. Nature connection; sensory devotion.',
      'Mithuna': 'Jñāna yoga. Study sacred texts; mantra repetition.',
      'Karka': 'Bhakti path. Heart-opening rituals; devotional singing.',
      'Siṃha': 'Solar worship. Sūrya namaskār; light meditation.',
      'Kanyā': 'Karma yoga. Selfless service; ritual precision as offering.',
      'Tulā': 'Balance practice. Harmony rituals; relationship as sadhana.',
      'Vṛścika': 'Transformation. Tantra; shadow work; deep meditation.',
      'Dhanu': 'Dharma study. Pilgrimage; higher knowledge; guru connection.',
      'Makara': 'Disciplined sādhana. Vows; austerity; mountain meditation.',
      'Kumbha': 'Community satsang. Group meditation; innovative spirituality.',
      'Mīna': 'Dissolution. Surrender; dream work; compassion practice.',
    },
    protection: {
      'Meṣa': 'Assertive boundaries. Protective mantra; red thread.',
      'Vṛṣabha': 'Material security. Earth grounding; stability rituals.',
      'Mithuna': 'Mental shield. Clarity mantra; communication boundaries.',
      'Karka': 'Emotional armor. Home protection; ancestral connection.',
      'Siṃha': 'Radiant shield. Solar mantra; confidence as protection.',
      'Kanyā': 'Purification. Cleansing rituals; discriminating awareness.',
      'Tulā': 'Harmony shield. Balance mantra; justice invocation.',
      'Vṛścika': 'Deep protection. Transformation shield; occult defense.',
      'Dhanu': 'Dharma armor. Truth mantra; philosophical fortress.',
      'Makara': 'Structural defense. Discipline; time-tested protections.',
      'Kumbha': 'Collective shield. Community; innovative safeguards.',
      'Mīna': 'Spiritual refuge. Surrender; compassion as ultimate protection.',
    },
    family: {
      'Meṣa': 'Lead with patience. Protect young; honor elders.',
      'Vṛṣabha': 'Nurture stability. Shared meals; material comfort.',
      'Mithuna': 'Communicate openly. Sibling bonds; generational dialogue.',
      'Karka': 'Deep emotional bonds. Home as sanctuary; maternal line.',
      'Siṃha': 'Generous heart. Celebrate lineage; creative legacy.',
      'Kanyā': 'Practical care. Organize family; health routines.',
      'Tulā': 'Fairness and peace. Mediate disputes; partnership model.',
      'Vṛścika': 'Transform patterns. Heal ancestral wounds; loyalty.',
      'Dhanu': 'Expand family. Teachers as kin; philosophical heritage.',
      'Makara': 'Honor tradition. Responsibility; structural support.',
      'Kumbha': 'Chosen family. Community bonds; progressive values.',
      'Mīna': 'Universal love. Compassion; spiritual ancestry; forgiveness.',
    },
  };

  return templates[area]?.[moonSign] || 'Favorable conditions. Trust your intuition and act with awareness.';
}

function getLagnaGuidance(lagnaSign: string, chart: Chart): string {
  const moon = chart.GRAHAS.find((p) => p.key === 'moon')!;
  const moonRashi = RASHIS[chart.moonSign];
  
  const guides: Record<string, string> = {
    'Meṣa': `With ${lagnaSign} rising, your path is one of initiation and courage. Today, the Moon in ${moonRashi.name} colors your emotional landscape. Lead with your natural pioneering spirit, but temper impulse with the wisdom of your current ${chart.moonNakshatra.name} nakṣatra. The ${GRAHAS[chart.rulingPlanet].name} daśa supports new beginnings.`,
    'Vṛṣabha': `Your ${lagnaSign} lagna gifts you steadfastness and sensual wisdom. The Moon in ${moonRashi.name} today asks you to cultivate what you value. Build slowly, enjoy the process, and trust that persistence yields fruit. Your ruling planet ${GRAHAS[lagnaRashi.lord].name} supports material and spiritual growth.`,
    'Mithuna': `With ${lagnaSign} rising, curiosity is your compass. The Moon in ${moonRashi.name} stimulates mental activity — channel it into meaningful exchange. Your dual nature finds integration through communication. ${GRAHAS[chart.rulingPlanet].name} daśa favors learning and connection.`,
    'Karka': `Your ${lagnaSign} lagna makes you the nurturer of the zodiac. Today's Moon in ${moonRashi.name} deepens your intuitive waters. Protect your sensitivity as strength. Home and heart are your power centers. The ${GRAHAS[chart.rulingPlanet].name} period supports emotional mastery.`,
    'Siṃha': `Radiant ${lagnaSign} rising — you are here to shine. The Moon in ${moonRashi.name} illuminates your creative self-expression. Lead with generosity; your warmth transforms others. Solar ruler ${GRAHAS[lagnaRashi.lord].name} in daśa amplifies your natural authority.`,
    'Kanyā': `Precise ${lagnaSign} rising — service through discernment. The Moon in ${moonRashi.name} sharpens your analytical mind. Perfectionism serves when directed to healing. Mercury's daśa supports skill refinement and systematic growth.`,
    'Tulā': `Harmonious ${lagnaSign} rising — balance is your art. The Moon in ${moonRashi.name} seeks equilibrium in relationship. Your diplomatic nature resolves conflicts. Venus daśa enhances aesthetic and relational fulfillment.`,
    'Vṛścika': `Intense ${lagnaSign} rising — transformation through depth. The Moon in ${moonRashi.name} penetrates surface appearances. Your investigative power reveals truth. Mars/Ketu daśa supports psychological and spiritual alchemy.`,
    'Dhanu': `Expansive ${lagnaSign} rising — wisdom through experience. The Moon in ${moonRashi.name} fuels philosophical quest. Your optimism inspires. Jupiter daśa opens doors to higher learning and dharmic alignment.`,
    'Makara': `Structured ${lagnaSign} rising — mastery through time. The Moon in ${moonRashi.name} grounds ambition in practical reality. Your discipline builds legacies. Saturn daśa rewards patience and responsible authority.`,
    'Kumbha': `Innovative ${lagnaSign} rising — freedom through community. The Moon in ${moonRashi.name} connects individuality to collective. Your visionary nature reforms. Saturn/Rahu daśa supports revolutionary and humanitarian work.`,
    'Mīna': `Transcendent ${lagnaSign} rising — unity through dissolution. The Moon in ${moonRashi.name} dissolves boundaries. Your compassion embraces all. Jupiter daśa deepens spiritual realization and artistic expression.`,
  };

  return guides[lagnaSign] || `Your ${lagnaSign} lagna guides your life path. The Moon in ${moonRashi.name} today influences your emotional experience. Trust the wisdom of your chart and the timing of your daśa periods.`;
}

export const Route = createFileRoute('/rashifal')({
  component: RashifalPage,
});