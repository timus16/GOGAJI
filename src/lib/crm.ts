import type { BirthInput } from "~/lib/astro";
import { computeChart } from "~/lib/astro";

/**
 * CRM schema for lead capture. Every form submission is captured, regardless
 * of whether it proceeds to AI generation or is disqualified.
 */
export interface LeadCapture {
  /** UUID v4 */
  id: string;
  /** UTC timestamp of submission */
  timestamp: Date;
  /** The birth input from the form */
  input: BirthInput;
  /** Style preset ID selected, or empty string for default */
  presetId: string;
  /** Answer to Q1: "What will you use this for?" */
  intent: string;
  /** Answer to Q2: "What did the last astrology app get wrong?" */
  previousFailure: string;
  /** Computed nakshatra name (deterministic, from chart engine) */
  nakshatra: string;
  /** Life areas the user asked the wallpaper to focus on (empty = all) */
  focusAreas?: string[];
  /** AI provider used for reading generation, or null if disqualified/errored */
  provider?: string;
  /** Error message if generation failed or was blocked */
  error?: string;
}

/**
 * Capture a form submission to the CRM store.
 *
 * PRIVACY (P1): persistence is opt-in. When `consent` is false the lead is
 * built in memory only and returned — nothing is written to localStorage and
 * nothing containing PII reaches the console. The caller passes the user's
 * AI opt-in as the consent signal, so the local record exists exactly when
 * the user chose to use the AI step.
 *
 * When consented, it logs to console and localStorage for local dev inspection.
 */
export function captureSubmit(
  data: Omit<LeadCapture, "id" | "timestamp">,
  consent = true,
): LeadCapture {
  const record: LeadCapture = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    ...data,
  };

  // Transient path: no consent, no storage, no PII in the console.
  if (!consent) {
    console.log("[CRM] Transient lead captured (no AI opt-in): nothing stored, nothing logged.");
    return record;
  }

  // Console log for immediate dev feedback
  console.log("[CRM] Lead captured:", {
    id: record.id,
    name: record.input.name,
    place: record.input.place,
    nakshatra: record.nakshatra,
    intent: record.intent,
    provider: record.provider ?? "none",
    error: record.error ?? "none",
  });

  // Persist to localStorage for dev inspection
  try {
    const key = `lead_${record.id}`;
    localStorage.setItem(key, JSON.stringify(record));

    // Also maintain a lead index for easy retrieval
    const indexKey = "lead_index";
    const index = JSON.parse(localStorage.getItem(indexKey) ?? "[]") as string[];
    index.push(record.id);
    // Keep only last 100 leads in browser storage
    const trimmed = index.slice(-100);
    localStorage.setItem(indexKey, JSON.stringify(trimmed));
  } catch (e) {
    console.warn("[CRM] Failed to persist to localStorage:", e);
  }

  // TODO: In production, POST to /api/crm or write directly to your database:
  // await fetch("/api/crm/lead", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(record),
  // });

  return record;
}

/**
 * Helper: compute the nakshatra name from birth input without running full AI.
 * This is deterministic and cheap, so every submit can include it.
 */
export function computeNakshatra(input: BirthInput): string {
  try {
    const chart = computeChart(input);
    return chart.moonNakshatra.name;
  } catch (e) {
    return "unknown";
  }
}

/**
 * Retrieve all captured leads from localStorage (dev only).
 * Returns most recent first.
 */
export function getAllLeads(): LeadCapture[] {
  try {
    const indexKey = "lead_index";
    const index = JSON.parse(localStorage.getItem(indexKey) ?? "[]") as string[];
    const leads: LeadCapture[] = [];

    for (const id of index) {
      const key = `lead_${id}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const lead = JSON.parse(raw) as LeadCapture;
        // Rehydrate Date object
        lead.timestamp = new Date(lead.timestamp);
        leads.push(lead);
      }
    }

    // Most recent first
    return leads.reverse();
  } catch (e) {
    console.warn("[CRM] Failed to retrieve leads:", e);
    return [];
  }
}