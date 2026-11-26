import { createFileRoute } from "@tanstack/react-router";
import { sessionState, type SessionInput } from "~/server/api-auth.server";

export const Route = createFileRoute("/api/auth/session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const data: SessionInput = await request.json();
          const result = await sessionState(data, request);
          return new Response(JSON.stringify(result), {
            headers: { "Content-Type": "application/json" }
          });
        } catch (err) {
          return new Response(JSON.stringify({ 
            loggedIn: false, plan: "free", isPremium: false, 
            quota: { used: 0, limit: 0, remaining: 0, authRequired: true },
            error: "Session check failed" 
          }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});