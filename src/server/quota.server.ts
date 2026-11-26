/**
 * The daily quota.
 *
 * Semantics (both tiers are DAILY, counted since UTC midnight):
 *   - ANONYMOUS : FREE_ANON_LIMIT (default 5) generations per day, counted
 *                 for the client device id and/or the hashed client IP.
 *   - SIGNED IN : Uses credits system. 1 credit per generation.
 *                 Credits are deducted on successful generation.
 *
 * Both limits are read from the environment LAZILY, per call, so a changed
 * environment takes effect without a rebuild.
 *
 * `authRequired` is true once the applicable daily allowance is spent: for an
 * anonymous visitor that is the signal to prompt a sign-up (a signed-in
 * visitor gets the larger allowance instead).
 *
 * On a database error the result FAILS SAFE: `authRequired` is true and an
 * explicit `error` is reported, so the paid path is never silently unlimited.
 * The deterministic (free, local) wallpaper path is untouched by any of this.
 */

import { hmacHexWith, ipHashSecret } from "./auth";
import { countGenerationsFor, insertGeneration, UNKNOWN_IP_HASH, type DbResult, getCredits, deductCredits } from "./db";
import type { QuotaIdentity } from "./session-utils.server";

export type { QuotaIdentity } from "./session-utils.server";
export { currentQuotaIdentity } from "./session-utils.server";

export interface QuotaResult {
  used: number;
  limit: number;
  remaining: number;
  authRequired: boolean;
  error?: string;
}

export const FREE_ANON_LIMIT_DEFAULT = 5;
export const AUTH_DAILY_LIMIT_DEFAULT = 25;

/** The anonymous daily allowance. Read from the environment per call. */
export function freeAnonLimit(): number {
  const raw = process.env.FREE_ANON_LIMIT;
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? n : FREE_ANON_LIMIT_DEFAULT;
}

/** The signed-in daily allowance. Read from the environment per call. */
export function authDailyLimit(): number {
  const raw = process.env.AUTH_DAILY_LIMIT;
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? n : AUTH_DAILY_LIMIT_DEFAULT;
}

/** Start of the current UTC day, as a Date. */
export function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * A stable, non-reversible fingerprint of a client IP.
 *
 * A plain SHA-256 of an IPv4 address is trivially reversible by brute force,
 * so the IP is keyed with a server secret (HMAC) instead. The value is only
 * ever used for counting.
 */
export async function ipHash(ip: string): Promise<string> {
  const hex = await hmacHexWith(ipHashSecret(), ip.trim());
  return hex.slice(0, 16);
}

/**
 * Count the anonymous rows of this identity for the current day.
 *
 * Anonymous rows are only ever the ones with NO account (`user_id IS NULL`),
 * so a signed-in visitor's generations are never charged to the free tier.
 * A visitor with neither a device id nor an IP is charged to the shared
 * "unknown" bucket - the rows recorded without any identity at all.
 */
async function countAnonymous(
  identity: QuotaIdentity,
  sinceUtc: Date,
): Promise<DbResult<number>> {
  const deviceId = identity.deviceId?.trim() || undefined;
  const hashed = identity.ip ? await ipHash(identity.ip) : undefined;
  if (deviceId || hashed) {
    return countGenerationsFor({
      userIdIsNull: true,
      deviceId,
      ipHash: hashed,
      sinceUtc,
      scope: "any",
    });
  }
  return countGenerationsFor({
    userIdIsNull: true,
    deviceIdIsNull: true,
    ipHash: UNKNOWN_IP_HASH,
    sinceUtc,
    scope: "all",
  });
}

/**
 * Check the quota for the given identity.
 *
 * - Anonymous: counts generations today against freeAnonLimit() (default 5)
 * - Signed-in: checks credits from DB (1 credit per generation)
 * - On DB error: fails safe (authRequired = true)
 */
export async function checkQuota(identity: QuotaIdentity): Promise<QuotaResult> {
  const sinceUtc = startOfUtcDay();

  if (identity.userId) {
    const creditsResult = await getCredits(identity.userId);
    if (!creditsResult.ok) {
      return {
        used: 0,
        limit: 1,
        remaining: 0,
        authRequired: true,
        error: creditsResult.error,
      };
    }
    const credits = creditsResult.value;
    const used = credits > 0 ? 0 : 1;
    const limit = 1;
    const remaining = Math.max(0, credits);
    const authRequired = credits <= 0;
    return { used, limit, remaining, authRequired };
  }

  const anonResult = await countAnonymous(identity, sinceUtc);
  if (!anonResult.ok) {
    return {
      used: 0,
      limit: freeAnonLimit(),
      remaining: 0,
      authRequired: true,
      error: anonResult.error,
    };
  }

  const used = anonResult.value;
  const limit = freeAnonLimit();
  const remaining = Math.max(0, limit - used);
  const authRequired = used >= limit;
  return { used, limit, remaining, authRequired };
}

export interface GenerationRecord extends QuotaIdentity {
  presetId?: string;
  nakshatra?: string;
  focusAreas?: string[] | string;
}

/**
 * Record one generation. The row is never silently lost: `ip_hash` always
 * gets a non-empty value, and a database failure is logged.
 */
export async function recordGeneration(identity: GenerationRecord): Promise<void> {
  const result = await recordGenerationResult(identity);
  if (!result.ok) {
    console.warn(`[gogaji] generation could not be recorded: ${result.error}`);
  }
}

/** The typed result of `recordGeneration`, for callers that care. */
export async function recordGenerationResult(
  identity: GenerationRecord,
): Promise<DbResult<{ id: string }>> {
  const hashed = identity.ip ? await ipHash(identity.ip) : undefined;
  return insertGeneration({
    userId: identity.userId,
    deviceId: identity.deviceId,
    ipHash: hashed,
    presetId: identity.presetId,
    nakshatra: identity.nakshatra,
    focusAreas: identity.focusAreas,
  });
}

/**
 * Deduct 1 credit for a signed-in user's generation.
 * For anonymous users, this is a no-op (they use daily limit instead).
 */
export async function deductGenerationCredit(
  identity: GenerationRecord,
): Promise<{ ok: boolean; remaining: number; error?: string }> {
  if (!identity.userId) {
    return { ok: true, remaining: -1 };
  }
  const result = await deductCredits(identity.userId, 1);
  if (!result.ok) {
    return { ok: false, remaining: 0, error: result.error };
  }
  return { ok: true, remaining: result.value };
}

/**
 * The gate the paid path calls BEFORE touching a provider.
 *
 * Enforces quota: checks if the identity has remaining allowance.
 */
export async function enforceQuota(
  identity: QuotaIdentity,
): Promise<{ allowed: boolean; reason?: string; result: QuotaResult }> {
  const quotaResult = await checkQuota(identity);
  if (quotaResult.authRequired) {
    return {
      allowed: false,
      reason: 'Daily limit reached',
      result: quotaResult,
    };
  }
  return { allowed: true, result: quotaResult };
}
