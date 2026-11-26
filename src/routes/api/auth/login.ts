import { createFileRoute } from "@tanstack/react-router";
import { loginAccount, type CredentialsInput } from "~/server/api-auth.server";

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const data: CredentialsInput = await request.json();
          const result = await loginAccount(data, request);
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (result.cookieHeader) {
            headers["Set-Cookie"] = result.cookieHeader;
          }
          return new Response(JSON.stringify(result), {
            status: result.ok ? 200 : 400,
            headers,
          });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: "Login failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      },
    },
  },
});
