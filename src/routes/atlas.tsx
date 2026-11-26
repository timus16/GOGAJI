import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Starfield from '~/components/Starfield';
import { Reveal, Chapter, Readout, Divider, Tag, cx } from '~/lib/ui';
import { computeChart, type Chart } from '~/lib/astro';
import { GRAHAS, RASHIS, NAKSHATRAS, NAK_SPAN } from '~/content/vedic-mapping';
import { dms, rashiOf } from '~/lib/astro';

export default function AtlasPage() {
  const search = useSearch({ from: '/atlas' });
  const [chart, setChart] = useState<Chart | null>(null);
  const [selectedNak, setSelectedNak] = useState<number | null>(null);

  useEffect(() => {
    if (search.chart) {
      try {
        const parsed = JSON.parse(search.chart as string);
        setChart(parsed);
      } catch { }
    }
  }, [search.chart]);

  return (
    <>
      <Starfield density={0.5} className="fixed inset-0 -z-10" aria-hidden="true" />

      <div className="mx-auto max-w-5xl px-4 md:px-8 pb-16">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="display text-2xl md:text-3xl font-semibold text-bone">
              Nakshatra Atlas
            </h1>
            <p className="text-mute mt-1">
              {chart ? `Reference for ${chart.profile.name}` : 'All 27 lunar mansions'}
            </p>
          </div>
          {chart && (
            <Link to="/canvas" className="rounded-xl border border-gold/30 bg-void/60 px-4 py-2 font-serif text-sm tracking-wide text-bone hover:border-gold hover:bg-gold/10">
              Back to Canvas
            </Link>
          )}
        </div>

        <Reveal>
          <Chapter index="01" title="The 27 Nakshatras" sub="Each nakshatra spans 13°20' of the sidereal zodiac, divided into 4 padas of 3°20'. The Vimsottari dasa lord cycles through the 9 grahas in a fixed sequence." accent="text-gold" />
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NAKSHATRAS.map((nak, i) => {
            const graha = GRAHAS[nak.lord];
            return (
              <motion.article
                key={nak.name}
                className={cx('panel p-4 cursor-pointer transition-all hover:border-gold/50 hover:shadow-lg hover:shadow-gold/10', selectedNak === i && 'border-gold/50 ring-1 ring-gold/30')}
                onClick={() => setSelectedNak(selectedNak === i ? null : i)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.02 }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="display text-lg font-semibold text-bone">
                      {nak.name} <span className="text-gold">({nak.devanagari})</span>
                    </h3>
                    <p className="text-sm text-mute mt-1">#{nak.index} — {nak.gana} Gaṇa</p>
                  </div>
                  <Tag tone="gold">{nak.index}</Tag>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-mute">Deity</span>
                    <span className="text-bone">{nak.deityRoman}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-mute">Symbol</span>
                    <span className="text-bone">{nak.symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-mute">Lord</span>
                    <span className="text-violet">{graha.name} ({graha.devanagari})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-mute">Pada Syllables</span>
                    <div className="flex flex-wrap gap-1">
                      {nak.syllables.map((s, si) => (
                        <span key={si} className="mono text-xs px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold/20">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {chart && (
                  <>
                    <Divider className="my-3" />
                    <div className="text-center">
                      <span className={cx('mono text-xs uppercase tracking-widest px-3 py-1 rounded', chart.moon.nakshatraIndex === i ? 'bg-gold/20 text-gold' : 'text-mute/60')}>
                        {chart.moon.nakshatraIndex === i ? '✦ Your Janma Nakshatra ✦' : 'Not your birth nakshatra'}
                      </span>
                    </div>
                  </>
                )}
              </motion.article>
            );
          })}
        </div>

        {selectedNak !== null && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedNak(null)}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              className="panel w-full max-w-md max-h-[90vh] overflow-auto"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h2 className="display text-2xl font-semibold text-bone">
                      {NAKSHATRAS[selectedNak].name} <span className="text-gold">({NAKSHATRAS[selectedNak].devanagari})</span>
                    </h2>
                    <p className="text-mute mt-1">#{NAKSHATRAS[selectedNak].index} — {NAKSHATRAS[selectedNak].gana} Gaṇa</p>
                  </div>
                  <button onClick={() => setSelectedNak(null)} className="text-mute hover:text-gold transition-colors">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Readout label="Deity" value={NAKSHATRAS[selectedNak].deityRoman} tone="gold" />
                    <Readout label="Symbol" value={NAKSHATRAS[selectedNak].symbol} tone="mute" />
                    <Readout label="Lord" value={`${GRAHAS[NAKSHATRAS[selectedNak].lord].name} (${GRAHAS[NAKSHATRAS[selectedNak].lord].devanagari})`} tone="violet" />
                    <Readout label="Gana" value={NAKSHATRAS[selectedNak].gana} tone="steel" />
                  </div>

                  <Divider />

                  <div>
                    <h3 className="display text-lg font-semibold text-bone mb-3">Pada Syllables</h3>
                    <div className="flex flex-wrap gap-2">
                      {NAKSHATRAS[selectedNak].syllables.map((s, si) => (
                        <span key={si} className="mono text-sm px-3 py-1.5 rounded-lg bg-gold/10 text-gold border border-gold/20">
                          {s} <span className="text-mute/60 ml-1">({NAKSHATRAS[selectedNak].syllablesRoman[si]})</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <Divider />

                  {(() => {
                    const graha = GRAHAS[NAKSHATRAS[selectedNak].lord];
                    return (
                      <div>
                        <h3 className="display text-lg font-semibold text-bone mb-3">Lord's Bija Mantra</h3>
                        <div className="font-devanagari text-xl text-gold leading-relaxed">{graha.mantra.devanagari}</div>
                        <div className="mono text-sm text-mute mt-1">{graha.mantra.roman}</div>
                        <div className="text-sm text-mute/60 mt-1">{graha.mantra.gloss}</div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </>
  );
}

export const Route = createFileRoute("/atlas")({
  validateSearch: (search) => search as { chart?: string },
  component: AtlasPage,
});
