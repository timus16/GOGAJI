import { createFileRoute } from "@tanstack/react-router";
import { readSessionToken, currentUserId, setSessionCookie } from "~/server/session-helpers";
import { findUserById, insertUser } from "~/server/db";
import { randomId, hashPassword, signSession } from "~/server/auth";
import crypto from "crypto";

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET?.trim();

interface VerifyRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  wallpaperToken: string;
}

interface VerifyResponse {
  success: boolean;
  wallpaperUrl?: string;
  error?: string;
}

function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export const Route = createFileRoute("/api/payment/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          if (!RAZORPAY_KEY_SECRET) {
            return new Response(
              JSON.stringify({ error: "Payment service not configured" }),
              { status: 503, headers: { "Content-Type": "application/json" } }
            );
          }

          const body: VerifyRequest = await request.json();
          if (!body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature || !body.wallpaperToken) {
            return new Response(
              JSON.stringify({ error: "Missing required payment verification fields" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          const isValid = verifySignature(
            body.razorpay_order_id,
            body.razorpay_payment_id,
            body.razorpay_signature,
            RAZORPAY_KEY_SECRET
          );

          if (!isValid) {
            return new Response(
              JSON.stringify({ success: false, error: "Invalid payment signature" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          const token = readSessionToken(request);
          let userId = token ? await currentUserId(request, token) : null;

          if (!userId) {
            const { sql } = await import("~/db");
            const runner = (await sql()) as unknown as {
              query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
            };
            const wallpaperRows = await runner.query(
              "SELECT user_id FROM wallpapers WHERE id = $1 LIMIT 1",
              [body.wallpaperToken]
            );
            if (wallpaperRows.length > 0) {
              userId = wallpaperRows[0].user_id as string;
            }
          }

          if (!userId) {
            return new Response(
              JSON.stringify({ success: false, error: "Could not identify user" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          try {
            const { sql } = await import("~/db");
            const runner = (await sql()) as unknown as {
              query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
            };
            await runner.query(
              `UPDATE wallpapers 
               SET status = $1, razorpay_order_id = $2, razorpay_payment_id = $3, paid_at = $4
               WHERE id = $5 AND user_id = $6`,
              [
                "paid",
                body.razorpay_order_id,
                body.razorpay_payment_id,
                new Date().toISOString(),
                body.wallpaperToken,
                userId,
              ]
            );
          } catch (err) {
            console.error("[payment] Failed to update wallpaper status:", err);
          }

          const sessionToken = await signSession(userId);
          await setSessionCookie(sessionToken, request);

          const wallpaperUrl = `/wallpaper/${body.wallpaperToken}`;

          return new Response(
            JSON.stringify({ success: true, wallpaperUrl }),
            { headers: { "Content-Type": "application/json" } }
          );
        } catch (err) {
          console.error("[payment] Verify error:", err);
          return new Response(
            JSON.stringify({ success: false, error: "Payment verification failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
