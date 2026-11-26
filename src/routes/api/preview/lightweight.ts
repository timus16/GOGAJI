import { createFileRoute } from "@tanstack/react-router";
import { computeChart } from "~/lib/astro";
import { presetById } from "~/content/vedic-mapping";
import { buildWallpaperSvg } from "~/lib/wallpaper";
import { previewFontFaceCss } from "~/lib/exporter";

interface LightweightPreviewRequest {
  name: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  latitude: number;
  longitude: number;
  timezone: string;
  presetId?: string;
  focusAreas?: string[];
  regionalSystem?: string;
  subject?: "self" | "child";
}

export const Route = createFileRoute("/api/preview/lightweight")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const data: LightweightPreviewRequest = await request.json();
          
          if (!data.name?.trim() || !data.birthDate || !data.birthTime || !data.birthPlace?.trim()) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), { 
              status: 400,
              headers: { "Content-Type": "application/json" }
            });
          }

          // Build birth input for chart computation
          const input = {
            name: data.name.trim(),
            date: data.birthDate,
            time: data.birthTime,
            place: data.birthPlace.trim(),
            latitude: data.latitude,
            longitude: data.longitude,
            timezone: data.timezone,
          };

          // 1. Compute chart (deterministic, fast)
          const chart = await computeChart(input);

          // 2. Build deterministic SVG wallpaper (fast, no AI)
          const presetId = data.presetId || "temple-gold";
          const width = 480; // smaller for preview
          const height = 640;
          
          const svg = buildWallpaperSvg({
            chart,
            presetId,
            width,
            height,
            fontFaceCss: previewFontFaceCss,
            focusAreas: data.focusAreas,
          });

          // 3. Extract chart facts for display
          const nakshatra = chart.moonNakshatra;
          const rulingPlanet = chart.rulingPlanet;
          const syllable = chart.syllable;
          
          const response = {
            svg,
            chartFacts: {
              nakshatra: nakshatra.name,
              nakshatraDevanagari: nakshatra.devanagari,
              rulingPlanet: rulingPlanet,
              namingSyllable: syllable.roman,
              namingSyllableDevanagari: syllable.devanagari,
            },
            // Include minimal chart data for potential future use
            chart: {
              lagna: chart.lagna.signIndex,
              moonSign: chart.moonSign,
              sunSign: chart.sunSign,
              moonNakshatra: chart.moonNakshatraIndex,
              moonPada: chart.moonPada,
              rulingPlanet: chart.rulingPlanet,
            }
          };

          return new Response(JSON.stringify(response), { 
            headers: { "Content-Type": "application/json" }
          });
        } catch (err) {
          console.error("Lightweight preview error:", err);
          return new Response(JSON.stringify({ 
            error: "Preview generation failed: " + (err instanceof Error ? err.message : String(err)) 
          }), { 
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      },
    },
  },
});