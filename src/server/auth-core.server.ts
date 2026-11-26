import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { hashPassword, verifyPassword, signSession, verifySession, randomId } from "./auth";
import {
  findUserByEmail,
  findUserById,
  insertUser,
  setUserPlan,
  type UserRow,
  type DbResult,
} from "./db";
import {
  checkQuota,
  currentQuotaIdentity,
  type QuotaIdentity,
  type QuotaResult,
} from "./quota.server";
import {
  readSessionToken,
  currentUserId,
  setSessionCookie,
  clearSessionCookie,
  requestIp,
  consumeAuthAttempt,
  authAttemptLimit,
  authAttemptWindowMs,
} from "./session-helpers";
import { isProduction } from "./auth";

export type Plan = "free" | "premium";

export interface CredentialsInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  ok: boolean;
  error?: string;
  cookieHeader?: string;
}

export interface LogoutResponse {
  ok: boolean;
  error?: string;
  cookieHeader?: string;
}

export interface CheckQuotaInput {
  userId?: string;
}

export interface CheckQuotaResponse extends QuotaResult {}

export interface SessionInput {
  token?: string;
}

export interface SessionResponse {
  loggedIn?: boolean;
  isPremium?: boolean;
  email?: string;
  ok: boolean;
  user?: {
    id: string;
    email: string;
    plan: Plan;
    credits: number;
    created_at: string;
  };
  quota?: QuotaResult;
  error?: string;
}

export interface SetPremiumInput {
  code: string;
}

export interface SetPremiumResponse {
  ok: boolean;
  error?: string;
}

function getRequestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return "unknown";
}

async function rateLimitCheck(key: string, request: Request): Promise<string | undefined> {
  const ip = getRequestIp(request);
  const rateKey = `${key}:${ip}`;
  return consumeAuthAttempt(rateKey, request);
}

export async function registerAccount(
  data: CredentialsInput,
  request: Request,
): Promise<AuthResponse> {
  const email = data?.email?.trim().toLowerCase();
  const password = data?.password;

  if (!email || !password) {
    return { ok: false, error: "Email and password are required" };
  }

  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }

  const rateError = await rateLimitCheck("register", request);
  if (rateError) {
    return { ok: false, error: rateError };
  }

  const existing = await findUserByEmail(email);
  if (existing.ok && existing.value) {
    return { ok: false, error: "Invalid email or password" };
  }

  let passwordHash: string;
  try {
    passwordHash = await hashPassword(password);
  } catch (err) {
    console.error("Hash error:", err);
    return { ok: false, error: "Hash failed: " + String(err) };
  }

  const userId = randomId();

  let insertResult;
  try {
    insertResult = await insertUser({
      id: userId,
      email,
      password_hash: passwordHash,
    });
  } catch (err) {
    console.error("Insert error:", err);
    return { ok: false, error: "Insert failed: " + String(err) };
  }

  if (!insertResult.ok) {
    if (insertResult.code === "conflict") {
      return { ok: false, error: "Invalid email or password" };
    }
    return { ok: false, error: "Registration failed: " + insertResult.error };
  }

  try {
    const token = await signSession(userId);
    const cookieHeader = await setSessionCookie(token, request);
    return { ok: true, cookieHeader: typeof cookieHeader === "string" ? cookieHeader : undefined };
  } catch (err) {
    console.error("Session error:", err);
    return { ok: false, error: "Session failed: " + String(err) };
  }
}

export async function loginAccount(
  data: CredentialsInput,
  request: Request,
): Promise<AuthResponse> {
  const email = data?.email?.trim().toLowerCase();
  const password = data?.password;

  if (!email || !password) {
    return { ok: false, error: "Invalid email or password" };
  }

  const rateError = await rateLimitCheck("login", request);
  if (rateError) {
    return { ok: false, error: rateError };
  }

  const userResult = await findUserByEmail(email);
  if (!userResult.ok || !userResult.value) {
    return { ok: false, error: "Invalid email or password" };
  }

  const user = userResult.value;
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return { ok: false, error: "Invalid email or password" };
  }

  const token = await signSession(user.id);
  const cookieHeader = await setSessionCookie(token, request);
  return { ok: true, cookieHeader: typeof cookieHeader === "string" ? cookieHeader : undefined };
}

export async function logoutAccount(request: Request): Promise<LogoutResponse> {
  const cookieHeader = await clearSessionCookie(request);
  return { ok: true, cookieHeader: typeof cookieHeader === "string" ? cookieHeader : undefined };
}

export async function quotaState(
  _input: CheckQuotaInput,
  request: Request,
): Promise<CheckQuotaResponse> {
  const identity = await currentQuotaIdentity(request);
  return checkQuota(identity);
}

export async function sessionState(
  input: SessionInput,
  request: Request,
): Promise<SessionResponse> {
  try {
    const token = input.token ?? (await readSessionToken(request));
    if (!token) {
      return { ok: false, error: "Not authenticated" };
    }

    const userId = await verifySession(token);
    if (!userId) {
      return { ok: false, error: "Not authenticated" };
    }

    const userResult = await findUserById(userId);
    if (!userResult.ok || !userResult.value) {
      return { ok: false, error: "User not found: " + (userResult.error || "unknown") };
    }

    const user = userResult.value;
    const identity = await currentQuotaIdentity(request);
    const quotaResult = await checkQuota(identity);

    return {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        plan: user.plan,
        credits: user.credits,
        created_at: user.created_at,
      },
      quota: quotaResult,
    };
  } catch (e) {
    console.error("sessionState error:", e);
    console.error("sessionState stack:", e instanceof Error ? e.stack : String(e));
    return { ok: false, error: "Session error: " + (e instanceof Error ? e.message : String(e)) };
  }
}

export async function upgradeAccount(
  input: SetPremiumInput,
  request: Request,
): Promise<SetPremiumResponse> {
  const code = input.code?.trim();
  const bypassCode = process.env.PREMIUM_BYPASS_CODE?.trim();

  if (!code || !bypassCode || code !== bypassCode) {
    const rateError = await rateLimitCheck("premium", request);
    if (rateError) {
      return { ok: false, error: rateError };
    }
    return { ok: false, error: "Invalid premium code" };
  }

  const token = await readSessionToken(request);
  if (!token) {
    return { ok: false, error: "Not authenticated" };
  }

  const userId = await verifySession(token);
  if (!userId) {
    return { ok: false, error: "Not authenticated" };
  }

  const result = await setUserPlan(userId, "premium");
  if (!result.ok) {
    return { ok: false, error: "Failed to upgrade account" };
  }

  return { ok: true };
}

export async function premiumStatusFor(userId: string): Promise<Plan> {
  const userResult = await findUserById(userId);
  if (!userResult.ok || !userResult.value) {
    return "free";
  }
  return userResult.value.plan;
}

