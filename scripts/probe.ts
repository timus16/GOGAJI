import { computeChart } from "../src/lib/astro";
import { buildWallpaperSvg } from "../src/lib/wallpaper";
const input = { name: "Asha", date: "1992-08-14", time: "05:45", place: "New Delhi", latitude: 28.6139, longitude: 77.209, timezone: "Asia/Kolkata" };
try {
  const chart = computeChart(input as any);
  console.log("CHART_OK", chart.moonNakshatra?.name, chart.moonPada, JSON.stringify(chart.lagna), chart.rulingPlanet);
  for (const p of ["temple-gold","indigo-midnight","minimal-line-art","dense-mandala"]) {
    try { const svg = buildWallpaperSvg({ chart, presetId: p, width: 1170, height: 2532, fontFaceCss: "" }); console.log("SVG_OK", p, svg.length); }
    catch (e) { console.log("SVG_FAIL", p, String(e)); }
  }
} catch (e) { console.log("CHART_FAIL", String(e)); console.log((e as Error).stack?.split("\n").slice(0,6).join(" || ")); }
