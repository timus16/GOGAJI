import { createFileRoute } from "@tanstack/react-router";
import { logoutAccount } from "~/server/api-auth.server";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const result = await logoutAccount(request);
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (result.cookieHeader) {
            headers["Set-Cookie"] = result.cookieHeader;
          }
          return new Response(JSON.stringify(result), {
            headers,
          });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: "Logout failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      },
    },
  },
});
