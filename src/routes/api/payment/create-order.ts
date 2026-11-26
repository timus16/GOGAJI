import { createFileRoute } from "@tanstack/react-router";
import Razorpay from "razorpay";
import { readSessionToken, currentUserId } from "~/server/session-helpers";
import { findUserById, insertUser } from "~/server/db";
import { randomId } from "~/server/auth";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID?.trim();
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET?.trim();

function getRazorpayInstance(): Razorpay | null {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.warn("[payment] Razorpay credentials not configured");
    return null;
  }
  return new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
}

interface CreateOrderRequest {
  wallpaperData: {
    chartSummary: unknown;
    conditions: unknown;
    reading: unknown;
    wallpaperPrompt: string;
    image?: { dataUrl: string; mime: string; width: number; height: number };
    presetId?: string;
    focusAreas?: string[];
  };
  deviceId?: string;
}

interface CreateOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  wallpaperToken: string;
}

export const Route = createFileRoute("/api/payment/create-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const razorpay = getRazorpayInstance();
          if (!razorpay) {
            return new Response(
              JSON.stringify({ error: "Payment service not configured" }),
              { status: 503, headers: { "Content-Type": "application/json" } }
            );
          }

          const body: CreateOrderRequest = await request.json();
          if (!body.wallpaperData?.wallpaperPrompt) {
            return new Response(
              JSON.stringify({ error: "Invalid wallpaper data" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          const token = readSessionToken(request);
          let userId = token ? await currentUserId(request, token) : null;

          if (!userId) {
            const email = `guest_${randomId().slice(0, 8)}@gogaji.local`;
            const passwordHash = await import("~/server/auth").then((m) =>
              m.hashPassword(randomId())
            );
            const insertResult = await insertUser({
              id: randomId(),
              email,
              password_hash: passwordHash,
            });
            if (insertResult.ok) {
              userId = insertResult.value.id;
            }
          }

          if (!userId) {
            return new Response(
              JSON.stringify({ error: "Could not create user session" }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }

          const wallpaperToken = randomId();
          const wallpaperRecord = {
            id: wallpaperToken,
            user_id: userId,
            device_id: body.deviceId?.trim() || null,
            ip_hash: "payment_pending",
            preset_id: body.wallpaperData.presetId?.trim() || null,
            nakshatra: null,
            focus_areas: Array.isArray(body.wallpaperData.focusAreas)
              ? body.wallpaperData.focusAreas.join(",")
              : body.wallpaperData.focusAreas?.trim() || null,
            chart_summary: JSON.stringify(body.wallpaperData.chartSummary),
            conditions: JSON.stringify(body.wallpaperData.conditions),
            reading: JSON.stringify(body.wallpaperData.reading),
            wallpaper_prompt: body.wallpaperData.wallpaperPrompt,
            image_data: body.wallpaperData.image
              ? JSON.stringify(body.wallpaperData.image)
              : null,
            status: "pending_payment",
            created_at: new Date().toISOString(),
          };

          try {
            const { sql } = await import("~/db");
            const runner = (await sql()) as unknown as {
              query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
            };
            await runner.query(
              `INSERT INTO wallpapers (id, user_id, device_id, ip_hash, preset_id, nakshatra, focus_areas, chart_summary, conditions, reading, wallpaper_prompt, image_data, status, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
              [
                wallpaperRecord.id,
                wallpaperRecord.user_id,
                wallpaperRecord.device_id,
                wallpaperRecord.ip_hash,
                wallpaperRecord.preset_id,
                wallpaperRecord.nakshatra,
                wallpaperRecord.focus_areas,
                wallpaperRecord.chart_summary,
                wallpaperRecord.conditions,
                wallpaperRecord.reading,
                wallpaperRecord.wallpaper_prompt,
                wallpaperRecord.image_data,
                wallpaperRecord.status,
                wallpaperRecord.created_at,
              ]
            );
          } catch (err) {
            console.error("[payment] Failed to store wallpaper:", err);
          }

          const amount = 9900;
          const order = await razorpay.orders.create({
            amount,
            currency: "INR",
            receipt: `wallpaper_${wallpaperToken}`,
            notes: {
              wallpaper_token: wallpaperToken,
              user_id: userId,
            },
          });

          const response: CreateOrderResponse = {
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: RAZORPAY_KEY_ID,
            wallpaperToken,
          };

          return new Response(JSON.stringify(response), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("[payment] Create order error:", err);
          return new Response(
            JSON.stringify({ error: "Failed to create payment order" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
