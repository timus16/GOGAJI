/**
 * Compare the engine's tropical (of-date, apparent) geocentric ecliptic
 * longitudes against NASA/JPL Horizons — an independent, public ephemeris.
 * Horizons quantity 31 = "Observer ecliptic lon. & lat." (apparent, of date).
 *
 *   cd /home/team/shared/site && bun run scripts/horizons-compare.ts
 */
import { computeChart, jdFromDate, localToUtc, type BirthInput } from "../src/lib/astro";

const HZ: Record<string, string> = { sun: "10", moon: "301", mercury: "199", venus: "299", mars: "499", jupiter: "599", saturn: "699" };

const CASES: BirthInput[] = [
  { name: "1992-08-14 05:45 New Delhi", date: "1992-08-14", time: "05:45", place: "New Delhi", latitude: 28.6139, longitude: 77.2090, timezone: "Asia/Kolkata" },
  { name: "2000-01-01 12:00 London", date: "2000-01-01", time: "12:00", place: "London", latitude: 51.5074, longitude: -0.1278, timezone: "Europe/London" },
  { name: "1969-07-20 20:17 Houston", date: "1969-07-20", time: "20:17", place: "Houston", latitude: 29.7604, longitude: -95.3698, timezone: "America/Chicago" },
];

async function horizons(body: string, utc: Date): Promise<number> {
  const stamp = utc.toISOString().replace("T", " ").slice(0, 16);
  const stop = new Date(utc.getTime() + 60000).toISOString().replace("T", " ").slice(0, 16);
  const url = "https://ssd.jpl.nasa.gov/api/horizons.api?format=text"
    + `&COMMAND='${body}'&OBJ_DATA='NO'&MAKE_EPHEM='YES'&EPHEM_TYPE='OBSERVER'&CENTER='500@399'`
    + `&START_TIME='${stamp}'&STOP_TIME='${stop}'&STEP_SIZE='1m'&QUANTITIES='31'`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
      const t = await r.text();
      const soe = t.indexOf("$$SOE"), eoe = t.indexOf("$$EOE");
      if (soe < 0 || eoe < 0) { console.error("no ephemeris block", t.slice(0, 200)); continue; }
      const row = t.slice(soe + 5, eoe).trim().split("\n").filter(Boolean)[0];
      const tok = row.trim().split(/\s+/);
      // tokens: date, time, EC-lon, EC-lat, ...
      const lon = Number(tok[2]);
      if (Number.isFinite(lon)) return lon;
      console.error("parse?", JSON.stringify(tok.slice(0, 6)));
    } catch (e) { console.error("retry", String(e).slice(0, 80)); }
  }
  return NaN;
}

const fmt = (d: number) => `${d.toFixed(4).padStart(10)}`;
console.log("body      engine(tropical)   horizons       delta (arcmin)");
let worst = 0;
for (const c of CASES) {
  const ch = computeChart(c);
  console.log("-".repeat(70));
  console.log(c.name, "| UTC", ch.utc.toISOString());
  for (const [key, body] of Object.entries(HZ)) {
    const engine = (ch.planets.find((p) => p.key === key)!.longitude + ch.ayanamsa) % 360;
    const hz = await horizons(body, ch.utc);
    let d = engine - hz;
    while (d > 180) d -= 360; while (d < -180) d += 360;
    const arcmin = d * 60;
    worst = Math.max(worst, Math.abs(arcmin));
    console.log(`${key.padEnd(8)} ${fmt(engine)}   ${Number.isFinite(hz) ? fmt(hz) : "   (no data)"}   ${Number.isFinite(hz) ? arcmin.toFixed(2).padStart(8) : ""}`);
  }
  void jdFromDate; void localToUtc;
}
console.log("-".repeat(70));
console.log(`worst disagreement across all bodies and instants: ${worst.toFixed(2)} arcmin = ${(worst / 60).toFixed(4)}°`);
console.log(`(a pada is 200 arcmin wide, a rāśi 1800 arcmin — so this is well inside the resolution that decides nakshatra, pada or rāśi.)`);
