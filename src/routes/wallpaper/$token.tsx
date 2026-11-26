import { createFileRoute } from "@tanstack/react-router";
import { readSessionToken, currentUserId } from "~/server/session-helpers";

export const Route = createFileRoute("/wallpaper/$token")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const token = params.token;
          if (!token) {
            return new Response(JSON.stringify({ error: "Missing wallpaper token" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const sessionToken = readSessionToken(request);
          const userId = sessionToken ? await currentUserId(request, sessionToken) : null;

          if (!userId) {
            return new Response(JSON.stringify({ error: "Authentication required" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { sql } = await import("~/db");
          const runner = (await sql()) as unknown as {
            query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
          };

          const rows = await runner.query(
            `SELECT id, user_id, wallpaper_prompt, image_data, status, preset_id, focus_areas, chart_summary, conditions, reading, created_at
             FROM wallpapers WHERE id = $1 AND user_id = $2`,
            [token, userId]
          );

          if (rows.length === 0) {
            return new Response(JSON.stringify({ error: "Wallpaper not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          const wallpaper = rows[0];

          if (wallpaper.status !== "paid") {
            return new Response(JSON.stringify({ error: "Wallpaper not purchased" }), {
              status: 403,
              headers: { "Content-Type": "application/json" },
            });
          }

          const imageData = wallpaper.image_data ? JSON.parse(wallpaper.image_data as string) : null;

          return new Response(
            JSON.stringify({
              id: wallpaper.id,
              wallpaperPrompt: wallpaper.wallpaper_prompt,
              image: imageData,
              presetId: wallpaper.preset_id,
              focusAreas: wallpaper.focus_areas ? (wallpaper.focus_areas as string).split(",") : [],
              chartSummary: wallpaper.chart_summary ? JSON.parse(wallpaper.chart_summary as string) : null,
              conditions: wallpaper.conditions ? JSON.parse(wallpaper.conditions as string) : null,
              reading: wallpaper.reading ? JSON.parse(wallpaper.reading as string) : null,
              createdAt: wallpaper.created_at,
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        } catch (err) {
          console.error("[wallpaper] Download error:", err);
          return new Response(
            JSON.stringify({ error: "Failed to retrieve wallpaper" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
