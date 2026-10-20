/**
 * The server boundary of the AI step.
 *
 * Two rules hold here, and they are the reason this file exists:
 *  1. The deterministic chart engine is the ONLY source of planetary maths.
 *     `computeChart()` computes the positions; the model is only ever given a
 *     fact sheet built from that chart. An LLM never computes a position.
 *  2. This handler NEVER throws. A missing key, a 429, a timeout, invalid
 *     JSON — all of them degrade to `reading: null` and/or no image plus a
 *     human-readable `error`, so the chart-accurate SVG path stays usable.
 */

import { createServerFn } from "@tanstack/react-start";
import { computeChart, type BirthInput, type Chart } from "~/lib/astro";
import { assessChart, chartFactSheet, type BirthChartConditions } from "~/content/problems";
import { errorMessage, readKundli, type Reading } from "~/lib/gemini";
import { nvidiaWallpaper, promptFromBrief } from "~/lib/nvidia";

export type { Reading } from "~/lib/gemini";
export type { BirthInput } from "~/lib/astro";
export type { BirthChartConditions } from "~/content/problems";

/** Which LLM produced the reading. */
export type ReadingProvider = "gemini" | "openrouter" | "baidu";

/** The fact sheet the model was given — the chart, in flat text. */
export interface ChartSummary {
  facts: Record<string, string>;
  text: string;
}

/** What the client gets back. */
export interface WallpaperResponse {
  chartSummary: ChartSummary;
  conditions: BirthChartConditions;
  reading: Reading | null;
  image?: { dataUrl: string; mime: string; width: number; height: number };
  wallpaperPrompt: string;
  provider?: ReadingProvider;
  error?: string;
}

/** The fact sheet of a computed chart, on its own. */
export function chartSummaryOf(chart: Chart): ChartSummary {
  return chartFactSheet(chart);
}

/** Join the collected failure notes into one readable line. */
function joinErrors(errors: string[]): string | undefined {
  if (errors.length === 0) return undefined;
  return errors.join(" · ");
}

/**
 * The handler body, kept as a plain exported function so it can be exercised
 * directly (and so the server function is a thin wrapper around it).
 */
export async function buildWallpaperResponse(data: BirthInput): Promise<WallpaperResponse> {
    const errors: string[] = [];

    try {
      // 1. The chart engine is the only source of planetary maths.
      const chart = computeChart(data);

      // 2. The deterministic condition assessment and the fact sheet.
      const conditions = assessChart(chart);
      const sheet = chartFactSheet(chart);

      // 3. The reading. A failure here must not sink the whole request.
      let reading: Reading | null = null;
      let provider: ReadingProvider | undefined;
      try {
        const result = await readKundli(sheet.text);
        reading = result.reading;
        provider = result.provider;
      } catch (err) {
        errors.push(`Reading unavailable: ${errorMessage(err)}`);
      }

      // 4. The artwork. The prompt is built from the brief AND the chart, so
      //    the art is still chart-derived even when the reading failed.
      let wallpaperPrompt = "";
      let image: WallpaperResponse["image"];
      try {
        wallpaperPrompt = promptFromBrief(reading, sheet.text);
        const painted = await nvidiaWallpaper(wallpaperPrompt, {
          width: 832,
          height: 1216,
        });
        image = {
          dataUrl: painted.dataUrl,
          mime: painted.mime,
          width: painted.width,
          height: painted.height,
        };
      } catch (err) {
        errors.push(`Wallpaper unavailable: ${errorMessage(err)}`);
        if (!wallpaperPrompt) {
          try {
            wallpaperPrompt = promptFromBrief(reading, sheet.text);
          } catch {
            wallpaperPrompt = "";
          }
        }
      }

      const response: WallpaperResponse = {
        chartSummary: sheet,
        conditions,
        reading,
        wallpaperPrompt,
      };
      if (image) response.image = image;
      if (provider) response.provider = provider;
      const error = joinErrors(errors);
      if (error) response.error = error;
      return response;
    } catch (err) {
      // The last resort: the chart itself could not be computed. Return a
      // valid response shape anyway so the client never crashes.
      return {
        chartSummary: { facts: {}, text: "" },
        conditions: { conditions: [], positives: [] },
        reading: null,
        wallpaperPrompt: "",
        error: `Could not build the chart: ${errorMessage(err)}`,
      };
    }
}

export const generateWallpaper = createServerFn({ method: "POST" })
  .validator((d: BirthInput) => d)
  .handler(async ({ data }): Promise<WallpaperResponse> => buildWallpaperResponse(data));