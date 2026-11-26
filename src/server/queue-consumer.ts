/**
 * Queue Consumer: Processes wallpaper generation jobs in background.
 * Runs with 15min timeout (Cloudflare Queues default), no 30s limit.
 */

import { computeChart, type BirthInput } from "~/lib/astro";
import { type EnvLike } from "~/lib/env";
import { assessChart, chartFactSheet } from "~/content/problems";
import { presetById, getProblemAreaMantra, type ProblemArea, GRAHAS } from "~/content/vedic-mapping";
import { readKundli, type Reading, type ReadingProvider } from "~/lib/gemini";
import { nvidiaWallpaper, promptFromBrief, wallpaperSeed } from "~/lib/nvidia";
import { errorMessage } from "~/lib/gemini";

export interface QueueMessage {
  jobId: string;
  input: {
    name: string;
    date: string;
    time: string;
    place: string;
    latitude: number;
    longitude: number;
    timezone: string;
    presetId?: string;
    focusAreas?: string[];
    keys?: { gemini?: string; nvidia?: string };
    deviceId?: string;
  };
}

interface QueueEnvLike extends EnvLike {
  JOBS_DO: DurableObjectNamespace;
}

export async function processWallpaperJob(
  message: QueueMessage,
  env: QueueEnvLike,
): Promise<void> {
  const { jobId, input } = message;
  
  console.log("[QueueConsumer] Starting job:", jobId);
  
  // Get DO stub
  const doId = env.JOBS_DO.idFromName("jobs");
  const stub = env.JOBS_DO.get(doId);
  
  console.log("[QueueConsumer] Got DO stub, updating status to processing");
  
  // Update status to processing
  await stub.updateJob(jobId, { status: "processing", updatedAt: Date.now() });
  
  console.log("[QueueConsumer] Status updated to processing");
  
  try {
    // 1. Compute chart (deterministic, fast)
    console.log("[QueueConsumer] Computing chart");
    const chart = await computeChart(input);
    const conditions = assessChart(chart);
    const sheet = chartFactSheet(chart, conditions, input.focusAreas);
    console.log("[QueueConsumer] Chart computed, facts:", Object.keys(sheet.facts).length);
    
    // 2. Run reading and image generation in PARALLEL
    const seed = wallpaperSeed(input);
    const preset = input.presetId ? presetById(input.presetId) : null;
    const primaryFocusArea = input.focusAreas?.[0] as ProblemArea | undefined;
    const problemAreaMantra = primaryFocusArea ? getProblemAreaMantra(primaryFocusArea) : undefined;
    
    const promptOpts = { 
      facts: sheet.facts, 
      preset, 
      focusAreas: input.focusAreas,
      problemAreaMantra: problemAreaMantra ? {
        devanagari: problemAreaMantra.devanagari,
        roman: problemAreaMantra.roman,
        planet: GRAHAS[problemAreaMantra.planet].name,
      } : undefined,
    };
    
    // Build prompt from chart facts immediately (don'"'"'t wait for reading)
    const fallbackPrompt = promptFromBrief(null, sheet.text, promptOpts);
    console.log("[QueueConsumer] Fallback prompt built, length:", fallbackPrompt.length);
    
    // Run both in parallel with generous timeouts
    console.log("[QueueConsumer] Starting parallel reading and image generation");
    const [readingResult, imageResult] = await Promise.allSettled([
      // Reading with 60s timeout (queue has 15min)
      (async () => {
        try {
          console.log("[QueueConsumer] Starting reading");
          const result = await readKundli(sheet.text, input.keys, env);
          console.log("[QueueConsumer] Reading completed, provider:", result.provider);
          return { reading: result.reading, provider: result.provider, error: null };
        } catch (err) {
          console.log("[QueueConsumer] Reading error:", errorMessage(err));
          return { reading: null, provider: undefined, error: errorMessage(err) };
        }
      })(),
      
      // Image with 90s timeout
      (async () => {
        try {
          console.log("[QueueConsumer] Starting image generation");
          const painted = await nvidiaWallpaper(fallbackPrompt, { 
            width: 832, height: 1216, seed, 
            keyOverride: input.keys?.nvidia,
            env,
          });
          console.log("[QueueConsumer] Image generation completed");
          return { 
            image: { 
              dataUrl: painted.dataUrl, 
              mime: painted.mime, 
              width: painted.width, 
              height: painted.height 
            }, 
            error: null 
          };
        } catch (err) {
          console.log("[QueueConsumer] Image error:", errorMessage(err));
          return { image: null, error: errorMessage(err) };
        }
      })(),
    ]);
    
    console.log("[QueueConsumer] Both reading and image completed");
    
    // Process results
    const reading = readingResult.status === "fulfilled" ? readingResult.value.reading : null;
    const provider = readingResult.status === "fulfilled" ? readingResult.value.provider : undefined;
    const readingError = readingResult.status === "fulfilled" ? readingResult.value.error : (readingResult.status === "rejected" ? errorMessage(readingResult.reason) : "Reading failed");
    
    const image = imageResult.status === "fulfilled" ? imageResult.value.image : null;
    const imageError = imageResult.status === "fulfilled" ? imageResult.value.error : (imageResult.status === "rejected" ? errorMessage(imageResult.reason) : "Image failed");
    
    // Build final prompt (use reading if available for better brief)
    const finalPrompt = promptFromBrief(reading, sheet.text, promptOpts);
    
    const errors: string[] = [];
    if (readingError) errors.push("Reading: " + readingError);
    if (imageError) errors.push("Image: " + imageError);
    
    const result = {
      chartSummary: { facts: sheet.facts, text: sheet.text },
      conditions: { conditions: conditions.conditions, positives: conditions.positives },
      reading,
      image,
      wallpaperPrompt: finalPrompt,
      error: errors.length ? errors.join(" | ") : undefined,
      provider,
    };
    
    console.log("[QueueConsumer] Updating job status to completed");
    // Update job with result
    await stub.updateJob(jobId, { 
      status: "completed", 
      result, 
      updatedAt: Date.now() 
    });
    console.log("[QueueConsumer] Job completed successfully");
    
  } catch (err) {
    console.log("[QueueConsumer] Job failed:", errorMessage(err));
    await stub.updateJob(jobId, { 
      status: "failed", 
      error: errorMessage(err), 
      updatedAt: Date.now() 
    });
  }
}

