import type { BirthInput } from "~/lib/astro";

/**
 * Pre-AI qualification filters. These decide whether a form submission should
 * proceed to AI generation or be blocked early.
 *
 * Use cases:
 *  - Disqualify submissions missing required data (e.g., no birth time)
 *  - Block bulk reseller intent ("I want 1000 wallpapers")
 *  - Filter prediction-focused requests ("tell me when I\'ll get rich")
 *  - Prevent API abuse / rate-limit suspicious patterns
 */

export interface QualificationResult {
  allow: boolean;
  /** Human-readable reason shown to the user when disqualified */
  reason?: string;
}

/**
 * Decide whether this submission should call the AI provider.
 *
 * @param input - Birth input from the form
 * @param intent - Answer to discovery Q1: "What will you use this for?"
 * @returns { allow: true } to proceed, or { allow: false, reason } to block
 */
export function shouldCallAI(
  input: BirthInput,
  intent: string
): QualificationResult {
  // Rule 1: Birth time is required for accurate nakshatra calculation.
  // The chart engine can compute without time (uses noon), but the nakshatra
  // wallpaper is deeply personal and time-dependent, so we require it.
  if (!input.time || input.time.trim() === "") {
    return {
      allow: false,
      reason:
        "Birth time is required for an accurate nakshatra reading. " +
        "If you don\'t know the exact time, try to get it from your birth certificate or ask family.",
    };
  }

  // Rule 2: Block bulk/reseller intent.
  // These keywords suggest commercial exploitation rather than personal use.
  const bulkKeywords = [
    "bulk",
    "wholesale",
    "resell",
    "1000",
    "100",
    "many",
    "clients",
    "customers",
    "business",
  ];
  const intentLower = intent.toLowerCase();
  const isBulk = bulkKeywords.some((kw) => intentLower.includes(kw));

  if (isBulk) {
    return {
      allow: false,
      reason:
        "This service is for personal use only. For commercial or bulk inquiries, " +
        "please contact us directly at hello@gogaji.app.",
    };
  }

  // Rule 3: Filter prediction-focused intent.
  // Vedic astrology is about self-knowledge, not fortune-telling. We block
  // requests that frame the tool as a prediction engine.
  const predictionKeywords = [
    "predict",
    "future",
    "when will",
    "lottery",
    "win",
    "rich",
    "marry",
    "die",
    "forecast",
  ];
  const isPrediction = predictionKeywords.some((kw) => intentLower.includes(kw));

  if (isPrediction) {
    return {
      allow: false,
      reason:
        "This tool creates a personalized nakshatra wallpaper and reading, " +
        "not predictions. Vedic astrology is about self-understanding, not fortune-telling.",
    };
  }

  // Rule 4: Basic name validation (prevents spam/test submissions)
  const nameTrimmed = input.name.trim();
  if (nameTrimmed.length < 2) {
    return {
      allow: false,
      reason: "Please enter a valid name (at least 2 characters).",
    };
  }

  // Disallow obviously fake names
  const fakeNames = [
    "test",
    "asdf",
    "qwerty",
    "xxx",
    "abc",
    "sample",
    "demo",
    "example",
  ];
  const nameLower = nameTrimmed.toLowerCase();
  const isFake = fakeNames.some(
    (fake) => nameLower === fake || nameLower.startsWith(fake + " ")
  );

  if (isFake) {
    return {
      allow: false,
      reason: "Please enter a real name to receive a personalized reading.",
    };
  }

  // Rule 5: Place validation (must have coordinates)
  if (
    !input.place ||
    input.place.trim() === "" ||
    !Number.isFinite(input.latitude) ||
    !Number.isFinite(input.longitude)
  ) {
    return {
      allow: false,
      reason: "Please select a valid birth place from the search results.",
    };
  }

  // All checks passed
  return { allow: true };
}

/**
 * Additional rate-limiting helper (to be called from server).
 * Checks if this IP has exceeded submission limits.
 *
 * In production, this would query Redis or your rate-limit store.
 * For now, it\'s a placeholder that always allows.
 */
export function checkRateLimit(_ip: string): QualificationResult {
  // TODO: Implement actual rate limiting
  // Example: allow 5 submissions per IP per hour
  //
  // const key = `ratelimit:${ip}`;
  // const count = await redis.get(key);
  // if (count && parseInt(count) >= 5) {
  //   return {
  //     allow: false,
  //     reason: "Too many requests. Please try again in an hour.",
  //   };
  // }
  // await redis.incr(key);
  // await redis.expire(key, 3600); // 1 hour TTL

  return { allow: true };
}