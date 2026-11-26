/**
 * Cloudflare Worker session utilities - pure Web APIs, no TanStack Start dependencies.
 * Works with standard Request/Response objects and Cloudflare Workers headers.
 */

import { 
  
  
  isProduction, 
  
  hmacHexWith, 
  ipHashSecret, 
  safeEqual,
  SESSION_TTL_SECONDS 
} from "./auth";
import type { QuotaIdentity } from "./session-utils.server";

export const SESSION_COOKIE = "gogaji_session";
export const SESSION_COOKIE_MAX_AGE_S = SESSION_TTL_SECONDS;

/** The client IP, when the runtime can read one. */
export function requestIp(request: Request): string | undefined {
  // Cloudflare Workers provides CF-Connecting-IP header
  const cfIp = request.headers.get("CF-Connecting-IP");
  if (cfIp) return cfIp;
  
  // Fallback to X-Forwarded-For
  const forwardedFor = request.headers.get("X-Forwarded-For");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return undefined;
}

/** True when the request arrived over HTTPS (or the deployment is production). */
export function isSecureRequest(request: Request): boolean {
  if (isProduction()) return true;
  const proto = request.headers.get("X-Forwarded-Proto");
  return proto === "https";
}

export function sessionCookieOptions(request: Request): {
  path: string;
  httpOnly: boolean;
  sameSite: "lax";
  maxAge: number;
  secure: boolean;
} {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: SESSION_COOKIE_MAX_AGE_S,
    secure: isSecureRequest(request),
  };
}

/** Get the session cookie header value. The raw token is NEVER returned to the client. */
export function setSessionCookie(token: string, request: Request): string {
  const options = sessionCookieOptions(request);
  return SESSION_COOKIE + "=" + token +
    "; Path=" + options.path +
    "; HttpOnly" +
    "; SameSite=" + options.sameSite +
    "; Max-Age=" + options.maxAge +
    (options.secure ? "; Secure" : "");
}

export function clearSessionCookie(request: Request): string {
  return SESSION_COOKIE + "=; Path=/; HttpOnly; SameSite=lax; Max-Age=0";
}

/** The session token from the request cookie, or an explicit override. */
export function readSessionToken(request: Request, explicit?: string): string | undefined {
  if (explicit && explicit.trim()) return explicit.trim();
  try {
    const cookieHeader = request.headers.get("Cookie");
    if (!cookieHeader) return undefined;
    const cookies = cookieHeader.split(";").map(c => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith(SESSION_COOKIE + "=")) {
        return cookie.substring(SESSION_COOKIE.length + 1);
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * The signed-in user id for this request, or null.
 */
export async function currentUserId(request: Request, explicitToken?: string): Promise<string | null> {
  const token = readSessionToken(request, explicitToken);
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

/** The identity used for quota accounting on the current request. */
export async function currentQuotaIdentity(request: Request, deviceId?: string): Promise<QuotaIdentity> {
  const identity: QuotaIdentity = {};
  const userId = await currentUserId(request);
  if (userId) identity.userId = userId;
  if (deviceId && deviceId.trim()) identity.deviceId = deviceId.trim();
  const ip = requestIp(request);
  if (ip) identity.ip = ip;
  return identity;
}

/*
 * -------------------------------------------------------------- abuse limiter
 */
const ATTEMPT_LIMIT_DEFAULT = 10;
const ATTEMPT_WINDOW_MS_DEFAULT = 15 * 60_000;

export function authAttemptLimit(): number {
  const raw = process.env.AUTH_ATTEMPT_LIMIT;
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : ATTEMPT_LIMIT_DEFAULT;
}

export function authAttemptWindowMs(): number {
  const raw = process.env.AUTH_ATTEMPT_WINDOW_MS;
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : ATTEMPT_WINDOW_MS_DEFAULT;
}

interface AttemptWindow {
  count: number;
  resetAt: number;
}

const attemptWindows = new Map<string, AttemptWindow>();

/**
 * Consume one attempt for key. Returns a generic error message when the
 * window is exhausted, or undefined when the attempt may proceed.
 */
export function consumeAuthAttempt(key: string): string | undefined {
  const limit = authAttemptLimit();
  const windowMs = authAttemptWindowMs();
  const now = Date.now();
  const bucket = key.trim() || "unknown";
  let win = attemptWindows.get(bucket);
  if (!win || now >= win.resetAt) {
    win = { count: 0, resetAt: now + windowMs };
    attemptWindows.set(bucket, win);
  }
  win.count += 1;
  if (win.count > limit) {
    const retry = Math.max(1, Math.ceil((win.resetAt - now) / 1000));
    return "Too many attempts. Please try again in about " + Math.ceil(retry / 60) + " minute(s).";
  }
  if (attemptWindows.size > 5000) {
    for (const [k, w] of attemptWindows) if (now >= w.resetAt) attemptWindows.delete(k);
  }
  return undefined;
}

/** Clear the attempt counters (tests only). */
export function resetAuthAttempts(): void {
  attemptWindows.clear();
}
