/**
 * Unified session helpers that work in both TanStack Start server functions
 * and Cloudflare Workers. Delegates to the appropriate implementation.
 */

import type { QuotaIdentity } from "./session-utils.server";
import { 
  authAttemptLimit as authAttemptLimitFn, 
  authAttemptWindowMs as authAttemptWindowMsFn 
} from "./session-utils.server";
import {
  requestIp as requestIpWorker,
  currentUserId as currentUserIdWorker,
  currentQuotaIdentity as currentQuotaIdentityWorker,
  setSessionCookie as setSessionCookieWorker,
  clearSessionCookie as clearSessionCookieWorker,
  consumeAuthAttempt as consumeAuthAttemptWorker,
  readSessionToken as readSessionTokenWorker,
  authAttemptLimit as authAttemptLimitWorker,
  authAttemptWindowMs as authAttemptWindowMsWorker,
} from "./session-worker";

let sessionMod: typeof import("./session-utils.server") | null = null;

async function loadSession(): Promise<typeof import("./session-utils.server")> {
  if (!sessionMod) {
    sessionMod = await import("./session-utils.server");
  }
  return sessionMod;
}

/** Detect if we're in a Cloudflare Worker environment */
function isCloudflareWorker(): boolean {
  return typeof globalThis !== "undefined" && 
         typeof (globalThis as any).caches !== "undefined" &&
         typeof (globalThis as any).fetch === "function";
}

export async function requestIp(request?: Request): Promise<string | undefined> {
  if (isCloudflareWorker() && request) {
    return requestIpWorker(request);
  }
  const mod = await loadSession();
  return mod.requestIp(request);
}

export async function currentUserId(request?: Request, explicitToken?: string): Promise<string | null> {
  if (isCloudflareWorker() && request) {
    return currentUserIdWorker(request, explicitToken);
  }
  const mod = await loadSession();
  return mod.currentUserId(request, explicitToken);
}

export async function currentQuotaIdentity(request?: Request, deviceId?: string): Promise<QuotaIdentity> {
  if (isCloudflareWorker() && request) {
    return currentQuotaIdentityWorker(request, deviceId);
  }
  const mod = await loadSession();
  return mod.currentQuotaIdentity(request, deviceId);
}

export async function setSessionCookie(token: string, request?: Request): Promise<string | void> {
  if (isCloudflareWorker() && request) {
    return setSessionCookieWorker(token, request);
  }
  const mod = await loadSession();
  return mod.setSessionCookie(token, request);
}

export async function clearSessionCookie(request?: Request): Promise<string | void> {
  if (isCloudflareWorker() && request) {
    return clearSessionCookieWorker(request);
  }
  const mod = await loadSession();
  return mod.clearSessionCookie(request);
}

export async function consumeAuthAttempt(key: string, request?: Request): Promise<string | undefined> {
  if (isCloudflareWorker() && request) {
    return consumeAuthAttemptWorker(key, request);
  }
  const mod = await loadSession();
  return mod.consumeAuthAttempt(key, request);
}

export async function readSessionToken(request?: Request, explicit?: string): Promise<string | undefined> {
  if (isCloudflareWorker() && request) {
    return readSessionTokenWorker(request, explicit);
  }
  const mod = await loadSession();
  return mod.readSessionToken(request, explicit);
}

export function authAttemptLimit(): number {
  return authAttemptLimitWorker();
}

export function authAttemptWindowMs(): number {
  return authAttemptWindowMsWorker();
}
