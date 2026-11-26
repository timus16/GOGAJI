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
import { getRequest } from "@tanstack/react-start/server";
import {
  registerAccount,
  loginAccount,
  logoutAccount,
  quotaState,
  sessionState,
  upgradeAccount,
  type CredentialsInput,
  type AuthResponse,
  type LogoutResponse,
  type CheckQuotaInput,
  type CheckQuotaResponse,
  type SessionInput,
  type SessionResponse,
  type SetPremiumInput,
  type SetPremiumResponse,
} from "./auth-core.server";

/*
 * ------------------------------------------------------------ server functions
 */

export const registerAuth = createServerFn({ method: "POST" })
  .validator((d?: CredentialsInput): CredentialsInput => d ?? { email: "", password: "" })
  .handler(async ({ data }): Promise<AuthResponse> => {
    const request = getRequest();
    return registerAccount(data, request);
  });

export const loginAuth = createServerFn({ method: "POST" })
  .validator((d?: CredentialsInput): CredentialsInput => d ?? { email: "", password: "" })
  .handler(async ({ data }): Promise<AuthResponse> => {
    const request = getRequest();
    return loginAccount(data, request);
  });

export const logoutAuth = createServerFn({ method: "POST" })
  .handler(async (): Promise<LogoutResponse> => {
    const request = getRequest();
    return logoutAccount(request);
  });

export const checkQuota = createServerFn({ method: "POST" })
  .validator((d?: CheckQuotaInput): CheckQuotaInput => d ?? {})
  .handler(async ({ data }): Promise<CheckQuotaResponse> => {
    const request = getRequest();
    return quotaState(data, request);
  });

export const getSession = createServerFn({ method: "POST" })
  .validator((d?: SessionInput): SessionInput => d ?? {})
  .handler(async ({ data }): Promise<SessionResponse> => {
    const request = getRequest();
    return sessionState(data, request);
  });

export const setPremium = createServerFn({ method: "POST" })
  .validator((d?: SetPremiumInput): SetPremiumInput => d ?? {})
  .handler(async ({ data }): Promise<SetPremiumResponse> => {
    const request = getRequest();
    return upgradeAccount(data, request);
  });

// Re-export types and core functions for external use
export type {
  CredentialsInput,
  AuthResponse,
  LogoutResponse,
  CheckQuotaInput,
  CheckQuotaResponse,
  SessionInput,
  SessionResponse,
  SetPremiumInput,
  SetPremiumResponse,
};
export {
  registerAccount,
  loginAccount,
  logoutAccount,
  quotaState,
  sessionState,
  upgradeAccount,
  premiumStatusFor,
} from "./auth-core.server";
