import { createFileRoute } from "@tanstack/react-router";
import crypto from "crypto";

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET?.trim();

interface WebhookEvent {
  event: string;
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string;
        amount: number;
        currency: string;
        status: string;
        method?: string;
        email?: string;
        contact?: string;
        notes?: Record<string, string>;
        created_at: number;
      };
    };
    order?: {
      entity: {
        id: string;
        amount: number;
        currency: string;
        receipt?: string;
        notes?: Record<string, string>;
        status: string;
        created_at: number;
      };
    };
  };
}

function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export const Route = createFileRoute("/api/payment/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          if (!RAZORPAY_KEY_SECRET) {
            console.warn("[payment] Webhook received but Razorpay not configured");
            return new Response("OK", { status: 200 });
          }

          const signature = request.headers.get("x-razorpay-signature");
          const rawBody = await request.text();

          if (!signature || !verifyWebhookSignature(rawBody, signature, RAZORPAY_KEY_SECRET)) {
            console.warn("[payment] Invalid webhook signature");
            return new Response("Invalid signature", { status: 400 });
          }

          const event: WebhookEvent = JSON.parse(rawBody);
          console.log(`[payment] Webhook received: ${event.event}`);

          switch (event.event) {
            case "payment.captured": {
              const payment = event.payload.payment?.entity;
              if (payment) {
                const wallpaperToken = payment.notes?.wallpaper_token;
                const userId = payment.notes?.user_id;
                
                if (wallpaperToken && userId) {
                  try {
                    const { sql } = await import("~/db");
                    const runner = (await sql()) as unknown as {
                      query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
                    };
                    await runner.query(
                      `UPDATE wallpapers 
                       SET status = $1, razorpay_order_id = $2, razorpay_payment_id = $3, paid_at = $4
                       WHERE id = $5 AND user_id = $6 AND status = $7`,
                      [
                        "paid",
                        payment.order_id,
                        payment.id,
                        new Date().toISOString(),
                        wallpaperToken,
                        userId,
                        "pending_payment",
                      ]
                    );
                    console.log(`[payment] Wallpaper ${wallpaperToken} marked as paid via webhook`);
                  } catch (err) {
                    console.error("[payment] Failed to update wallpaper via webhook:", err);
                  }
                }
              }
              break;
            }
            case "payment.failed": {
              const payment = event.payload.payment?.entity;
              if (payment) {
                const wallpaperToken = payment.notes?.wallpaper_token;
                const userId = payment.notes?.user_id;
                
                if (wallpaperToken && userId) {
                  try {
                    const { sql } = await import("~/db");
                    const runner = (await sql()) as unknown as {
                      query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
                    };
                    await runner.query(
                      `UPDATE wallpapers 
                       SET status = $1, razorpay_order_id = $2, razorpay_payment_id = $3, failed_at = $4, failure_reason = $5
                       WHERE id = $6 AND user_id = $7 AND status = $8`,
                      [
                        "failed",
                        payment.order_id,
                        payment.id,
                        new Date().toISOString(),
                        payment.error_description || "Payment failed",
                        wallpaperToken,
                        userId,
                        "pending_payment",
                      ]
                    );
                    console.log(`[payment] Wallpaper ${wallpaperToken} marked as failed via webhook`);
                  } catch (err) {
                    console.error("[payment] Failed to update wallpaper via webhook:", err);
                  }
                }
              }
              break;
            }
            case "order.paid": {
              const order = event.payload.order?.entity;
              if (order) {
                const wallpaperToken = order.notes?.wallpaper_token;
                const userId = order.notes?.user_id;
                
                if (wallpaperToken && userId) {
                  try {
                    const { sql } = await import("~/db");
                    const runner = (await sql()) as unknown as {
                      query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
                    };
                    await runner.query(
                      `UPDATE wallpapers 
                       SET status = $1, razorpay_order_id = $2, paid_at = $3
                       WHERE id = $4 AND user_id = $5 AND status = $6`,
                      [
                        "paid",
                        order.id,
                        new Date().toISOString(),
                        wallpaperToken,
                        userId,
                        "pending_payment",
                      ]
                    );
                    console.log(`[payment] Wallpaper ${wallpaperToken} marked as paid via order.paid webhook`);
                  } catch (err) {
                    console.error("[payment] Failed to update wallpaper via order.paid webhook:", err);
                  }
                }
              }
              break;
            }
            default:
              console.log(`[payment] Unhandled webhook event: ${event.event}`);
          }

          return new Response("OK", { status: 200 });
        } catch (err) {
          console.error("[payment] Webhook error:", err);
          return new Response("Internal Server Error", { status: 500 });
        }
      },
    },
  },
});
