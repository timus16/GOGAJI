import { createFileRoute } from "@tanstack/react-router";
import { upgradeAccount, type SetPremiumInput } from "~/server/api-auth.server";

export const Route = createFileRoute("/api/auth/premium")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const data: SetPremiumInput = await request.json();
          const result = await upgradeAccount(data, request);
          return new Response(JSON.stringify(result), {
            status: result.ok ? 200 : 400,
            headers: { "Content-Type": "application/json" }
          });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: "Premium activation failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      },
    },
  },
});
