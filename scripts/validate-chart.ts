/**
 * Engine validator. Run:  cd /home/team/shared/site && bun run scripts/validate-chart.ts
 * Prints, for each reference birth moment, the resolved UTC instant, ayanāṃśa,
 * tropical longitudes (for comparison with an independent ephemeris) and the
 * sidereal results (nakshatra + pada, lagna, rāśis). Also verifies that every
 * planetary yantra is a genuine magic square, and that the transcriber of this
 * file did not fumble an array.
 */
import { computeChart, dms, formatOffset, rashiOf, type BirthInput } from "../src/lib/astro";
import { GRAHAS, NAKSHATRAS } from "../src/content/vedic-mapping";

const CASES: BirthInput[] = [
  { name: "Test A (brief's example)", date: "1992-08-14", time: "05:45", place: "New Delhi, India", latitude: 28.6139, longitude: 77.2090, timezone: "Asia/Kolkata" },
  { name: "Test B", date: "2000-01-01", time: "12:00", place: "London, UK", latitude: 51.5074, longitude: -0.1278, timezone: "Europe/London" },
  { name: "Test C", date: "1969-07-20", time: "20:17", place: "Houston, USA", latitude: 29.7604, longitude: -95.3698, timezone: "America/Chicago" },
];

for (const c of CASES) {
  const ch = computeChart(c);
  console.log("=".repeat(78));
  console.log(`${c.name}: ${c.date} ${c.time} @ ${c.place} (${c.latitude}, ${c.longitude}, ${c.timezone})`);
  console.log(`  UTC instant       : ${ch.utc.toISOString()}  (offset ${formatOffset(ch.offsetMinutes)})`);
  console.log(`  JD                : ${ch.jd.toFixed(6)}   Lāhiri ayanāṃśa: ${ch.ayanamsa.toFixed(4)}° = ${dms(ch.ayanamsa)}`);
  const trop = (k: string) => {
    const jd = ch.jd;
    // recompute tropical by re-deriving from sidereal + ayanamsa
    const p = ch.planets.find((x) => x.key === k)!;
    void jd;
    return (p.longitude + ch.ayanamsa + 360) % 360;
  };
  for (const p of ch.planets) {
    console.log(`  ${p.key.padEnd(8)} tropical ${((p.longitude + ch.ayanamsa) % 360).toFixed(4).padStart(9)}   sidereal ${p.longitude.toFixed(4).padStart(9)}   ${rashiOf(p.signIndex).name.padEnd(9)} ${dms(p.degreeInSign).padStart(10)}  ${NAKSHATRAS[p.nakshatraIndex].name} p${p.pada}${p.retrograde ? " R" : ""}`);
  }
  void trop;
  console.log(`  LAGNA     tropical ${((ch.lagna.longitude + ch.ayanamsa) % 360).toFixed(4)}   sidereal ${ch.lagna.longitude.toFixed(4)}   ${rashiOf(ch.lagna.signIndex).name} (${rashiOf(ch.lagna.signIndex).english}) ${dms(ch.lagna.degreeInSign)}   nakshatra ${NAKSHATRAS[ch.lagna.nakshatraIndex].name} p${ch.lagna.pada}`);
  console.log(`  MOON nakshatra    : ${ch.moonNakshatra.name} pada ${ch.moonPada}  (lord ${GRAHAS[ch.rulingPlanet].name})  syllable ${ch.syllable.devanagari} / ${ch.syllable.roman}`);
  console.log(`  Rāśis             : moon ${rashiOf(ch.moonSign).name}, sun ${rashiOf(ch.sunSign).name}`);
  console.log(`  Houses (whole sign): ${ch.houses.map((h, i) => `${i + 1}:${rashiOf(h.signIndex).name}${h.planets.length ? "[" + h.planets.join(",") + "]" : ""}`).join(" ")}`);
}

console.log("=".repeat(78));
console.log("Magic-square verification (rows, columns and both diagonals):");
let allOk = true;
for (const g of Object.values(GRAHAS)) {
  if (!g.yantra) { console.log(`  ${g.name.padEnd(8)} — no classical square (geometric yantra only)`); continue; }
  const s = g.yantra.square;
  const n = s.length;
  const target = (n * (n * n + 1)) / 2;
  const rows = s.map((r) => r.reduce((a, b) => a + b, 0));
  const cols = Array.from({ length: n }, (_, c) => s.reduce((a, r) => a + r[c], 0));
  const d1 = s.reduce((a, r, i) => a + r[i], 0);
  const d2 = s.reduce((a, r, i) => a + r[n - 1 - i], 0);
  const flat = s.flat().sort((a, b) => a - b);
  const distinct = flat.every((v, i) => v === i + 1);
  const ok = [...rows, ...cols, d1, d2].every((v) => v === target) && distinct;
  allOk = allOk && ok;
  console.log(`  ${g.name.padEnd(8)} ${n}×${n}  constant ${target}  ${ok ? "OK" : "*** FAILED ***"}  (order=${g.yantra.order})`);
}
console.log(allOk ? "ALL MAGIC SQUARES VERIFIED" : "*** SQUARE DEFECT ***");

// Sample the day's motion to show pada-boundary sensitivity.
const base = CASES[0];
const a = computeChart({ ...base, time: "05:45" });
const b = computeChart({ ...base, time: "05:55" });
console.log("=".repeat(78));
console.log(`Moon moves ${(b.moon.longitude - a.moon.longitude).toFixed(4)}° in 10 minutes of birth time; sadvarga = ${((360 / 27) / 4 / 0.55 * 60).toFixed(0)} minutes per pada at the mean rate.`);
