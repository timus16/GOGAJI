import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const ALERT_EMAIL = process.env.ALERT_EMAIL || "timus1666@gmail.com";

interface AlertPayload {
  type: "critical" | "payment_failure" | "generation_failure" | "database_failure" | "auth_error";
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
  userId?: string;
  requestId?: string;
}

export async function sendAlert(payload: AlertPayload) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set, skipping alert");
    return;
  }

  const subject = `[Nakshatra Canvas] ${payload.type.toUpperCase()}: ${payload.message.slice(0, 80)}`;
  
  const html = `
    <div style="font-family: system-ui; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f2937; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">?? ${payload.type.toUpperCase()}</h2>
        <p style="margin: 8px 0 0; color: #9ca3af;">${new Date(payload.timestamp).toLocaleString()}</p>
      </div>
      <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 16px; font-size: 16px;"><strong>Message:</strong> ${payload.message}</p>
        ${payload.userId ? `<p style="margin: 0 0 8px;"><strong>User ID:</strong> ${payload.userId}</p>` : ""}
        ${payload.requestId ? `<p style="margin: 0 0 8px;"><strong>Request ID:</strong> ${payload.requestId}</p>` : ""}
        ${payload.context ? `
          <p style="margin: 16px 0 8px;"><strong>Context:</strong></p>
          <pre style="background: #1f2937; color: #e5e7eb; padding: 12px; border-radius: 4px; overflow: auto; font-size: 12px;">${JSON.stringify(payload.context, null, 2)}</pre>
        ` : ""}
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from: "Nakshatra Canvas Alerts <alerts@nakshatracanvas.com>",
      to: ALERT_EMAIL,
      subject,
      html,
    });
  } catch (err) {
    console.error("Failed to send alert email:", err);
  }
}

// Specific alert helpers
export async function alertCriticalError(message: string, context?: Record<string, unknown>, userId?: string, requestId?: string) {
  await sendAlert({ type: "critical", message, context, userId, requestId, timestamp: new Date().toISOString() });
}

export async function alertPaymentFailure(message: string, context?: Record<string, unknown>, userId?: string, requestId?: string) {
  await sendAlert({ type: "payment_failure", message, context, userId, requestId, timestamp: new Date().toISOString() });
}

export async function alertGenerationFailure(message: string, context?: Record<string, unknown>, userId?: string, requestId?: string) {
  await sendAlert({ type: "generation_failure", message, context, userId, requestId, timestamp: new Date().toISOString() });
}

export async function alertDatabaseFailure(message: string, context?: Record<string, unknown>, userId?: string, requestId?: string) {
  await sendAlert({ type: "database_failure", message, context, userId, requestId, timestamp: new Date().toISOString() });
}

export async function alertAuthError(message: string, context?: Record<string, unknown>, userId?: string, requestId?: string) {
  await sendAlert({ type: "auth_error", message, context, userId, requestId, timestamp: new Date().toISOString() });
}
