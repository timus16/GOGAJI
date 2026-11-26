import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export interface User {
  id: string;
  email: string;
  plan: "free" | "premium";
  credits: number;
  created_at: string;
}

interface SessionInput {
  token?: string;
}

interface SessionResponse {
  loggedIn?: boolean;
  isPremium?: boolean;
  email?: string;
  ok: boolean;
  user?: User;
  quota?: any;
  error?: string;
}

export const getSession = createServerFn({ method: "POST" })
  .validator((d?: SessionInput): SessionInput => d ?? {})
  .handler(async ({ data }): Promise<SessionResponse> => {
    const request = getRequest();
    const { sessionState } = await import("../server/auth-core.server");
    return sessionState(data, request);
  });
