import { createFileRoute } from "@tanstack/react-router";
import {
  computeChart,
  computePanchang,
  vimshottariDasha,
  computeTransits,
  type Chart,
  type BirthInput,
  type Panchang,
  type TransitPosition as AstroTransitPosition,
} from "~/lib/astro";
import { type PlanetKey } from "~/content/vedic-mapping";

const DEFAULT_INTERVAL = 30000;
const YEAR_MS = 365.25 * 86400000;

interface TransitPosition {
  planet: PlanetKey;
  longitude: number;
  signIndex: number;
  degreeInSign: number;
  nakshatraIndex: number;
  pada: number;
  retrograde: boolean;
}

interface DashaInfo {
  currentMahadasha: { planet: PlanetKey; start: Date; end: Date; yearsLeft: number };
  currentAntardasha: { planet: PlanetKey; start: Date; end: Date };
  balance: { planet: PlanetKey; yearsLeft: number };
}

interface KaalTiming {
  name: string;
  start: Date;
  end: Date;
  weekday: number;
}

interface SSEEvent {
  timestamp: string;
  transits: TransitPosition[];
  dasha: DashaInfo;
  panchang: Panchang;
  kaalTimings: KaalTiming[];
}

function mapTransits(astroTransits: AstroTransitPosition[]): TransitPosition[] {
  return astroTransits.map((t) => ({
    planet: t.key,
    longitude: t.longitude,
    signIndex: t.signIndex,
    degreeInSign: t.degreeInSign,
    nakshatraIndex: t.nakshatraIndex,
    pada: t.pada,
    retrograde: t.retrograde,
  }));
}

function getDashaInfo(chart: Chart): DashaInfo {
  const dasha = vimshottariDasha(chart, 9);
  const currentMahadasha = dasha.periods[0];
  const balance = dasha.balance;

  const antardashaOrder = [
    "ketu", "venus", "sun", "moon", "mars", "rahu", "jupiter", "saturn", "mercury",
  ] as PlanetKey[];
  const startIdx = antardashaOrder.indexOf(currentMahadasha.lord as PlanetKey);
  const ordered = [...antardashaOrder.slice(startIdx), ...antardashaOrder.slice(0, startIdx)];

  const mdStart = currentMahadasha.start.getTime();
  const mdEnd = currentMahadasha.end.getTime();
  const mdDuration = mdEnd - mdStart;
  const now = Date.now();
  const elapsed = now - mdStart;
  const adIndex = Math.min(Math.floor((elapsed / mdDuration) * 9), 8);
  const adPlanet = ordered[adIndex];
  const adDuration = mdDuration / 9;
  const adStart = new Date(mdStart + adIndex * adDuration);
  const adEnd = new Date(mdStart + (adIndex + 1) * adDuration);

  return {
    currentMahadasha: {
      planet: currentMahadasha.lord as PlanetKey,
      start: currentMahadasha.start,
      end: currentMahadasha.end,
      yearsLeft: balance.yearsLeft,
    },
    currentAntardasha: {
      planet: adPlanet,
      start: adStart,
      end: adEnd,
    },
    balance: { planet: balance.lord as PlanetKey, yearsLeft: balance.yearsLeft },
  };
}

function getKaalTimings(forDate: Date, latitude: number, longitude: number, timezone: string): KaalTiming[] {
  const dayStart = new Date(forDate);
  dayStart.setUTCHours(0, 0, 0, 0);

  const results: KaalTiming[] = [];
  const weekday = forDate.getUTCDay();

  const rahuKaalStarts = [6, 3, 7, 4, 8, 5, 9, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5];
  const yamagandaStarts = [12, 9, 6, 3, 1, 10, 7, 4, 2, 11, 8, 5, 3, 12, 10, 7, 4, 1];
  const gulikaStarts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

  const rahuStartHour = rahuKaalStarts[weekday];
  const yamagandaStartHour = yamagandaStarts[weekday];
  const gulikaStartHour = gulikaStarts[weekday];

  const dayMs = 24 * 60 * 60 * 1000;
  const periodMs = dayMs / 8;

  const rahuStart = new Date(dayStart.getTime() + rahuStartHour * 3600000);
  const rahuEnd = new Date(rahuStart.getTime() + periodMs);

  const yamagandaStart = new Date(dayStart.getTime() + yamagandaStartHour * 3600000);
  const yamagandaEnd = new Date(yamagandaStart.getTime() + periodMs);

  const gulikaStart = new Date(dayStart.getTime() + gulikaStartHour * 3600000);
  const gulikaEnd = new Date(gulikaStart.getTime() + periodMs);

  results.push(
    { name: "Rahu Kaal", start: rahuStart, end: rahuEnd, weekday },
    { name: "Yamaganda", start: yamagandaStart, end: yamagandaEnd, weekday },
    { name: "Gulika Kaal", start: gulikaStart, end: gulikaEnd, weekday },
  );

  return results;
}

function buildEvent(chart: Chart, at: Date): SSEEvent {
  const astroTransits = computeTransits(at);
  const transits = mapTransits(astroTransits);
  const dasha = getDashaInfo(chart);
  const panchang = computePanchang(at, chart.offsetMinutes);
  const kaalTimings = getKaalTimings(at, chart.input.latitude, chart.input.longitude, chart.input.timezone);

  return {
    timestamp: at.toISOString(),
    transits,
    dasha,
    panchang,
    kaalTimings,
  };
}

function parseChartParam(searchParams: URLSearchParams): Chart | null {
  const chartParam = searchParams.get("chart");
  if (!chartParam) return null;
  try {
    const input: BirthInput = JSON.parse(chartParam);
    return computeChart(input);
  } catch {
    return null;
  }
}

function formatSSE(data: SSEEvent): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export const Route = createFileRoute("/api/events")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const searchParams = url.searchParams;

        const intervalParam = searchParams.get("interval");
        const interval = intervalParam ? Math.max(1000, parseInt(intervalParam, 10)) : DEFAULT_INTERVAL;

        const chart = parseChartParam(searchParams);
        if (!chart) {
          return new Response(
            JSON.stringify({ error: "Invalid or missing chart parameter" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const encoder = new TextEncoder();
        let closed = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const stream = new ReadableStream({
          async start(controller) {
            const send = (event: SSEEvent) => {
              if (closed) return;
              try {
                controller.enqueue(encoder.encode(formatSSE(event)));
              } catch {
                close();
              }
            };

            const close = () => {
              if (closed) return;
              closed = true;
              if (intervalId) clearInterval(intervalId);
              try { controller.close(); } catch {}
            };

            request.signal.addEventListener("abort", close);

            const now = new Date();
            send(buildEvent(chart, now));

            intervalId = setInterval(() => {
              const tick = new Date();
              send(buildEvent(chart, tick));
            }, interval);
          },
          cancel() {
            closed = true;
            if (intervalId) clearInterval(intervalId);
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});