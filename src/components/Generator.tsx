import { useMemo, useRef, useState } from "react";
import { computeChart, dms, formatOffset, rashiOf, type BirthInput, type Chart } from "~/lib/astro";
import { PRESETS, GRAHAS, presetById } from "~/content/vedic-mapping";
import { buildWallpaperSvg, wallpaperFilename } from "~/lib/wallpaper";
import {
  DESKTOP, PHONE, downloadBlob, embeddedFontFaceCss, fontDataUris,
  previewFontFaceCss, svgToPngBlob,
} from "~/lib/exporter";
import { generateWallpaper, type Reading } from "~/server/ai";
import AiReading from "./AiReading";

interface Place {
  label: string;
  latitude: number;
  longitude: number;
  timezone: string | null;
}

const ALL_ZONES: string[] = (() => {
  try {
    const v = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    return v ? v("timeZone") : ["Asia/Kolkata", "UTC"];
  } catch { return ["Asia/Kolkata", "UTC"]; }
})();

/** A rough zone guess from longitude, used only to pre-select the dropdown. */
function guessZone(lon: number): string {
  const offsets = [["Pacific/Honolulu", -157.5], ["America/Anchorage", -150], ["America/Los_Angeles", -120],
    ["America/Denver", -105], ["America/Chicago", -90], ["America/New_York", -75], ["America/Sao_Paulo", -45],
    ["Atlantic/Azores", -25], ["Europe/London", 0], ["Europe/Paris", 15], ["Europe/Athens", 25],
    ["Europe/Moscow", 37.5], ["Asia/Dubai", 55], ["Asia/Karachi", 67.5], ["Asia/Kolkata", 82.5],
    ["Asia/Kathmandu", 86], ["Asia/Dhaka", 90], ["Asia/Bangkok", 100], ["Asia/Shanghai", 120],
    ["Asia/Tokyo", 140], ["Australia/Sydney", 150], ["Pacific/Auckland", 175]] as [string, number][];
  let best = "UTC", bd = 1e9;
  for (const [z, l] of offsets) { const d = Math.abs(l - lon); if (d < bd) { bd = d; best = z; } }
  return best;
}

async function searchPlaces(q: string): Promise<Place[]> {
  // 1. Open-Meteo geocoding — gives lat/lon AND the IANA zone in one call.
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`, { signal: AbortSignal.timeout(7000) });
    if (r.ok) {
      const j = await r.json();
      const out = (j.results ?? []).map((x: Record<string, unknown>) => ({
        label: [x.name, x.admin1, x.country].filter(Boolean).join(", "),
        latitude: x.latitude as number,
        longitude: x.longitude as number,
        timezone: (x.timezone as string) ?? null,
      }));
      if (out.length) return out;
    }
  } catch { /* fall through to the next provider */ }
  // 2. Photon (Komoot) — coordinates only, zone arrives from the next step.
  try {
    const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6`, { signal: AbortSignal.timeout(7000) });
    if (r.ok) {
      const j = await r.json();
      const out = (j.features ?? []).map((f: { properties: Record<string, string>; geometry: { coordinates: number[] } }) => ({
        label: [f.properties.name, f.properties.state, f.properties.country].filter(Boolean).join(", "),
        latitude: f.geometry.coordinates[1],
        longitude: f.geometry.coordinates[0],
        timezone: null,
      }));
      if (out.length) return out;
    }
  } catch { /* fall through */ }
  // 3. Nominatim (OpenStreetMap)
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1`, { signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const j = await r.json();
      return j.map((x: { display_name: string; lat: string; lon: string }) => ({
        label: x.display_name,
        latitude: Number(x.lat), longitude: Number(x.lon), timezone: null,
      }));
    }
  } catch { /* give up quietly — manual entry stays available */ }
  return [];
}

async function zoneFor(lat: number, lon: number): Promise<string | null> {
  try {
    const r = await fetch(`https://timeapi.io/api/TimeZone/coordinate?latitude=${lat}&longitude=${lon}`, { signal: AbortSignal.timeout(7000) });
    if (r.ok) {
      const j = await r.json();
      if (j.timeZone) return j.timeZone as string;
    }
  } catch { /* fall back to the dropdown guess */ }
  return null;
}

/** Human label for the LLM provider badge, e.g. "Gemini" / "OpenRouter". */
function providerName(p: string | null): string | null {
  if (!p) return null;
  if (p === "gemini") return "Gemini";
  if (p === "openrouter") return "OpenRouter";
  return p;
}

export default function Generator() {
  const [name, setName] = useState("");
  const [date, setDate] = useState("1992-08-14");
  const [time, setTime] = useState("05:45");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [manual, setManual] = useState(false);
  const [place, setPlace] = useState({ label: "", latitude: 28.6139, longitude: 77.209, timezone: "Asia/Kolkata" });
  const [preset, setPreset] = useState(PRESETS[0].id);
  const [chart, setChart] = useState<Chart | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [zoneNote, setZoneNote] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(true);
  const [aiReading, setAiReading] = useState<Reading | null>(null);
  const [aiWallpaper, setAiWallpaper] = useState<{ dataUrl: string; mime: string; width: number; height: number } | null>(null);
  const [aiBusy, setAiBusy] = useState<"reading" | "wallpaper" | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<string | null>(null);
  const [view, setView] = useState<"chart" | "ai">("chart");
  const previewRef = useRef<HTMLDivElement | null>(null);

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true); setError(null);
    const found = await searchPlaces(query.trim());
    setResults(found);
    setSearching(false);
    if (!found.length) { setError("No place found — enter latitude, longitude and timezone below and you can still continue."); setManual(true); }
  };

  /**
   * Selecting a place must be instant and must never wait on the network.
   * The zone we can derive locally (open-meteo's answer, or a longitude guess)
   * is applied synchronously; a nicer zone from the lookup service is only
   * layered on afterwards, and never blocks or breaks the generate path.
   */
  const pick = (p: Place) => {
    setResults([]);
    setError(null);
    setManual(false);
    const localZone = p.timezone ?? guessZone(p.longitude);
    setPlace({ label: p.label, latitude: p.latitude, longitude: p.longitude, timezone: localZone });
    setQuery(p.label);
    setZoneNote(p.timezone ? null : `Timezone estimated as ${localZone} — change it under “enter coordinates by hand” if that is wrong.`);
    if (!p.timezone) {
      const t = setTimeout(() => setZoneNote(`Timezone estimated as ${localZone} — change it under “enter coordinates by hand” if that is wrong.`), 4500);
      void zoneFor(p.latitude, p.longitude).then((tz) => {
        clearTimeout(t);
        if (!tz || tz === localZone) return;
        setPlace((cur) => (cur.latitude === p.latitude && cur.longitude === p.longitude ? { ...cur, timezone: tz } : cur));
        setZoneNote(null);
      }).catch(() => clearTimeout(t));
    }
  };

  const generate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setNote(null);
    if (!name.trim()) { setError("Please add a name — it is printed on the wallpaper."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time)) { setError("Birth date and time look incomplete."); return; }
    const input: BirthInput = {
      name, date, time,
      place: place.label || `${place.latitude.toFixed(3)}, ${place.longitude.toFixed(3)}`,
      latitude: place.latitude, longitude: place.longitude, timezone: place.timezone,
    };
    // --- deterministic path: chart + chart-accurate SVG, entirely on device.
    // It must never wait for, or be broken by, the AI call below.
    try {
      const next = computeChart(input);
      // Draw the wallpaper right here, synchronously, so a drawing failure is
      // reported as an error instead of leaving the preview silently empty.
      buildWallpaperSvg({ chart: next, presetId: preset, width: PHONE.width, height: PHONE.height, fontFaceCss: previewFontFaceCss });
      setChart(next);
      setNote(`Wallpaper drawn for ${next.moonNakshatra.name} · pada ${next.moonPada}.`);
      requestAnimationFrame(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    } catch (err) {
      setChart(null);
      setError(`Could not build that wallpaper: ${err instanceof Error ? err.message : String(err)}`);
    }
    // --- AI step: its own try/catch, its own failure surface. Whatever happens
    // here, the chart-accurate wallpaper above is already on screen.
    if (useAI) {
      setAiBusy("reading");
      setAiError(null);
      // Start every AI run from a clean slate: a previous success must never
      // survive into the next chart. Clear the old reading, artwork and
      // provider badge up front, and fall back to the chart view if the AI
      // artwork was showing, so a later client-side rejection cannot leave the
      // OLD reading, badge and art on screen under the NEW chart.
      setAiReading(null);
      setAiWallpaper(null);
      setAiProvider(null);
      setView((v) => (v === "ai" ? "chart" : v));
      let paintingTimer: ReturnType<typeof setTimeout> | null = null;
      try {
        paintingTimer = setTimeout(() => setAiBusy("wallpaper"), 3500);
        const res = await generateWallpaper({ data: input });
        setAiReading(res.reading ?? null);
        setAiWallpaper(res.image ?? null);
        setAiError(res.error ?? null);
        if (res.image) setView("ai");
        if (res.provider) setAiProvider(res.provider);
      } catch (err) {
        // The AI step rejected before returning a result: clear whatever a
        // previous run left behind, so a stale reading, badge or artwork can
        // never sit under the new chart, then surface the failure.
        setAiReading(null);
        setAiWallpaper(null);
        setAiProvider(null);
        setView((v) => (v === "ai" ? "chart" : v));
        setAiError(err instanceof Error ? err.message : String(err));
      } finally {
        if (paintingTimer) clearTimeout(paintingTimer);
        setAiBusy(null);
      }
    } else {
      setAiReading(null); setAiWallpaper(null); setAiProvider(null); setAiError(null); setView("chart");
    }
  };

  const drawing = useMemo(() => {
    if (!chart) return { svg: "", error: null as string | null };
    try {
      return {
        svg: buildWallpaperSvg({ chart, presetId: preset, width: PHONE.width, height: PHONE.height, fontFaceCss: previewFontFaceCss }),
        error: null,
      };
    } catch (err) {
      return { svg: "", error: `Could not draw this style: ${err instanceof Error ? err.message : String(err)}` };
    }
  }, [chart, preset]);
  const svg = drawing.svg;

  const download = async (which: "phone" | "desktop") => {
    if (!chart) return;
    const size = which === "phone" ? PHONE : DESKTOP;
    setBusy(which); setError(null);
    try {
      const uris = await fontDataUris();
      const full = buildWallpaperSvg({
        chart, presetId: preset, width: size.width, height: size.height,
        fontFaceCss: embeddedFontFaceCss(uris),
      });
      const blob = await svgToPngBlob(full, size.width, size.height);
      downloadBlob(blob, wallpaperFilename(chart, size.width, size.height));
    } catch (err) {
      setError(`Export failed: ${String(err)}`);
    } finally { setBusy(null); }
  };

  /** Saves the AI-generated art background (the model image) as a PNG. */
  const downloadAI = async () => {
    if (!aiWallpaper) return;
    setBusy("ai"); setError(null);
    try {
      const blob = await (await fetch(aiWallpaper.dataUrl)).blob();
      const safe = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "wallpaper";
      downloadBlob(blob, `nakshatra-canvas-ai-${safe}-${aiWallpaper.width}x${aiWallpaper.height}.png`);
    } catch (err) {
      setError(`Download failed: ${String(err)}`);
    } finally { setBusy(null); }
  };

  const g = chart ? GRAHAS[chart.rulingPlanet] : null;
  const providerLabel = providerName(aiProvider);

  return (
    <section id="create" className="mx-auto w-full max-w-6xl px-5 pb-24">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
        {/* ---------------------------------------------------------- form */}
        <form onSubmit={generate} noValidate className="rounded-3xl border border-amber-500/25 bg-neutral-900/70 p-6 shadow-2xl backdrop-blur">
          <h2 className="font-serif text-2xl tracking-wide text-amber-200">Your birth details</h2>
          <p className="mt-1 text-xs leading-relaxed text-neutral-400">
            The chart and the chart-accurate artwork are computed on your device and nothing is stored — unless you opt into the AI step.
          </p>

          <div className="mt-4 rounded-xl border border-amber-500/25 bg-black/40 p-3">
            <div className="flex items-center gap-2">
              <input id="use-ai" type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)}
                className="h-4 w-4 accent-amber-400" />
              <label htmlFor="use-ai" className="text-sm text-neutral-100">AI reading &amp; premium wallpaper</label>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              Optional. The AI step calls an external model and sends your chart facts to it. Without it everything stays on your device.
            </p>
          </div>

          <label className="mt-5 block text-xs uppercase tracking-widest text-neutral-400">Full name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="As you would like it written"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-neutral-100 outline-none focus:border-amber-400/60" />

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-widest text-neutral-400">Birth date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-neutral-100 outline-none focus:border-amber-400/60" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-neutral-400">Time of birth</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-neutral-100 outline-none focus:border-amber-400/60" />
            </div>
          </div>

          <label className="mt-4 block text-xs uppercase tracking-widest text-neutral-400">Birth place</label>
          <div className="mt-1 flex gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void doSearch(); } }}
              placeholder="City, e.g. New Delhi"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-neutral-100 outline-none focus:border-amber-400/60" />
            <button type="button" onClick={() => void doSearch()}
              className="shrink-0 rounded-xl border border-amber-400/40 px-3 py-2 text-xs uppercase tracking-wider text-amber-200 hover:bg-amber-400/10">
              {searching ? "…" : "Find"}
            </button>
          </div>

          {results.length > 0 && (
            <ul className="mt-2 max-h-48 overflow-auto rounded-xl border border-white/10 bg-black/50 text-sm">
              {results.map((r, i) => (
                <li key={i}>
                  <button type="button" onClick={() => pick(r)}
                    className="block w-full px-3 py-2 text-left text-neutral-200 hover:bg-amber-400/10">
                    {r.label} <span className="text-neutral-500">{r.latitude.toFixed(2)}, {r.longitude.toFixed(2)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {place.label && (
            <p className="mt-2 text-xs text-emerald-300/90">
              {place.label} · {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)} · {place.timezone}
            </p>
          )}
          {zoneNote && <p className="mt-1 text-xs text-amber-300/80">{zoneNote}</p>}

          <button type="button" onClick={() => setManual((m) => !m)}
            className="mt-3 text-xs text-neutral-400 underline decoration-dotted hover:text-amber-200">
            {manual ? "hide manual entry" : "search not working? enter coordinates by hand"}
          </button>

          {manual && (
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/30 p-3">
              <label className="col-span-2 text-xs uppercase tracking-widest text-neutral-400">Place label</label>
              <input value={place.label} onChange={(e) => setPlace({ ...place, label: e.target.value })}
                className="col-span-2 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-neutral-100" />
              <label className="text-xs uppercase tracking-widest text-neutral-400">Latitude</label>
              <label className="text-xs uppercase tracking-widest text-neutral-400">Longitude</label>
              <input type="number" step="any" value={place.latitude}
                onChange={(e) => setPlace({ ...place, latitude: Number(e.target.value) })}
                className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-neutral-100" />
              <input type="number" step="any" value={place.longitude}
                onChange={(e) => setPlace({ ...place, longitude: Number(e.target.value) })}
                className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-neutral-100" />
              <label className="col-span-2 mt-1 text-xs uppercase tracking-widest text-neutral-400">Timezone (IANA)</label>
              <select value={place.timezone} onChange={(e) => setPlace({ ...place, timezone: e.target.value })}
                className="col-span-2 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-neutral-100">
                {ALL_ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          )}

          <button type="submit"
            className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 px-4 py-3 font-serif text-base tracking-wide text-neutral-900 shadow-lg hover:from-amber-200 hover:to-amber-400">
            Create my wallpaper
          </button>
          {error && <p className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 p-2 text-xs text-red-200">{error}</p>}
          {!error && note && <p className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-2 text-xs text-emerald-200">{note}</p>}

          {chart && g && (
            <dl className="mt-5 space-y-1 border-t border-white/10 pt-4 text-xs text-neutral-300">
              <div className="flex justify-between"><dt className="text-neutral-500">Moon nakshatra</dt><dd>{chart.moonNakshatra.name} · pada {chart.moonPada}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Lagna</dt><dd>{rashiOf(chart.lagna.signIndex).name} ({rashiOf(chart.lagna.signIndex).english}) {dms(chart.lagna.degreeInSign)}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Moon rāśi</dt><dd>{rashiOf(chart.moonSign).name}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Ruling planet</dt><dd>{g.name} ({g.devanagari})</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Yantra</dt><dd>{g.yantra ? `${g.yantra.order}×${g.yantra.order}` : "geometric"}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Birth instant</dt><dd>{chart.utc.toISOString().replace(".000Z", " UTC")} ({formatOffset(chart.offsetMinutes)})</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Lāhiri ayanāṃśa</dt><dd>{chart.ayanamsa.toFixed(4)}°</dd></div>
            </dl>
          )}

          {aiReading && (
            <section className="mt-6 border-t border-white/10 pt-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="font-serif text-lg tracking-wide text-amber-200">Your Vedic reading</h3>
                {providerLabel && (
                  <span className="rounded-full border border-amber-500/25 bg-black/40 px-2 py-0.5 text-xs text-amber-200">
                    read by {providerLabel}
                  </span>
                )}
              </div>
              <AiReading reading={aiReading} />
            </section>
          )}
        </form>

        {/* ------------------------------------------------------- preview */}
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" onClick={() => setPreset(p.id)}
                className={`rounded-full border px-3 py-1.5 text-xs tracking-wider transition ${preset === p.id ? "border-amber-300 bg-amber-300/15 text-amber-100" : "border-white/15 text-neutral-300 hover:border-white/35"}`}>
                {p.name}
              </button>
            ))}
          </div>
          <p className="mb-3 text-xs text-neutral-500">{presetById(preset).blurb}</p>

          {useAI && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-neutral-500">Wallpaper</span>
              <button type="button" onClick={() => setView("chart")}
                className={`rounded-xl border px-3 py-1.5 text-xs tracking-wider transition ${view === "chart" ? "border-amber-300 bg-amber-300/15 text-amber-100" : "border-white/15 text-neutral-300 hover:border-white/35"}`}>
                Chart-accurate SVG
              </button>
              <button type="button" onClick={() => setView("ai")} disabled={!aiWallpaper}
                className={`rounded-xl border px-3 py-1.5 text-xs tracking-wider transition disabled:cursor-not-allowed disabled:opacity-40 ${view === "ai" ? "border-amber-300 bg-amber-300/15 text-amber-100" : "border-white/15 text-neutral-300 hover:border-white/35"}`}>
                AI premium artwork
              </button>
            </div>
          )}
          {useAI && (
            <p className="mb-3 text-xs text-neutral-500">
              The chart-accurate SVG is drawn from your chart on this device; the AI premium artwork is the model&rsquo;s art background only.
            </p>
          )}

          {aiBusy && (
            <p className="mb-3 text-center text-xs text-amber-200">
              {aiBusy === "reading" ? "Consulting the Jyotish…" : "Painting your premium wallpaper…"}
            </p>
          )}
          {aiError && (
            <p className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 p-2 text-xs text-amber-100">
              AI step unavailable: {aiError}. The chart-accurate wallpaper above still works.
            </p>
          )}

          <div ref={previewRef} className="mx-auto w-full max-w-[380px] overflow-hidden rounded-[2rem] border border-white/10 bg-black/50 shadow-2xl [&_svg]:block [&_svg]:h-auto [&_svg]:w-full">
            {view === "ai" && aiWallpaper
              ? <img src={aiWallpaper.dataUrl} alt="AI-generated premium wallpaper" className="block h-auto w-full" />
              : svg
                ? <div className="[&_svg]:block [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
                : drawing.error
                  ? <div className="flex aspect-[1170/2532] items-center justify-center p-8 text-center text-sm text-red-200">{drawing.error}</div>
                  : (
                    <div className="flex aspect-[1170/2532] items-center justify-center p-8 text-center text-sm text-neutral-500">
                      Enter the birth details and press <span className="mx-1 text-amber-200">Create my wallpaper</span> — the wallpaper is drawn from the chart, here, live.
                    </div>
                  )}
          </div>

          {chart && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <button type="button" onClick={() => void download("phone")} disabled={!!busy}
                className="rounded-xl border border-amber-400/50 bg-amber-400/10 px-4 py-2 text-sm text-amber-100 hover:bg-amber-400/20 disabled:opacity-50">
                {busy === "phone" ? "Rendering…" : `Download phone PNG ${PHONE.width}×${PHONE.height}`}
              </button>
              <button type="button" onClick={() => void download("desktop")} disabled={!!busy}
                className="rounded-xl border border-white/20 px-4 py-2 text-sm text-neutral-200 hover:bg-white/10 disabled:opacity-50">
                {busy === "desktop" ? "Rendering…" : `Download desktop PNG ${DESKTOP.width}×${DESKTOP.height}`}
              </button>
              {aiWallpaper && (
                <button type="button" onClick={() => void downloadAI()} disabled={!!busy}
                  className="rounded-xl border border-amber-400/50 bg-amber-400/10 px-4 py-2 text-sm text-amber-100 hover:bg-amber-400/20 disabled:opacity-50">
                  {busy === "ai" ? "Saving…" : "Download AI wallpaper"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
