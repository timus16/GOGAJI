import { createFileRoute } from "@tanstack/react-router";
import { quotaState, type CheckQuotaInput } from "~/server/api-auth.server";

export const Route = createFileRoute("/api/auth/quota")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const data: CheckQuotaInput = await request.json();
          const result = await quotaState(data, request);
          return new Response(JSON.stringify(result), {
            headers: { "Content-Type": "application/json" }
          });
        } catch (err) {
          return new Response(JSON.stringify({ 
            used: 0, limit: 0, remaining: 0, authRequired: true,
            error: "Quota check failed" 
          }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});
