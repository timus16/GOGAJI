/**
 * The account server functions.
 *
 * What this layer guarantees:
 *  - The raw session token is NEVER returned in a response body. It is set as
 *    an `httpOnly`, `sameSite=lax` cookie, and `secure` whenever the request
 *    is HTTPS or the deployment is production.
 *  - Errors are generic. A failed login says "invalid email or password"
 *    whether the address is unknown or the password is wrong, and a failed
 *    registration never says "email already registered".
 *  - Register, login and premium activation are rate limited per IP.
 *  - The plan is read from the DATABASE on every request, never from the
 *    session token, so a plan change takes effect immediately.
 */

import { createServerFn } from "@tanstack/react-start";
import { hashPassword, randomId, safeEqual, signSession, verifyPassword } from "./auth";
import {
  findUserByEmail,
  findUserById,
  insertUser,
  normalizePlan,
  setUserPlan,
  type Plan,
} from "./db";
import type { QuotaResult, QuotaIdentity } from "./quota";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 200;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;

const GENERIC_REGISTER_ERROR = "Could not create the account with those details.";
const GENERIC_LOGIN_ERROR = "Invalid email or password.";

export interface CredentialsInput {
  email: string;
  password: string;
}

export type AuthResponse =
  | { ok: true; email: string; plan: Plan }
  | { ok: false; error: string };

export interface LogoutResponse {
  ok: boolean;
  error?: string;
}

export interface CheckQuotaInput {
  deviceId?: string;
  session?: string;
}

export interface CheckQuotaResponse extends QuotaResult {
  loggedIn: boolean;
  email?: string;
}

export interface SessionInput {
  deviceId?: string;
  session?: string;
}

export interface SessionResponse {
  loggedIn: boolean;
  email?: string;
  plan: Plan;
  isPremium: boolean;
  quota: QuotaResult;
  error?: string;
}

export interface SetPremiumInput {
  code?: string;
  session?: string;
}

export type SetPremiumResponse =
  | { ok: true; plan: Plan; email: string }
  | { ok: false; error: string };

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizePassword(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** The abuse-limiter bucket for this request. */
async function attemptKey(): Promise<string> {
  const sessionMod = await import("./session.server");
  return sessionMod.requestIp() ?? "unknown";
}

let dummyHash: Promise<string> | null = null;

/**
 * Burn the same time a real password check would, so a missing account is
 * indistinguishable from a wrong password.
 */
async function equalizeTiming(password: string): Promise<void> {
  if (!dummyHash) dummyHash = hashPassword("gogaji-timing-equaliser");
  try {
    await verifyPassword(password, await dummyHash);
  } catch {
    return;
  }
}

/**
 * The premium entitlement of one account.
 *
 * This is the single place the plan is read for a FEATURE decision (today:
 * bring-your-own AI keys), so the rule "premium means premium" is written once
 * and reused by the account layer and the AI path alike. It is a plain
 * (non-server-function) export, so it can be called from another server module
 * without a circular import and without a request context.
 *
 * It FAILS CLOSED: an unknown user id, a missing row or a database error all
 * read as the free plan, so a broken lookup can never hand out a premium
 * feature. The plan is read from the DATABASE on every call (never from the
 * session token), so a plan change takes effect immediately.
 */
export async function premiumStatusFor(
  userId: string | null,
): Promise<{ isPremium: boolean; plan: Plan }> {
  if (!userId || !userId.trim()) return { isPremium: false, plan: "free" };
  try {
    const row = await findUserById(userId);
    if (!row.ok) {
      console.warn(`[gogaji] plan lookup failed: ${row.error}`);
      return { isPremium: false, plan: "free" };
    }
    if (!row.value) return { isPremium: false, plan: "free" };
    const plan = normalizePlan(row.value.plan);
    return { isPremium: plan === "premium", plan };
  } catch (err) {
    console.warn(`[gogaji] plan lookup failed: ${errorMessage(err)}`);
    return { isPremium: false, plan: "free" };
  }
}

/*
 * --------------------------------------------------------------- the handlers
 *
 * Each handler is a plain exported function so it can be exercised directly
 * (a server function can only run inside an HTTP request). The server
 * functions below are thin wrappers around them.
 */

export async function registerAccount(input?: CredentialsInput): Promise<AuthResponse> {
  const sessionMod = await import("./session.server");
  const quotaMod = await import("./quota");
  const limited = sessionMod.consumeAuthAttempt(await attemptKey());
  if (limited) return { ok: false, error: limited };
  const email = normalizeEmail(input?.email);
  const password = normalizePassword(input?.password);
  if (!EMAIL_RE.test(email) || email.length > MAX_EMAIL_LENGTH) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`,
    };
  }
  const existing = await findUserByEmail(email);
  if (!existing.ok) {
    console.warn(`[gogaji] register lookup failed: ${existing.error}`);
    return { ok: false, error: GENERIC_REGISTER_ERROR };
  }
  if (existing.value) {
    return { ok: false, error: GENERIC_REGISTER_ERROR };
  }
  const id = randomId();
  const passwordHash = await hashPassword(password);
  const inserted = await insertUser({ id, email, password_hash: passwordHash });
  if (!inserted.ok) {
    console.warn(`[gogaji] register insert failed: ${inserted.error}`);
    return { ok: false, error: GENERIC_REGISTER_ERROR };
  }
  try {
    const token = await signSession(id);
    sessionMod.setSessionCookie(token);
  } catch (err) {
    console.warn(`[gogaji] session could not be issued: ${errorMessage(err)}`);
    return { ok: false, error: "The account was created but the session could not be started." };
  }
  return { ok: true, email, plan: "free" };
}

export async function loginAccount(input?: CredentialsInput): Promise<AuthResponse> {
  const sessionMod = await import("./session.server");
  const quotaMod = await import("./quota");
  const limited = sessionMod.consumeAuthAttempt(await attemptKey());
  if (limited) return { ok: false, error: limited };
  const email = normalizeEmail(input?.email);
  const password = normalizePassword(input?.password);
  if (!email || !password || email.length > MAX_EMAIL_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }
  const found = await findUserByEmail(email);
  if (!found.ok) {
    console.warn(`[gogaji] login lookup failed: ${found.error}`);
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }
  const user = found.value;
  if (!user) {
    await equalizeTiming(password);
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return { ok: false, error: GENERIC_LOGIN_ERROR };
  try {
    const token = await signSession(user.id);
    sessionMod.setSessionCookie(token);
  } catch (err) {
    console.warn(`[gogaji] session could not be issued: ${errorMessage(err)}`);
    return { ok: false, error: "The session could not be started. Please try again." };
  }
  return { ok: true, email: user.email, plan: user.plan };
}

export async function logoutAccount(): Promise<LogoutResponse> {
  const sessionMod = await import("./session.server");
  sessionMod.clearSessionCookie();
  return { ok: true };
}

export async function quotaState(input?: CheckQuotaInput): Promise<CheckQuotaResponse> {
  const sessionMod = await import("./session.server");
  const quotaMod = await import("./quota");
  const userId = await sessionMod.currentUserId(input?.session);
  const identity: QuotaIdentity = {};
  if (userId) identity.userId = userId;
  const deviceId = input?.deviceId?.trim();
  if (deviceId) identity.deviceId = deviceId;
  const ip = sessionMod.requestIp();
  if (ip) identity.ip = ip;
  const result = await quotaMod.checkQuota(identity);
  let email: string | undefined;
  if (userId) {
    const row = await findUserById(userId);
    if (row.ok && row.value) email = row.value.email;
  }
  return {
    ...result,
    loggedIn: userId !== null,
    ...(email ? { email } : {}),
  };
}

export async function sessionState(input?: SessionInput): Promise<SessionResponse> {
  const sessionMod = await import("./session.server");
  const quotaMod = await import("./quota");
  const userId = await sessionMod.currentUserId(input?.session);
  let email: string | undefined;
  let plan: Plan = "free";
  let error: string | undefined;
  if (userId) {
    const row = await findUserById(userId);
    if (!row.ok) {
      console.warn(`[gogaji] session lookup failed: ${row.error}`);
      error = "The account could not be loaded.";
    } else if (!row.value) {
      error = "The account could not be loaded.";
    } else {
      email = row.value.email;
      plan = row.value.plan;
    }
  }
  const identity: QuotaIdentity = {};
  if (userId) identity.userId = userId;
  const deviceId = input?.deviceId?.trim();
  if (deviceId) identity.deviceId = deviceId;
  const ip = sessionMod.requestIp();
  if (ip) identity.ip = ip;
  const quotaResult = await quotaMod.checkQuota(identity);
  return {
    loggedIn: Boolean(userId && email),
    email,
    plan,
    isPremium: plan === "premium",
    quota: quotaResult,
    error,
  };
}

/**
 * Flip the signed-in account to the premium plan.
 *
 * There is no payment provider yet, so the entitlement is checked against the
 * `PREMIUM_BYPASS_CODE` server secret. When that variable is not set the call
 * is refused outright. A payment webhook is expected to replace this function
 * and to set the plan server-side, without a client-supplied code.
 */
export async function upgradeAccount(input?: SetPremiumInput): Promise<SetPremiumResponse> {
  const sessionMod = await import("./session.server");
  const quotaMod = await import("./quota");
  const limited = sessionMod.consumeAuthAttempt(await attemptKey());
  if (limited) return { ok: false, error: limited };
  const userId = await sessionMod.currentUserId(input?.session);
  if (!userId) return { ok: false, error: "Sign in before upgrading." };
  const expected = process.env.PREMIUM_BYPASS_CODE?.trim();
  if (!expected) {
    return { ok: false, error: "Premium activation is not enabled on this deployment yet." };
  }
  const provided = typeof input?.code === "string" ? input.code.trim() : "";
  if (!provided || !safeEqual(provided, expected)) {
    return { ok: false, error: "That activation code is not valid." };
  }
  const row = await findUserById(userId);
  if (!row.ok || !row.value) {
    return { ok: false, error: "The account could not be loaded." };
  }
  const updated = await setUserPlan(userId, "premium");
  if (!updated.ok) {
    console.warn(`[gogaji] plan update failed: ${updated.error}`);
    return { ok: false, error: "The account could not be upgraded." };
  }
  return { ok: true, plan: updated.value, email: row.value.email };
}

/*
 * ------------------------------------------------------------ server functions
 */

export const registerAuth = createServerFn({ method: "POST" })
  .validator((d?: CredentialsInput): CredentialsInput => d ?? { email: "", password: "" })
  .handler(async ({ data }): Promise<AuthResponse> => registerAccount(data));

export const loginAuth = createServerFn({ method: "POST" })
  .validator((d?: CredentialsInput): CredentialsInput => d ?? { email: "", password: "" })
  .handler(async ({ data }): Promise<AuthResponse> => loginAccount(data));

export const logoutAuth = createServerFn({ method: "POST" })
  .handler(async (): Promise<LogoutResponse> => logoutAccount());

export const checkQuota = createServerFn({ method: "POST" })
  .validator((d?: CheckQuotaInput): CheckQuotaInput => d ?? {})
  .handler(async ({ data }): Promise<CheckQuotaResponse> => quotaState(data));

export const getSession = createServerFn({ method: "POST" })
  .validator((d?: SessionInput): SessionInput => d ?? {})
  .handler(async ({ data }): Promise<SessionResponse> => sessionState(data));

export const setPremium = createServerFn({ method: "POST" })
  .validator((d?: SetPremiumInput): SetPremiumInput => d ?? {})
  .handler(async ({ data }): Promise<SetPremiumResponse> => upgradeAccount(data));
