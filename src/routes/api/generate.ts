import { createFileRoute } from "@tanstack/react-router";
import { buildWallpaperResponse, type WallpaperRequest } from "~/server/ai";
import { syncedEnv } from "~/server/env-sync";

export const Route = createFileRoute("/api/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const data = await request.json();
          const date = data.date || data.birthDate;
          const time = data.time || data.birthTime;
          const place = data.place || data.birthPlace;
          if (!data.name?.trim() || !date || !time || !place?.trim()) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
          }

          const payload: WallpaperRequest = {
            ...data,
            date,
            time,
            place,
            latitude: data.latitude || 28.6139,
            longitude: data.longitude || 77.2090,
            timezone: data.timezone || "Asia/Kolkata",
            presetId: data.presetId || "temple-gold",
            focusAreas: data.focusAreas || ["all"],
            regionalSystem: data.regionalSystem || "vedic",
            subject: data.subject || "child",
          };

          const response = await buildWallpaperResponse(payload, syncedEnv());

          return new Response(JSON.stringify(response), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("Generate API error:", err);
          return new Response(
            JSON.stringify({ error: "Generation failed: " + (err instanceof Error ? err.message : String(err)) }),
            { status: 500 }
          );
        }
      },
    },
  },
});
