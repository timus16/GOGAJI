import { createFileRoute } from "@tanstack/react-router";
import { registerAccount, type CredentialsInput } from "~/server/api-auth.server";

export const Route = createFileRoute("/api/auth/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const data: CredentialsInput = await request.json();
          const result = await registerAccount(data, request);
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (result.cookieHeader) {
            headers["Set-Cookie"] = result.cookieHeader;
          }
          return new Response(JSON.stringify(result), {
            status: result.ok ? 200 : 400,
            headers,
          });
        } catch (err) {
          console.error("Registration error:", err);
          return new Response(JSON.stringify({ ok: false, error: "Registration failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      },
    },
  },
});