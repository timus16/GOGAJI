const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_DEFAULT = 5;

function rateLimitPerMinute(): number {
  const raw = process.env.AI_RATE_LIMIT_PER_MIN;
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : RATE_LIMIT_DEFAULT;
}

function getRequestIp(request?: Request): string {
  if (!request) return "*global*";
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return "*global*";
}

interface RateWindow {
  count: number;
  resetAt: number;
}

const rateWindows = new Map<string, RateWindow>();

/**
 * The limiter key for this request. Extracts IP from headers directly
 * to avoid any request body consumption issues.
 */
export function rateLimitKey(request?: Request): string {
  return getRequestIp(request);
}

/**
 * Consume one unit for this client. Returns an explanatory string when the
 * window is exhausted, or undefined when the request may proceed.
 */
export function checkRateLimit(request?: Request): string | undefined {
  const limit = rateLimitPerMinute();
  const now = Date.now();
  const key = rateLimitKey(request);
  let win = rateWindows.get(key);
  if (!win || now >= win.resetAt) {
    win = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateWindows.set(key, win);
  }
  win.count += 1;
  if (win.count > limit) {
    const retry = Math.max(1, Math.ceil((win.resetAt - now) / 1000));
    return "Rate limit reached for AI generation (" + limit + " requests per minute). Try again in about " + retry + "s.";
  }
  if (rateWindows.size > 5000) {
    for (const [k, w] of rateWindows) if (now >= w.resetAt) rateWindows.delete(k);
  }
  return undefined;
}
