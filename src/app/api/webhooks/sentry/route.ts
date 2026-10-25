import { NextRequest, NextResponse } from "next/server";
import { alertCriticalError } from "@/lib/alerts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Sentry sends issue alerts in this format
    const issue = body.issue || body;
    const event = issue.latestEvent || {};
    
    const message = issue.title || event.message || "Unknown Sentry error";
    const context = {
      issueId: issue.id,
      project: issue.project?.name,
      level: issue.level,
      url: issue.url,
      environment: issue.environment,
      user: event.user,
      request: event.request,
      exception: event.exception?.values?.[0]?.type,
      stacktrace: event.exception?.values?.[0]?.stacktrace?.frames?.slice(0, 5),
    };
    
    await alertCriticalError(message, context, event.user?.id, event.event_id);
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Sentry webhook error:", err);
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}
