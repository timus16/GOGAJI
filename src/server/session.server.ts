/**
 * Request-scoped session plumbing: the session cookie, the current identity,
 * and the per-IP abuse limiter.
 *
 * Everything here is defensive about the request context: the TanStack Start
 * server helpers (`getCookie`, `setCookie`, `getRequestIP`, ...) throw when
 * there is no request in flight, and these functions are also called from
 * scripts and tests. A missing request context degrades to "anonymous",
 * never to a crash.
 */

import {
  deleteCookie,
  getCookie,
  getRequestIP,
  getRequestProtocol,
  setCookie,
} from "@tanstack/react-start/server";
import { isProduction, SESSION_TTL_SECONDS, verifySession } from "./auth";

export const SESSION_COOKIE = "gogaji_session";
export const SESSION_COOKIE_MAX_AGE_S = SESSION_TTL_SECONDS;

/** Who is making the request. `userId` is set only for a valid session. */
export interface QuotaIdentity {
  userId?: string;
  deviceId?: string;
  ip?: string;
}

/** The client IP, when the runtime can read one. */
export function requestIp(): string | undefined {
  try {
    return getRequestIP({ xForwardedFor: true }) ?? undefined;
  } catch {
    return undefined;
  }
}

/** True when the request arrived over HTTPS (or the deployment is production). */
export function isSecureRequest(): boolean {
  if (isProduction()) return true;
  try {
    return getRequestProtocol({ xForwardedProto: true }) === "https";
  } catch {
    return false;
  }
}

export function sessionCookieOptions(): {
  path: string;
  httpOnly: boolean;
  sameSite: "lax";
  maxAge: number;
  secure: boolean;
} {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_COOKIE_MAX_AGE_S,
    secure: isSecureRequest(),
  };
}

/** Set the session cookie. The raw token is NEVER returned to the client. */
export function setSessionCookie(token: string): void {
  try {
    setCookie(SESSION_COOKIE, token, sessionCookieOptions());
  } catch {
    return;
  }
}

export function clearSessionCookie(): void {
  try {
    deleteCookie(SESSION_COOKIE, { path: "/" });
  } catch {
    return;
  }
}

/** The session token from the request cookie, or an explicit override. */
export function readSessionToken(explicit?: string): string | undefined {
  if (explicit && explicit.trim()) return explicit.trim();
  try {
    return getCookie(SESSION_COOKIE) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * The signed-in user id for this request, or null.
 *
 * `verifySession` throws when the deployment has no SESSION_SECRET in
 * production; that is caught here and treated as "not signed in", so the
 * request fails closed on privilege instead of erroring out.
 */
export async function currentUserId(explicitToken?: string): Promise<string | null> {
  const token = readSessionToken(explicitToken);
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

/** The identity used for quota accounting on the current request. */
export async function currentQuotaIdentity(deviceId?: string): Promise<QuotaIdentity> {
  const identity: QuotaIdentity = {};
  const userId = await currentUserId();
  if (userId) identity.userId = userId;
  if (deviceId && deviceId.trim()) identity.deviceId = deviceId.trim();
  const ip = requestIp();
  if (ip) identity.ip = ip;
  return identity;
}

/*
 * -------------------------------------------------------------- abuse limiter
 *
 * A fixed-window counter keyed by client IP, shared by register, login and the
 * premium activation code. The message is deliberately generic: it must not
 * tell an attacker whether an account exists.
 *
 * CAVEAT: the store is in-memory, so the limit is PER INSTANCE. Behind a load
 * balancer each instance keeps its own counters. A production deployment
 * should put a durable limiter (Redis/Upstash) in front of this.
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
 * Consume one attempt for `key`. Returns a generic error message when the
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
    return `Too many attempts. Please try again in about ${Math.ceil(retry / 60) || 1} minute(s).`;
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