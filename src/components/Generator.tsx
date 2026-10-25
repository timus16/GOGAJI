import { useEffect, useMemo, useRef, useState } from "react";
import { computeChart, dms, formatOffset, rashiOf, type BirthInput, type Chart } from "~/lib/astro";
import { PRESETS, GRAHAS, presetById } from "~/content/vedic-mapping";
import { LIFE_AREAS, type LifeArea } from "~/content/problems";
import { buildWallpaperSvg, wallpaperFilename, type WallpaperOptions } from "~/lib/wallpaper";
import {
  DESKTOP, PHONE, downloadBlob, embeddedFontFaceCss, fontDataUris,
  previewFontFaceCss, svgToPngBlob,
} from "~/lib/exporter";
import { generateWallpaper, type Reading } from "~/server/ai";
import AiReading from "./AiReading";
import { shouldCallAI } from "~/lib/qualification";
import { captureSubmit } from "~/lib/crm";
import { REGIONAL_SYSTEMS, type RegionalSystem } from "~/lib/regional-calculations";
import { generateInternalReport, type InternalAstrologyReport } from "~/lib/astrology-pipeline";

interface Place {
  label: string;
  latitude: number;
  longitude: number;
  timezone: string | null;
}

/** Discovery answers arrive via localStorage (written by the gate in index.tsx). */
const readLocal = (k: string): string => {
  try { return typeof localStorage !== "undefined" ? localStorage.getItem(k) ?? "" : ""; }
  catch { return ""; }
};

/**
 * Frozen request contract for the AI step: birth facts plus the optional
 * style preset, the selected focus areas (empty = the engine treats as all)
 * and the user's own provider keys. The server validates against the same
 * shape, so the client never sends a field the contract does not name.
 */
type WallpaperRequestData = BirthInput & {
  presetId?: string;
  focusAreas?: string[];
  keys?: { gemini?: string; openrouter?: string; nvidia?: string };
};

/** BYOK keys live in localStorage under this JSON key, masked in the UI. */
const KEYS_STORAGE = "gogaji.keys";

type AiKeys = { gemini?: string; openrouter?: string; nvidia?: string };

/** The BYOK fields, in display order. Values are read masked, never echoed. */
const KEY_FIELDS: { id: keyof AiKeys; label: string }[] = [
  { id: "gemini", label: "Gemini" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "nvidia", label: "NVIDIA" },
];

/** Human labels for the LIFE_AREAS checklist (order comes from LIFE_AREAS). */
const AREA_LABELS: Record<LifeArea, string> = {
  career: "Career & work",
  wealth: "Wealth & finances",
  relationships: "Relationships",
  health: "Health & vitality",
  education: "Education & study",
  spiritual: "Spiritual growth",
  protection: "Protection",
  family: "Family & home",
};

const readSavedKeys = (): AiKeys => {
  try {
    if (typeof localStorage === "undefined") return {};
    const parsed = JSON.parse(localStorage.getItem(KEYS_STORAGE) ?? "{}") as AiKeys;
    return {
      gemini: typeof parsed.gemini === "string" ? parsed.gemini : "",
      openrouter: typeof parsed.openrouter === "string" ? parsed.openrouter : "",
      nvidia: typeof parsed.nvidia === "string" ? parsed.nvidia : "",
    };
  } catch { return {}; }
};

const persistKeys = (k: AiKeys) => {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(KEYS_STORAGE, JSON.stringify(k)); }
  catch { /* storage blocked: keys stay in memory for this session only */ }
};

/**
 * Time zones a birth can plausibly be recorded in that the platform list may
 * omit. `Intl.supportedValuesOf("timeZone")` returns canonical names and, on
 * several engines, only ONE member of an alias family: it yields
 * `Asia/Calcutta` and NOT `Asia/Kolkata`, so our default `Asia/Kolkata` was
 * absent from the dropdown and the <select> silently fell back to its first
 * option (`Africa/Abidjan`). These aliases are force-unioned in below.
 */
const CURATED_ZONES = [
  "Asia/Kolkata", "Asia/Calcutta", "Asia/Kathmandu", "Asia/Colombo",
  "Asia/Dhaka", "Asia/Dubai", "Asia/Karachi", "Europe/London",
  "America/New_York", "America/Los_Angeles", "Australia/Sydney",
  "Pacific/Auckland", "UTC",
];

/**
 * The dropdown options: the UNION of the platform list and the curated aliases,
 * deduped and sorted. The currently selected zone is added again at render time
 * (see `zoneOptions`) so the control can represent it even when both sources
 * lack it.
 */
const ALL_ZONES: string[] = (() => {
  let platform: string[] = [];
  try {
    const v = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (v) platform = v("timeZone");
  } catch { /* engine without supportedValuesOf: the curated aliases still apply */ }
  return Array.from(new Set([...platform, ...CURATED_ZONES])).sort();
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
  // 1. Open-Meteo geocoding · gives lat/lon AND the IANA zone in one call.
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
  // 2. Photon (Komoot) · coordinates only, zone arrives from the next step.
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
  } catch { /* give up quietly · manual entry stays available */ }
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
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Real days in a month for a year · leap-year aware; tolerant of partial input. */
function dim(year: number, month: number): number {
  if (!Number.isInteger(year) || year < 1 || month < 1 || month > 12) return 31;
  return new Date(year, month, 0).getDate();
}

interface GeneratorProps {
  initialName?: string;
  subject?: "self" | "child";
  autoGenerate?: boolean;
}

export default function Generator({ initialName = "", subject = "self", autoGenerate = false }: GeneratorProps) {
  const [name, setName] = useState(initialName);
  // Direct-entry birth fields (no native date/time pickers): they compose the
  // same "YYYY-MM-DD" / "HH:MM[:SS]" strings the engine already expects, but a
  // 1950s birth is typed, not calendar-scrubbed, and the time is a 12h select
  // plus an AM/PM toggle. Default: 1992-08-14 05:45.
  const [month, setMonth] = useState(8);
  const [dayText, setDayText] = useState("14");
  const [yearText, setYearText] = useState("1992");
  const [hour12, setHour12] = useState(5);
  const [minute, setMinute] = useState(45);
  const [ampm, setAmpm] = useState<"AM" | "PM">("AM");
  // Optional seconds, kept as a raw string so the box can be left blank (read as
  // :00). It is composed into "HH:MM:SS" on submit.
  const [seconds, setSeconds] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  // Manual entry is open by DEFAULT: search is a convenience, not a gate, and
  // hiding the coordinate fields behind a link made users think they could not
  // enter their own birth details at all.
  const [showSeconds, setShowSeconds] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [place, setPlace] = useState({ label: "New Delhi", latitude: 28.6139, longitude: 77.209, timezone: "Asia/Kolkata" });
  const [preset, setPreset] = useState(PRESETS[0].id);
  const [chart, setChart] = useState<Chart | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [zoneNote, setZoneNote] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(false);
  const [aiReading, setAiReading] = useState<Reading | null>(null);
  const [aiWallpaper, setAiWallpaper] = useState<{ dataUrl: string; mime: string; width: number; height: number } | null>(null);
  const [aiBusy, setAiBusy] = useState<"reading" | "wallpaper" | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<string | null>(null);
  const [aiInfo, setAiInfo] = useState<string | null>(null);
  // "AI art background": composite wallpaper toggle. ON by default so that, the
  // moment the AI step returns an image, the preview and BOTH downloads already
  // show the generated art (cover-fit) with the chart overlay on top.
  const [aiArtBg, setAiArtBg] = useState(true);
  // Focus areas for the checklist: empty array = the engine covers all areas.
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  // BYOK: provider keys typed by the user, persisted in localStorage
  // (KEYS_STORAGE) and hydrated after mount so SSR and the first client render
  // agree. Masked inputs only; values are never logged.
  const [aiKeys, setAiKeys] = useState<AiKeys>({ gemini: "", openrouter: "", nvidia: "" });
  const [regionalSystem, setRegionalSystem] = useState<RegionalSystem>("vedic");
  const [internalReport, setInternalReport] = useState<InternalAstrologyReport | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [byokOpen, setByokOpen] = useState(false);
  useEffect(() => { setAiKeys(readSavedKeys()); }, []);
  const previewRef = useRef<HTMLDivElement | null>(null);

  // Composed birth strings + inline validation. The day is re-clamped when the
  // month/year changes, but a typed day that overflows the month (Feb 30) or a
  // year outside 1900..currentYear surfaces as an inline error and blocks submit.
  const currentYear = new Date().getFullYear();
  const yearNum = Number(yearText);
  const dayNum = Number(dayText);
  const daysInMonth = dim(yearNum, month);
  const yearOk = yearNum >= 1900 && yearNum <= currentYear;
  const dayOk = dayNum >= 1 && dayNum <= daysInMonth;
  const dateError = !yearOk
    ? `Year must be between 1900 and ${currentYear}.`
    : !dayOk
      ? `${MONTHS[month - 1]} ${yearNum} has ${daysInMonth} days.`
      : null;
  const composedDate = yearOk && dayOk ? `${yearNum}-${pad2(month)}-${pad2(dayNum)}` : "";
  // 12h + meridiem -> 24h: 12 AM is 00, 12 PM is 12.
  const hour24 = (hour12 % 12) + (ampm === "PM" ? 12 : 0);
  const ss = seconds.replace(/[^0-9]/g, "");
  const composedTime = ss === "" ? `${pad2(hour24)}:${pad2(minute)}` : `${pad2(hour24)}:${pad2(minute)}:${ss.padStart(2, "0")}`;

  const setMonthClampingDay = (m: number) => {
    setMonth(m);
    if (dayNum > dim(yearNum, m)) setDayText(String(dim(yearNum, m)));
  };
  const setYearClampingDay = (text: string) => {
    setYearText(text);
    if (dayNum > dim(Number(text), month)) setDayText(String(dim(Number(text), month)));
  };
  const stepYear = (delta: number) => {
    const base = yearNum >= 1900 && yearNum <= currentYear ? yearNum : delta > 0 ? 1900 : currentYear;
    setYearClampingDay(String(Math.min(currentYear, Math.max(1900, base + delta))));
  };

  // --- focus-area checklist wiring -----------------------------------------
  const allAreasSelected = focusAreas.length === LIFE_AREAS.length;
  const toggleArea = (area: string) => {
    setFocusAreas((cur) => (cur.includes(area) ? cur.filter((a) => a !== area) : [...cur, area]));
  };
  const toggleAllAreas = () => {
    setFocusAreas(allAreasSelected ? [] : [...LIFE_AREAS]);
  };

  // --- BYOK wiring -----------------------------------------------------------
  const updateKey = (field: keyof AiKeys, value: string) => {
    const next: AiKeys = { ...aiKeys };
    next[field] = value;
    setAiKeys(next);
    persistKeys(next);
  };
  const clearKey = (field: keyof AiKeys) => updateKey(field, "");
  const keysSaved = Boolean(aiKeys.gemini?.trim() || aiKeys.openrouter?.trim() || aiKeys.nvidia?.trim());

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true); setError(null);
    const found = await searchPlaces(query.trim());
    setResults(found);
    setSearching(false);
    if (!found.length) { setError("No place found · enter latitude, longitude and timezone below and you can still continue."); setManual(true); }
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
    setZoneNote(p.timezone ? null : `Timezone estimated as ${localZone} · change it under ·enter coordinates by hand· if that is wrong.`);
    if (!p.timezone) {
      const t = setTimeout(() => setZoneNote(`Timezone estimated as ${localZone} · change it under ·enter coordinates by hand· if that is wrong.`), 4500);
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
    setAiInfo(null);
    if (!name.trim()) { setError("Please add a name · it is printed on the wallpaper."); return; }
    // The composed strings exist before the original validation runs, so the
    // regexes below still gate the exact values handed to the engine.
    if (dateError) { setError(dateError); return; }
    if (ss !== "" && Number(ss) > 59) { setError("Seconds must be between 0 and 59."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(composedDate) || !/^\d{1,2}:\d{2}(:\d{2})?$/.test(composedTime)) { setError("Birth date and time look incomplete."); return; }
    const input: BirthInput = {
      name, date: composedDate, time: composedTime,
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
      // Generate internal astrology report (ALWAYS works - deterministic)
      try {
        const report = generateInternalReport(
          { name, date: composedDate, time: composedTime, place: place.label, latitude: place.latitude, longitude: place.longitude, timezone: place.timezone },
          focusAreas[0] || "career",
          regionalSystem
        );
        setInternalReport(report);
      } catch (e) {
        console.error("Report generation failed:", e);
      }
      setNote(`Wallpaper drawn for ${next.moonNakshatra.name} · pada ${next.moonPada}.`);
      try {
        // The AI opt-in doubles as the storage consent: without it the lead is
        // transient (in memory only, no localStorage, no PII in the console).
        captureSubmit({
          input, presetId: preset,
          intent: readLocal("gogaji.intent"),
          previousFailure: readLocal("gogaji.previousFailure"),
          nakshatra: next.moonNakshatra.name,
          focusAreas,
        }, useAI);
      } catch { /* CRM capture must never break generation */ }
      requestAnimationFrame(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    } catch (err) {
      setChart(null);
      setError(`Could not build that wallpaper: ${err instanceof Error ? err.message : String(err)}`);
    }
    // --- AI step: its own try/catch, its own failure surface. Whatever happens
    // here, the chart-accurate wallpaper above is already on screen.
    const aiGate = shouldCallAI(input, readLocal("gogaji.intent"));
    if (useAI && !aiGate.allow) {
      setAiInfo(aiGate.reason ?? "AI step skipped for this request.");
    } else if (useAI) {
      setAiBusy("reading");
      setAiError(null);
      setAiInfo(null);
      // Start every AI run from a clean slate: a previous success must never
      // survive into the next chart. Clear the old reading, artwork and provider
      // badge up front, so a later client-side rejection cannot leave the OLD
      // reading, badge and art on screen under the NEW chart.
      setAiReading(null);
      setAiWallpaper(null);
      setAiProvider(null);
      let paintingTimer: ReturnType<typeof setTimeout> | null = null;
      try {
        paintingTimer = setTimeout(() => setAiBusy("wallpaper"), 3500);
        // The preset id, the chosen focus areas (empty = all) and any non-empty
        // BYOK keys ride along with the birth input; the response shape is
        // unchanged. Keys are trimmed and only sent when actually set.
        const sentKeys: NonNullable<WallpaperRequestData["keys"]> = {};
        if (aiKeys.gemini?.trim()) sentKeys.gemini = aiKeys.gemini.trim();
        if (aiKeys.openrouter?.trim()) sentKeys.openrouter = aiKeys.openrouter.trim();
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
        // The AI step rejected before returning a result: clear whatever a
        // previous run left behind, so a stale reading, badge or artwork can
        // never sit under the new chart, then surface the failure.
        setAiReading(null);
        setAiWallpaper(null);
        setAiProvider(null);
        setAiError(err instanceof Error ? err.message : String(err));
      } finally {
        if (paintingTimer) clearTimeout(paintingTimer);
        setAiBusy(null);
      }
    } else {
      setAiReading(null); setAiWallpaper(null); setAiProvider(null); setAiError(null);
      setAiInfo(null);
    }
  };

  /**
   * The AI art data URL, but only while the "AI art background" toggle is on
   * and an image actually exists. When it is undefined the renderer draws the
   * plain deterministic wallpaper, exactly as before - this is also the graceful
   * degradation path when no key is configured and no image returns.
   */
  const aiBgUrl = useAI && aiArtBg && aiWallpaper ? aiWallpaper.dataUrl : undefined;

  /**
   * One place that assembles the renderer inputs, so the live preview and BOTH
   * exports hand `buildWallpaperSvg` the same composite. `backgroundImageUrl` is
   * the frozen composite contract: when present the AI art is drawn as the
   * cover-fit base layer with the chart overlay (name, nakshatra, pada, mantra
   * and kundli) on top. The intersection keeps this compiling whether or not the
   * field has landed in `WallpaperOptions` yet.
   */
  const renderOpts = (c: Chart, width: number, height: number, fontFaceCss: string) => {
    const opts: WallpaperOptions & { backgroundImageUrl?: string } = {
      chart: c, presetId: preset, width, height, fontFaceCss, backgroundImageUrl: aiBgUrl,
    };
    return opts;
  };

  const drawing = useMemo(() => {
    if (!chart) return { svg: "", error: null as string | null };
    try {
      return {
        svg: buildWallpaperSvg(renderOpts(chart, PHONE.width, PHONE.height, previewFontFaceCss)),
        error: null,
      };
    } catch (err) {
      return { svg: "", error: `Could not draw this style: ${err instanceof Error ? err.message : String(err)}` };
    }
  }, [chart, preset, aiBgUrl]);
  const svg = drawing.svg;

  const download = async (which: "phone" | "desktop") => {
    if (!chart) return;
    const size = which === "phone" ? PHONE : DESKTOP;
    setBusy(which); setError(null);
    try {
      const uris = await fontDataUris();
      // Same composite inputs as the preview, so the PNG is exactly the
      // wallpaper on screen - AI backdrop and chart overlay included.
      const full = buildWallpaperSvg(renderOpts(chart, size.width, size.height, embeddedFontFaceCss(uris)));
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

  /**
   * A "· is not set" server error with NO user keys saved means the shared
   * environment simply has no provider configured: soften that into a friendly
   * one-liner plus a button that opens the BYOK panel. With keys saved (or any
   * other error) the real message is shown, compacted but expandable.
   */
  const friendlyKeyError = !!aiError && aiError.includes("is not set") && !keysSaved;

  /**
   * The select options, with the currently selected zone force-included. A
   * place lookup (or a stale value) can hand back a zone that is in neither the
   * platform list nor our aliases; without this the <select> could not represent
   * it and would silently show the first option instead.
   */
  const zoneOptions = useMemo(
    () => Array.from(new Set([...ALL_ZONES, place.timezone])).sort(),
    [place.timezone],
  );
  return (
    <section id="create" className="mx-auto w-full max-w-6xl px-5 pb-24">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
        {/* ---------------------------------------------------------- form */}
        <form onSubmit={generate} noValidate className="rounded-3xl border border-amber-500/25 bg-neutral-900/70 p-6 shadow-2xl backdrop-blur">
          <h2 className="font-serif text-2xl tracking-wide text-amber-200">Your birth details</h2>
          <p className="mt-1 text-xs leading-relaxed text-neutral-400">
            The chart and the chart-accurate artwork are computed on your device. Nothing is stored unless you opt into the AI step · opting in also keeps a local record of your reading.
          </p>

          <div className="mt-4 rounded-xl border border-amber-500/25 bg-black/40 p-3">
            <div className="flex items-center gap-2">
              <input id="use-ai" type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)}
                className="h-4 w-4 accent-amber-400" />
              <label htmlFor="use-ai" className="text-sm text-neutral-100">AI reading & premium wallpaper</label>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              Optional. The AI step calls an external model and sends your chart facts to it. Without it everything stays on your device.
            </p>
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-black/30">
            <button type="button" aria-expanded={byokOpen} onClick={() => setByokOpen((o) => !o)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-neutral-300 hover:text-amber-200">
              <span>AI keys (bring your own)</span>
              <span className="ml-2 shrink-0 text-[11px]">
                {keysSaved ? <span className="text-emerald-300">keys saved ?</span> : <span className="text-neutral-500">not set</span>}
                <span aria-hidden className="ml-1.5 text-neutral-500">{byokOpen ? "?" : "?"}</span>
              </span>
            </button>
            {byokOpen && (
              <div className="grid gap-2 px-3 pb-3">
                <p className="text-[11px] leading-relaxed text-neutral-500">
                  Optional. Stored only in this browser (masked, never logged, never rendered as text) and sent only to the provider you choose. Leave blank to let the server use its own keys.
                </p>
                {KEY_FIELDS.map((f) => (
                  <div key={f.id} className="flex items-center gap-1.5">
                    <input id={`byok-${f.id}`} type="password" autoComplete="off"
                      aria-label={`${f.label} API key`}
                      value={aiKeys[f.id] ?? ""} onChange={(e) => updateKey(f.id, e.target.value)}
                      placeholder={`${f.label} API key`}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-neutral-100 outline-none focus:border-amber-400/60" />
                    {(aiKeys[f.id] ?? "") !== "" && (
                      <button type="button" onClick={() => clearKey(f.id)} aria-label={`Clear ${f.label} key`}
                        className="shrink-0 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-neutral-400 hover:border-amber-400/60 hover:text-amber-200">·</button>
                    )}
                  </div>
                ))}
                <p className="mt-2 text-[0.7rem] leading-relaxed text-neutral-500">
                  Free keys: Google AI Studio (aistudio.google.com/apikey) for the reading ·
                  NVIDIA (build.nvidia.com, key starts with nvapi-) for the artwork.
                </p>
              </div>
            )}
          </div>

          <label htmlFor="full-name" className="mt-5 block text-xs uppercase tracking-widest text-neutral-400">{subject === "child" ? "Your child's name" : "Full name"}</label>
          <input id="full-name" name="fullName" aria-label={subject === "child" ? "Your child's name" : "Full name"}
            value={name} onChange={(e) => setName(e.target.value)} placeholder="As you would like it written"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-neutral-100 outline-none focus:border-amber-400/60" />

          <div className="mt-4">
            <label htmlFor="birth-date" className="block text-xs uppercase tracking-widest text-neutral-400">Birth date</label>
            <div className="mt-1 grid grid-cols-[minmax(0,1fr)_4.5rem_7.5rem] gap-2">
              <div>
                <span className="block text-[10px] uppercase tracking-widest text-neutral-500">Month</span>
                <select id="birth-date" name="birthMonth" value={month} onChange={(e) => setMonthClampingDay(Number(e.target.value))}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-sm text-neutral-100 outline-none focus:border-amber-400/60">
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-widest text-neutral-500">Day</span>
                <input id="birth-day" name="birthDay" type="number" min={1} max={31} inputMode="numeric" aria-label="Day of birth"
                  value={dayText} onChange={(e) => setDayText(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} placeholder="DD"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-sm text-neutral-100 outline-none focus:border-amber-400/60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-widest text-neutral-500">Year</span>
                <div className="flex gap-1">
                  <button type="button" aria-label="One year earlier" onClick={() => stepYear(-1)}
                    className="rounded-xl border border-white/10 bg-black/40 px-2 text-sm text-neutral-300 outline-none hover:border-amber-400/60 focus:border-amber-400/60">-</button>
                  <input id="birth-year" name="birthYear" type="number" min={1900} max={currentYear} inputMode="numeric" aria-label="Year of birth"
                    value={yearText} onChange={(e) => setYearClampingDay(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))} placeholder="YYYY"
                    className="w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-sm text-neutral-100 outline-none focus:border-amber-400/60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                  <button type="button" aria-label="One year later" onClick={() => stepYear(1)}
                    className="rounded-xl border border-white/10 bg-black/40 px-2 text-sm text-neutral-300 outline-none hover:border-amber-400/60 focus:border-amber-400/60">+</button>
                </div>
              </div>
            </div>
            {dateError && <p className="mt-1 text-xs text-red-300">{dateError}</p>}
          </div>
          <div className="mt-4">
            <label htmlFor="birth-time" className="block text-xs uppercase tracking-widest text-neutral-400">Time of birth</label>
            <div className="mt-1 grid grid-cols-[3.75rem_5.75rem_minmax(0,1fr)_3.5rem] gap-2">
              <div>
                <span className="block text-[10px] uppercase tracking-widest text-neutral-500">Hour</span>
                <select id="birth-time" name="birthHour" aria-label="Hour of birth (12-hour)" value={hour12}
                  onChange={(e) => setHour12(Number(e.target.value))}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-sm text-neutral-100 outline-none focus:border-amber-400/60">
                  {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                </select>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-widest text-neutral-500">AM / PM</span>
                <div role="group" aria-label="AM or PM" className="grid grid-cols-2 gap-1">
                  <button type="button" aria-pressed={ampm === "AM"} onClick={() => setAmpm("AM")}
                    className={`rounded-xl border px-1 py-2 text-xs tracking-wider transition ${ampm === "AM" ? "border-amber-300 bg-amber-300/15 text-amber-100" : "border-white/10 bg-black/40 text-neutral-300 hover:border-amber-400/60"}`}>AM</button>
                  <button type="button" aria-pressed={ampm === "PM"} onClick={() => setAmpm("PM")}
                    className={`rounded-xl border px-1 py-2 text-xs tracking-wider transition ${ampm === "PM" ? "border-amber-300 bg-amber-300/15 text-amber-100" : "border-white/10 bg-black/40 text-neutral-300 hover:border-amber-400/60"}`}>PM</button>
                </div>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-widest text-neutral-500">Minute</span>
                <select id="birth-minute" name="birthMinute" aria-label="Minute of birth" value={minute}
                  onChange={(e) => setMinute(Number(e.target.value))}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-sm text-neutral-100 outline-none focus:border-amber-400/60">
                  {Array.from({ length: 60 }, (_, i) => <option key={i} value={i}>{pad2(i)}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="birth-seconds" className="block text-[10px] uppercase tracking-widest text-neutral-500">Seconds (optional)</label>
                <input id="birth-seconds" name="birthSeconds" type="number" min={0} max={59} inputMode="numeric"
                  value={seconds}
                  onChange={(e) => setSeconds(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                  placeholder="-"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-sm text-neutral-100 outline-none focus:border-amber-400/60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-neutral-500">
              Sent as 24h <span className="text-amber-200/90">{composedTime}</span> · {place.timezone}
            </p>
          </div>

          <label className="mt-4 block text-xs uppercase tracking-widest text-neutral-400">Birth place</label>
          <div className="mt-1 flex gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void doSearch(); } }}
              placeholder="City, e.g. New Delhi"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-neutral-100 outline-none focus:border-amber-400/60" />
            <button type="button" onClick={() => void doSearch()}
              className="shrink-0 rounded-xl border border-amber-400/40 px-3 py-2 text-xs uppercase tracking-wider text-amber-200 hover:bg-amber-400/10">
              {searching ? "·" : "Find"}
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

          <button type="button" onClick={() => setShowManual((m) => !m)}
            className="mt-3 text-xs text-neutral-400 underline decoration-dotted hover:text-amber-200">
            {showManual ? "hide manual entry" : "search not working? enter coordinates by hand"}
          </button>

          {showManual && (
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
                {zoneOptions.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          )}

          <div className="mt-5 rounded-xl border border-amber-500/25 bg-black/40 p-3">
            <p className="text-xs uppercase tracking-widest text-neutral-400">What should this wallpaper help with?</p>
            <label className="mt-2 flex items-center gap-2 text-sm text-neutral-100">
              <input type="checkbox" checked={allAreasSelected} onChange={toggleAllAreas} className="h-4 w-4 accent-amber-400" />
              All-in-one · every area in one wallpaper
            </label>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {LIFE_AREAS.map((area) => (
                <label key={area} className="flex items-center gap-2 text-sm text-neutral-200">
                  <input type="checkbox" id={"focus-" + area} checked={focusAreas.includes(area)} onChange={() => toggleArea(area)}
                    className="h-4 w-4 accent-amber-400" />
                  {AREA_LABELS[area]}
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
              The AI reading and the artwork will weight toward the areas you select.
            </p>
          </div>

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
              <div className="flex justify-between"><dt className="text-neutral-500">Moon rasi</dt><dd>{rashiOf(chart.moonSign).name}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Ruling planet</dt><dd>{g.name} ({g.devanagari})</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Yantra</dt><dd>{g.yantra ? `${g.yantra.order}·${g.yantra.order}` : "geometric"}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Birth instant</dt><dd>{chart.utc.toISOString().replace(".000Z", " UTC")} ({formatOffset(chart.offsetMinutes)})</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Lahiri ayana?sa</dt><dd>{chart.ayanamsa.toFixed(4)}·</dd></div>
            </dl>
          )}
          {/* Internal Astrology Report */}
          {internalReport && (
            <div className="mt-5 rounded-xl border border-amber-500/25 bg-black/40 p-4">
              <button
                type="button"
                onClick={() => setShowReport(!showReport)}
                className="flex w-full items-center justify-between text-left"
              >
                <h3 className="font-serif text-base tracking-wide text-amber-200">Your Vedic Reading (Technical)</h3>
                <span className="text-xs text-neutral-400">{showReport ? "Hide" : "Show"}</span>
              </button>
              
              {showReport && (
                <div className="mt-3 space-y-3 text-xs text-neutral-300">
                  {/* Core Chart */}
                  <div className="grid grid-cols-2 gap-2 rounded bg-white/5 p-3">
                    <div>
                      <span className="text-neutral-500">Lagna</span>
                      <p className="font-medium text-neutral-100">{internalReport.lagna}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Moon</span>
                      <p className="font-medium text-neutral-100">{internalReport.moon}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Sun</span>
                      <p className="font-medium text-neutral-100">{internalReport.sun}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Nakshatra</span>
                      <p className="font-medium text-neutral-100">{internalReport.nakshatra} Pada {internalReport.pada}</p>
                    </div>
                  </div>
                  
                  {/* Current Dasa */}
                  <div className="rounded bg-white/5 p-3">
                    <h4 className="mb-1 font-medium text-amber-200">Vimsottari Dasa</h4>
                    <p className="text-sm">
                      <span className="text-amber-100">{internalReport.dasha.current}</span>
                      {" "}({internalReport.dasha.balance})
                    </p>
                    <p className="mt-1 text-[10px] text-neutral-500">Next: {internalReport.dasha.next}</p>
                  </div>
                  
                  {/* Problem Area */}
                  <div className="rounded bg-amber-500/10 p-3">
                    <h4 className="mb-1 font-medium text-amber-200">{internalReport.problemAnalysis.area} Analysis</h4>
                    <p className="text-[11px] text-neutral-400">{internalReport.problemAnalysis.transitImpact}</p>
                    {internalReport.problemAnalysis.afflictedPlanets.length > 0 && (
                      <div className="mt-2">
                        <span className="text-[10px] text-neutral-500">Affected planets: </span>
                        <span className="text-neutral-300">{internalReport.problemAnalysis.afflictedPlanets.map(p => p.name).join(", ")}</span>
                      </div>
                    )}
                    {internalReport.problemAnalysis.remedies.length > 0 && (
                      <div className="mt-2 border-t border-white/10 pt-2">
                        <span className="text-[10px] font-medium text-neutral-400">Remedies: </span>
                        {internalReport.problemAnalysis.remedies.slice(0, 2).map((r, i) => (
                          <p key={i} className="text-[10px] text-neutral-400">{r.type}: {r.name}</p>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] text-neutral-500">Strength:</span>
                      <div className="h-1 w-16 rounded-full bg-white/10">
                        <div className={`h-1 rounded-full ${internalReport.problemAnalysis.strengthScore >= 70 ? "bg-green-500" : internalReport.problemAnalysis.strengthScore >= 40 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${internalReport.problemAnalysis.strengthScore}%` }} />
                      </div>
                      <span className="text-xs">{internalReport.problemAnalysis.strengthScore}/100</span>
                    </div>
                  </div>
                  
                  {/* Regional variant notice */}
                  {internalReport.regional.displayName !== "Standard Vedic" && (
                    <div className="rounded bg-purple-500/10 p-3">
                      <span className="text-[10px] font-medium text-purple-300">Regional: {internalReport.regional.displayName}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
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
          {/* Regional Calculation System */}
          <div className="mt-4">
            <label className="block text-xs uppercase tracking-widest text-neutral-400">Regional Calculation</label>
            <select
              value={regionalSystem}
              onChange={(e) => setRegionalSystem(e.target.value as RegionalSystem)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-amber-400/60"
            >
              {REGIONAL_SYSTEMS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-neutral-500">
              {REGIONAL_SYSTEMS.find((r) => r.id === regionalSystem)?.description}
            </p>
          </div>

          {useAI && aiWallpaper && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-neutral-500">AI art background</span>
              <button type="button" onClick={() => setAiArtBg(true)} aria-pressed={aiArtBg}
                className={`rounded-xl border px-3 py-1.5 text-xs tracking-wider transition ${aiArtBg ? "border-amber-300 bg-amber-300/15 text-amber-100" : "border-white/15 text-neutral-300 hover:border-white/35"}`}>
                On
              </button>
              <button type="button" onClick={() => setAiArtBg(false)} aria-pressed={!aiArtBg}
                className={`rounded-xl border px-3 py-1.5 text-xs tracking-wider transition ${!aiArtBg ? "border-amber-300 bg-amber-300/15 text-amber-100" : "border-white/15 text-neutral-300 hover:border-white/35"}`}>
                Plain
              </button>
            </div>
          )}
          {useAI && (
            <p className="mb-3 text-xs text-neutral-500">
              {aiWallpaper
                ? "Your AI wallpaper is the model's generated art as the backdrop with your chart drawn on top (name, nakshatra, pada, mantra and kundli), and both downloads match this preview."
                : "The chart-accurate SVG is drawn from your chart on this device; when the AI step returns an image it becomes the wallpaper backdrop with your chart drawn on top."}
            </p>
          )}

          {aiBusy && (
            <p className="mb-3 text-center text-xs text-amber-200">
              {aiBusy === "reading" ? "Consulting the Jyotish·" : "Painting your premium wallpaper·"}
            </p>
          )}
          {aiError && (
            friendlyKeyError ? (
              <p className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 p-2 text-xs text-amber-100">
                The chart wallpaper above is complete. Add your own AI keys to unlock the Vedic reading + premium artwork.{" "}
                <button type="button" onClick={() => setByokOpen(true)}
                  className="ml-1 rounded-lg border border-amber-400/50 bg-amber-400/10 px-2 py-1 text-xs text-amber-100 hover:bg-amber-400/20">
                  Add AI keys
                </button>
              </p>
            ) : (
              <details className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 p-2 text-xs text-amber-100">
                <summary className="cursor-pointer">
                  AI step unavailable: {aiError.slice(0, 160)}{aiError.length > 160 ? "·" : ""}. The chart-accurate wallpaper above still works.
                </summary>
                <p className="mt-1 break-words text-neutral-300">{aiError}</p>
              </details>
            )
          )}
          {aiInfo && (
            <p className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 p-2 text-xs text-amber-100">{aiInfo}</p>
          )}

          <div ref={previewRef} className="mx-auto w-full max-w-[380px] overflow-hidden rounded-[2rem] border border-white/10 bg-black/50 shadow-2xl [&_svg]:block [&_svg]:h-auto [&_svg]:w-full">
            {svg
              ? <div className="[&_svg]:block [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
              : drawing.error
                ? <div className="flex aspect-[1170/2532] items-center justify-center p-8 text-center text-sm text-red-200">{drawing.error}</div>
                : (
                  <div className="flex aspect-[1170/2532] items-center justify-center p-8 text-center text-sm text-neutral-500">
                    Enter the birth details and press <span className="mx-1 text-amber-200">Create my wallpaper</span> · the wallpaper is drawn from the chart, here, live.
                  </div>
                )}
          </div>

          {chart && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <button type="button" onClick={() => void download("phone")} disabled={!!busy}
                className="rounded-xl border border-amber-400/50 bg-amber-400/10 px-4 py-2 text-sm text-amber-100 hover:bg-amber-400/20 disabled:opacity-50">
                {busy === "phone" ? "Rendering·" : `Download phone PNG ${PHONE.width}×${PHONE.height}`}
              </button>
              <button type="button" onClick={() => void download("desktop")} disabled={!!busy}
                className="rounded-xl border border-white/20 px-4 py-2 text-sm text-neutral-200 hover:bg-white/10 disabled:opacity-50">
                {busy === "desktop" ? "Rendering·" : `Download desktop PNG ${DESKTOP.width}×${DESKTOP.height}`}
              </button>
              {aiWallpaper && (
                <button type="button" onClick={() => void downloadAI()} disabled={!!busy}
                  className="rounded-xl border border-amber-400/50 bg-amber-400/10 px-4 py-2 text-sm text-amber-100 hover:bg-amber-400/20 disabled:opacity-50">
                  {busy === "ai" ? "Saving·" : "Download AI wallpaper"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

