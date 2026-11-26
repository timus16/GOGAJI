import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { dms, formatOffset, rashiOf, type BirthInput, type Chart } from '~/lib/astro';
import { PRESETS, GRAHAS, NAKSHATRAS, presetById } from '~/content/vedic-mapping';
import { LIFE_AREAS, type LifeArea } from '~/content/problems';
import { buildWallpaperSvg, wallpaperFilename, type WallpaperOptions } from '~/lib/wallpaper';
import {
  DESKTOP, PHONE, downloadBlob, embeddedFontFaceCss, fontDataUris,
  previewFontFaceCss, svgToPngBlob,
} from '~/lib/exporter';
import { generateWallpaper, type Reading } from '~/server/ai';
import AiReading from './AiReading';
import { shouldCallAI } from '~/lib/qualification';
import { captureSubmit } from '~/lib/crm';
import { REGIONAL_SYSTEMS, type RegionalSystem } from '~/lib/regional-calculations';
import { generateInternalReport, type InternalAstrologyReport } from '~/lib/astrology-pipeline';
import { Reveal, cx } from '~/lib/ui';

type WallpaperRequestData = BirthInput & {
  presetId?: string;
  focusAreas?: string[];
  keys?: { gemini?: string; nvidia?: string };
};

type AiKeys = { gemini?: string; nvidia?: string };

const KEY_FIELDS: { id: keyof AiKeys; label: string }[] = [
  { id: 'gemini', label: 'Gemini' },
  { id: 'nvidia', label: 'NVIDIA' },
];

const AREA_LABELS: Record<LifeArea, string> = {
  career: 'Career & work',
  wealth: 'Wealth & finances',
  relationships: 'Relationships',
  health: 'Health & vitality',
  education: 'Education & study',
  spiritual: 'Spiritual growth',
  protection: 'Protection',
  family: 'Family & home',
};

const KEYS_STORAGE = 'gogaji.keys';

const readSavedKeys = (): AiKeys => {
  try {
    if (typeof localStorage === 'undefined') return {};
    const parsed = JSON.parse(localStorage.getItem(KEYS_STORAGE) ?? '{}') as AiKeys;
    return {
      gemini: typeof parsed.gemini === 'string' ? parsed.gemini : '',
      nvidia: typeof parsed.nvidia === 'string' ? parsed.nvidia : '',
    };
  } catch { return {}; }
};

const persistKeys = (k: AiKeys) => {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEYS_STORAGE, JSON.stringify(k)); }
  catch { }
};

const readLocal = (k: string): string => {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(k) ?? '' : ''; }
  catch { return ''; }
};

interface GenerateWallpaperProps {
  chart: Chart;
  input: BirthInput;
  onClose: () => void;
}

export default function GenerateWallpaper({ chart, input, onClose }: GenerateWallpaperProps) {
  const [preset, setPreset] = useState(PRESETS[0].id);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(false);
  const [aiReading, setAiReading] = useState<Reading | null>(null);
  const [aiWallpaper, setAiWallpaper] = useState<{ dataUrl: string; mime: string; width: number; height: number } | null>(null);
  const [aiBusy, setAiBusy] = useState<'reading' | 'wallpaper' | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<string | null>(null);
  const [aiInfo, setAiInfo] = useState<string | null>(null);
  const [aiArtBg, setAiArtBg] = useState(true);
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [aiKeys, setAiKeys] = useState<AiKeys>({ gemini: '', nvidia: '' });
  const [regionalSystem, setRegionalSystem] = useState<RegionalSystem>('vedic');
  const [internalReport, setInternalReport] = useState<InternalAstrologyReport | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [byokOpen, setByokOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setAiKeys(readSavedKeys()); }, []);

  const allAreasSelected = focusAreas.length === LIFE_AREAS.length;
  const toggleArea = (area: string) => {
    setFocusAreas((cur) => (cur.includes(area) ? cur.filter((a) => a !== area) : [...cur, area]));
  };
  const toggleAllAreas = () => {
    setFocusAreas(allAreasSelected ? [] : [...LIFE_AREAS]);
  };

  const updateKey = (field: keyof AiKeys, value: string) => {
    const next: AiKeys = { ...aiKeys };
    next[field] = value;
    setAiKeys(next);
    persistKeys(next);
  };
  const clearKey = (field: keyof AiKeys) => updateKey(field, '');
  const keysSaved = Boolean(aiKeys.gemini?.trim() || aiKeys.nvidia?.trim());

  const generate = async () => {
    setError(null);
    setNote(null);
    setAiInfo(null);
    try {
      const next = chart;
      buildWallpaperSvg({ chart: next, presetId: preset, width: PHONE.width, height: PHONE.height, fontFaceCss: previewFontFaceCss });
      try {
        const report = generateInternalReport(
          input,
          focusAreas,
          regionalSystem
        );
        setInternalReport(report);
      } catch (e) {
        console.error('Report generation failed:', e);
      }
      setNote(`Wallpaper drawn for ${next.moonNakshatra.name} · pada ${next.moonPada}.`);
      try {
        captureSubmit({
          input, presetId: preset,
          intent: readLocal('gogaji.intent'),
          previousFailure: readLocal('gogaji.previousFailure'),
          nakshatra: next.moonNakshatra.name,
          focusAreas,
        }, useAI);
      } catch { }
      requestAnimationFrame(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    } catch (err) {
      setError(`Could not build that wallpaper: ${err instanceof Error ? err.message : String(err)}`);
    }

    const aiGate = shouldCallAI(input, readLocal('gogaji.intent'));
    if (useAI && !aiGate.allow) {
      setAiInfo(aiGate.reason ?? 'AI step skipped for this request.');
    } else if (useAI) {
      setAiBusy('reading');
      setAiError(null);
      setAiInfo(null);
      setAiReading(null);
      setAiWallpaper(null);
      setAiProvider(null);
      let paintingTimer: ReturnType<typeof setTimeout> | null = null;
      try {
        paintingTimer = setTimeout(() => setAiBusy('wallpaper'), 3500);
        const sentKeys: NonNullable<WallpaperRequestData['keys']> = {};
        if (aiKeys.gemini?.trim()) sentKeys.gemini = aiKeys.gemini.trim();
            if (aiKeys.nvidia?.trim()) sentKeys.nvidia = aiKeys.nvidia.trim();
        const payload: WallpaperRequestData = {
          ...input, presetId: preset, focusAreas,
          ...(Object.keys(sentKeys).length > 0 ? { keys: sentKeys } : {}),
        };
        const res = await generateWallpaper({ data: payload });
        setAiReading(res.reading ?? null);
        setAiWallpaper(res.image ?? null);
        setAiError(res.error ?? null);
        if (res.provider) setAiProvider(res.provider);
      } catch (err) {
        setAiReading(null);
        setAiWallpaper(null);
        setAiProvider(null);
        setAiError(err instanceof Error ? err.message : typeof err === 'string' ? err : 'AI step unavailable. Please try again.');
      } finally {
        if (paintingTimer) clearTimeout(paintingTimer);
        setAiBusy(null);
      }
    } else {
      setAiReading(null); setAiWallpaper(null); setAiProvider(null); setAiError(null);
      setAiInfo(null);
    }
  };

  const aiBgUrl = useAI && aiArtBg && aiWallpaper ? aiWallpaper.dataUrl : undefined;

  const renderOpts = (c: Chart, width: number, height: number, fontFaceCss: string) => {
    const opts: WallpaperOptions & { backgroundImageUrl?: string } = {
      chart: c, presetId: preset, width, height, fontFaceCss, backgroundImageUrl: aiBgUrl,
    };
    return opts;
  };

  const drawing = useMemo(() => {
    try {
      return {
        svg: buildWallpaperSvg(renderOpts(chart, PHONE.width, PHONE.height, previewFontFaceCss)),
        error: null as string | null,
      };
    } catch (err) {
      return { svg: '', error: `Could not draw this style: ${err instanceof Error ? err.message : String(err)}` };
    }
  }, [chart, preset, aiBgUrl]);
  const svg = drawing.svg;

  const download = async (which: 'phone' | 'desktop') => {
    const size = which === 'phone' ? PHONE : DESKTOP;
    setBusy(which); setError(null);
    try {
      const uris = await fontDataUris();
      const full = buildWallpaperSvg(renderOpts(chart, size.width, size.height, embeddedFontFaceCss(uris)));
      const blob = await svgToPngBlob(full, size.width, size.height);
      downloadBlob(blob, wallpaperFilename(chart, size.width, size.height));
    } catch (err) {
      setError(`Export failed: ${String(err)}`);
    } finally { setBusy(null); }
  };

  const downloadAI = async () => {
    if (!aiWallpaper) return;
    setBusy('ai'); setError(null);
    try {
      const blob = await (await fetch(aiWallpaper.dataUrl)).blob();
      const safe = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'wallpaper';
      downloadBlob(blob, `nakshatra-canvas-ai-${safe}-${aiWallpaper.width}x${aiWallpaper.height}.png`);
    } catch (err) {
      setError(`Download failed: ${String(err)}`);
    } finally { setBusy(null); }
  };

  const g = GRAHAS[chart.rulingPlanet];
  const providerLabel = providerName(aiProvider);

  function providerName(p: string | null): string | null {
    if (!p) return null;
    if (p === 'gemini') return 'Gemini';
    return p;
  }

  const friendlyKeyError = typeof aiError === 'string' && aiError.includes('is not set') && !keysSaved;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="generate-title"
    >
      <motion.div
        className="panel w-full max-w-4xl max-h-[95vh] overflow-auto"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h2 id="generate-title" className="display text-2xl font-semibold text-bone">
                Generate Wallpaper
              </h2>
              <p className="text-mute mt-1">{chart.input.name} · {NAKSHATRAS[chart.moon.nakshatraIndex].name} · Pada {chart.moon.pada}</p>
            </div>
            <button onClick={onClose} className="text-mute hover:text-gold transition-colors" aria-label="Close">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
            <div className="space-y-6">
              <Reveal>
                <div className="panel p-6">
                  <h3 className="display text-lg font-semibold text-bone mb-4">Style Preset</h3>
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map((p) => (
                      <button key={p.id} type="button" onClick={() => setPreset(p.id)}
                        className={cx(
                          'rounded-xl border px-4 py-2 font-serif text-sm tracking-wide transition',
                          preset === p.id ? 'border-gold bg-gold/15 text-gold' : 'border-gold/20 bg-void/60 text-bone hover:border-gold/50'
                        )}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-mute">{presetById(preset).blurb}</p>
                </div>
              </Reveal>

              <Reveal>
                <div className="panel p-6">
                  <h3 className="display text-lg font-semibold text-bone mb-4">Regional Calculation</h3>
                  <select
                    value={regionalSystem}
                    onChange={(e) => setRegionalSystem(e.target.value as RegionalSystem)}
                    className="w-full rounded-xl border border-gold/20 bg-void/60 px-4 py-2 text-bone outline-none focus:border-gold"
                  >
                    {REGIONAL_SYSTEMS.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-sm text-mute">
                    {REGIONAL_SYSTEMS.find((r) => r.id === regionalSystem)?.description}
                  </p>
                </div>
              </Reveal>

              <Reveal>
                <div className="panel p-6">
                  <h3 className="display text-lg font-semibold text-bone mb-4">Focus Areas</h3>
                  <label className="flex items-center gap-2 text-sm text-bone mb-3">
                    <input type="checkbox" checked={allAreasSelected} onChange={toggleAllAreas} className="h-4 w-4 accent-gold" />
                    All-in-one · every area in one wallpaper
                  </label>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    {LIFE_AREAS.map((area) => (
                      <label key={area} className="flex items-center gap-2 text-sm text-bone">
                        <input type="checkbox" checked={focusAreas.includes(area)} onChange={() => toggleArea(area)} className="h-4 w-4 accent-gold" />
                        {AREA_LABELS[area]}
                      </label>
                    ))}
                  </div>
                </div>
              </Reveal>

              <Reveal>
                <div className="panel p-6">
                  <div className="mb-3 flex items-center gap-2">
                    <input id="use-ai-modal" type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} className="h-4 w-4 accent-gold" />
                    <label htmlFor="use-ai-modal" className="text-sm text-bone">AI reading & premium wallpaper</label>
                  </div>
                  <p className="text-xs text-mute/60 mb-3">Optional. The AI step calls an external model and sends your chart facts to it. Without it everything stays on your device.</p>

                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void generate()}
                      disabled={aiBusy !== null}
                      className="rounded-xl border border-gold/30 bg-void/60 px-4 py-2 font-serif text-sm tracking-wide text-bone hover:border-gold hover:bg-gold/10 disabled:opacity-50"
                    >
                      {aiBusy === 'reading' ? 'Consulting the Jyotish…' : aiBusy === 'wallpaper' ? 'Painting your wallpaper…' : 'Generate reading & wallpaper'}
                    </button>
                    {aiBusy && <span className="text-xs text-gold">AI step in progress…</span>}
                  </div>
                  {aiInfo && <p className="mb-3 rounded-lg border border-gold/20 bg-gold/10 p-2 text-xs text-gold">{aiInfo}</p>}

                  <div className="rounded-xl border border-gold/20 bg-void/40">
                    <button type="button" aria-expanded={byokOpen} onClick={() => setByokOpen((o) => !o)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-mute hover:text-gold">
                      <span>AI keys (bring your own)</span>
                      <span className="ml-2 shrink-0 text-[11px]">
                        {keysSaved ? <span className="text-jade">keys saved</span> : <span className="text-mute">not set</span>}
                      </span>
                    </button>
                    {byokOpen && (
                      <div className="grid gap-2 px-3 pb-3 border-t border-gold/10">
                        <p className="text-[11px] text-mute/60">
                          Optional. Stored only in this browser (masked, never logged) and sent only to the provider you choose.
                        </p>
                        {KEY_FIELDS.map((f) => (
                          <div key={f.id} className="flex items-center gap-1.5">
                            <input id={`byok-${f.id}`} type="password" autoComplete="off"
                              aria-label={`${f.label} API key`}
                              value={aiKeys[f.id] ?? ''} onChange={(e) => updateKey(f.id, e.target.value)}
                              placeholder={`${f.label} API key`}
                              className="w-full rounded-lg border border-gold/20 bg-void/60 px-2 py-1.5 text-xs text-bone outline-none focus:border-gold/60" />
                            {(aiKeys[f.id] ?? '') !== '' && (
                              <button type="button" onClick={() => clearKey(f.id)} aria-label={`Clear ${f.label} key`}
                                className="shrink-0 rounded-lg border border-gold/20 bg-void/60 px-2 py-1.5 text-xs text-mute hover:border-gold/60 hover:text-gold">·</button>
                            )}
                          </div>
                        ))}
                        <p className="mt-2 text-[0.7rem] text-mute/60">
                          Free keys: Google AI Studio (aistudio.google.com/apikey) for reading ·
                          NVIDIA (build.nvidia.com, key starts with nvapi-) for artwork.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Reveal>

              {aiError && (
                friendlyKeyError ? (
                  <div role="alert" className="rounded-xl border border-gold/25 bg-gold/10 p-4 text-sm text-gold">
                    <p>The chart wallpaper above is complete. Add your own AI keys to unlock the Vedic reading and premium artwork.</p>
                    <button type="button" onClick={() => setByokOpen(true)}
                      className="mt-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-1 text-xs text-gold hover:bg-gold/20">
                      Add AI keys
                    </button>
                  </div>
                ) : (
                  <div role="alert" className="rounded-xl border border-gold/25 bg-gold/10 p-4 text-sm text-gold">
                    <p className="break-words">{aiError}</p>
                    <p className="mt-1 text-xs text-mute">The chart-accurate wallpaper above still works.</p>
                  </div>
                )
              )}

              {aiReading && (
                <Reveal>
                  <section className="panel p-6">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <h3 className="display text-lg font-semibold text-bone">Your Vedic reading</h3>
                      {providerLabel && (
                        <span className="rounded-full border border-gold/25 bg-void/40 px-2 py-0.5 text-xs text-gold">
                          read by {providerLabel}
                        </span>
                      )}
                    </div>
                    <AiReading reading={aiReading} />
                  </section>
                </Reveal>
              )}

              {internalReport && (
                <Reveal>
                  <div className="panel p-6">
                    <button
                      type="button"
                      onClick={() => setShowReport(!showReport)}
                      className="flex w-full items-center justify-between text-left"
                    >
                      <h3 className="display text-lg font-semibold text-gold">Your Vedic Reading (Technical)</h3>
                      <span className="text-xs text-mute">{showReport ? 'Hide' : 'Show'}</span>
                    </button>
                    {showReport && (
                      <div className="mt-3 space-y-3 text-sm text-mute">
                        <div className="grid grid-cols-2 gap-2 rounded bg-white/5 p-3">
                          <div><span className="text-mute/60">Lagna</span><p className="font-medium text-bone">{internalReport.lagna}</p></div>
                          <div><span className="text-mute/60">Moon</span><p className="font-medium text-bone">{internalReport.moon}</p></div>
                          <div><span className="text-mute/60">Sun</span><p className="font-medium text-bone">{internalReport.sun}</p></div>
                          <div><span className="text-mute/60">Nakshatra</span><p className="font-medium text-bone">{internalReport.nakshatra} Pada {internalReport.pada}</p></div>
                        </div>
                        <div className="rounded bg-white/5 p-3">
                          <h4 className="mb-1 font-medium text-gold">Vimsottari Dasa</h4>
                          <p className="text-sm">
                            <span className="text-gold">
                              {internalReport.dasha.current
                                ? `${internalReport.dasha.current.lord} (${internalReport.dasha.current.lordDevanagari})`
                                : 'Not available'}
                            </span>
                            {' '}({internalReport.dasha.balance.lord} · {internalReport.dasha.balance.yearsLeft} years)
                          </p>
                          <p className="mt-1 text-xs text-mute/60">
                            Next: {internalReport.dasha.next
                              ? `${internalReport.dasha.next.lord} (${internalReport.dasha.next.lordDevanagari})`
                              : 'Not available'}
                          </p>
                        </div>
                        <div className="rounded bg-gold/10 p-3">
                          <h4 className="mb-1 font-medium text-gold">{internalReport.problemAnalysis.area} Analysis</h4>
                          <p className="text-xs text-mute/60">{internalReport.problemAnalysis.transitImpact}</p>
                          {internalReport.problemAnalysis.afflictedPlanets?.length > 0 && (
                            <div className="mt-2"><span className="text-xs text-mute/60">Affected: </span><span className="text-bone">{internalReport.problemAnalysis.afflictedPlanets.map(p => String(p?.name ?? '')).join(', ')}</span></div>
                          )}
                          {internalReport.problemAnalysis.remedies?.length > 0 && (
                            <div className="mt-2 border-t border-white/10 pt-2">
                              <span className="text-xs font-medium text-mute/60">Remedies: </span>
                              {internalReport.problemAnalysis.remedies.slice(0, 2).map((r, i) => (
                                <p key={i} className="text-xs text-mute/60">{String(r?.type ?? '')}: {String(r?.name ?? '')}</p>
                              ))}
                            </div>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs text-mute/60">Strength:</span>
                            <div className="h-1 w-16 rounded-full bg-white/10">
                              <div className={`h-1 rounded-full ${internalReport.problemAnalysis.strengthScore >= 70 ? 'bg-jade' : internalReport.problemAnalysis.strengthScore >= 40 ? 'bg-gold' : 'bg-crimson'}`} style={{ width: `${internalReport.problemAnalysis.strengthScore}%` }} />
                            </div>
                            <span className="text-xs">{internalReport.problemAnalysis.strengthScore}/100</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Reveal>
              )}
            </div>

            <aside className="space-y-6">
              <Reveal>
                <div className="panel p-6 sticky top-24" ref={previewRef}>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs uppercase tracking-widest text-mute">Preview</span>
                    {useAI && aiWallpaper && (
                      <div className="flex gap-1">
                        <button onClick={() => setAiArtBg(true)} className={cx('rounded-lg border px-2 py-1 text-xs transition', aiArtBg ? 'border-gold bg-gold/15 text-gold' : 'border-gold/20 text-mute hover:border-gold/50')}>AI Art</button>
                        <button onClick={() => setAiArtBg(false)} className={cx('rounded-lg border px-2 py-1 text-xs transition', !aiArtBg ? 'border-gold bg-gold/15 text-gold' : 'border-gold/20 text-mute hover:border-gold/50')}>Plain</button>
                      </div>
                    )}
                  </div>
                  <p className="mb-3 text-xs text-mute">{presetById(preset).blurb}</p>
                  <div className="aspect-square rounded-xl overflow-hidden border border-gold/20 bg-void">
                    {drawing.error ? (
                      <div className="flex h-full items-center justify-center p-4 text-center text-crimson text-sm">{drawing.error}</div>
                    ) : (
                      <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: svg }} />
                    )}
                  </div>
                  {drawing.error && <p className="mt-2 text-xs text-crimson">{drawing.error}</p>}
                </div>
              </Reveal>

              <Reveal>
                <div className="panel p-6 space-y-3">
                  <button
                    onClick={() => download('phone')}
                    disabled={busy !== null}
                    className="w-full rounded-xl border border-gold/30 bg-void/60 px-4 py-3 font-serif text-base tracking-wide text-bone hover:border-gold hover:bg-gold/10 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    {busy === 'phone' ? 'Generating…' : 'Download Phone (1080×1920)'}
                  </button>
                  <button
                    onClick={() => download('desktop')}
                    disabled={busy !== null}
                    className="w-full rounded-xl border border-gold/30 bg-void/60 px-4 py-3 font-serif text-base tracking-wide text-bone hover:border-gold hover:bg-gold/10 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    {busy === 'desktop' ? 'Generating…' : 'Download Desktop (1920×1080)'}
                  </button>
                  {useAI && aiWallpaper && (
                    <button
                      onClick={downloadAI}
                      disabled={busy === 'ai'}
                      className="w-full rounded-xl border border-violet/30 bg-violet/10 px-4 py-3 font-serif text-base tracking-wide text-violet hover:border-violet hover:bg-violet/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      {busy === 'ai' ? 'Downloading…' : 'Download AI Art Background'}
                    </button>
                  )}
                  {error && <p className="text-xs text-crimson text-center">{error}</p>}
                  {!error && note && <p className="text-xs text-jade text-center">{note}</p>}
                </div>
              </Reveal>

              <Reveal>
                <div className="panel p-6">
                  <h3 className="display text-lg font-semibold text-bone mb-4">Chart Summary</h3>
                  <dl className="space-y-2 text-sm text-mute">
                    <div className="flex justify-between"><dt>Moon Nakshatra</dt><dd className="text-bone">{chart.moonNakshatra.name} · Pada {chart.moonPada}</dd></div>
                    <div className="flex justify-between"><dt>Lagna</dt><dd className="text-bone">{rashiOf(chart.lagna.signIndex).name} {dms(chart.lagna.degreeInSign)}</dd></div>
                    <div className="flex justify-between"><dt>Moon Rāśi</dt><dd className="text-bone">{rashiOf(chart.moonSign).name}</dd></div>
                    <div className="flex justify-between"><dt>Ruling Planet</dt><dd className="text-bone">{g.name} ({g.devanagari})</dd></div>
                    <div className="flex justify-between"><dt>Yantra</dt><dd className="text-bone">{g.yantra ? `${g.yantra.order}×${g.yantra.order}` : 'Geometric'}</dd></div>
                    <div className="flex justify-between"><dt>Birth Instant</dt><dd className="text-bone">{chart.utc.toISOString().replace('.000Z', ' UTC')} ({formatOffset(chart.offsetMinutes)})</dd></div>
                    <div className="flex justify-between"><dt>Lahiri Ayanāṃśa</dt><dd className="text-bone">{chart.ayanamsa.toFixed(4)}°</dd></div>
                  </dl>
                </div>
              </Reveal>
            </aside>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}