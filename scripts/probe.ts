import { computeChart } from "../src/lib/astro";
import { buildWallpaperSvg } from "../src/lib/wallpaper";
const input = { name: "Asha", date: "1992-08-14", time: "05:45", place: "New Delhi", latitude: 28.6139, longitude: 77.209, timezone: "Asia/Kolkata" };
try {
  const chart = computeChart(input as any);
  console.log("CHART_OK", chart.moonNakshatra?.name, chart.moonPada, JSON.stringify(chart.lagna), chart.rulingPlanet);
  // These are the real preset ids from src/content/vedic-mapping.ts: an unknown
  // id makes presetById silently fall back to temple-gold, so a typo here would
  // quietly stop exercising a style. The length check below is the tripwire.
  const lengths: Record<string, number> = {};
  for (const p of ["temple-gold","indigo-midnight","minimal-line","dense-mandala"]) {
    try { const svg = buildWallpaperSvg({ chart, presetId: p, width: 1170, height: 2532, fontFaceCss: "" }); lengths[p] = svg.length; console.log("SVG_OK", p, svg.length); }
    catch (e) { console.log("SVG_FAIL", p, String(e)); }
  }
  // Four distinct ids must yield four distinct lengths; a shared length means
  // one silently fell back to the default preset.
  const distinct = new Set(Object.values(lengths));
  console.log(Object.keys(lengths).length === 4 && distinct.size === 4 ? "SVG_LENGTHS_DISTINCT" : "SVG_LENGTH_COLLISION", JSON.stringify(lengths));
} catch (e) { console.log("CHART_FAIL", String(e)); console.log((e as Error).stack?.split("\n").slice(0,6).join(" || ")); }
