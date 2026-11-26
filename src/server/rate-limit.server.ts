const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_DEFAULT = 5;

function rateLimitPerMinute(): number {
  const raw = process.env.AI_RATE_LIMIT_PER_MIN;
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : RATE_LIMIT_DEFAULT;
}

function getClientIp(request?: Request): string | undefined {
  if (!request) return undefined;
  const connectingIp = request.headers.get("cf-connecting-ip")?.trim();
  if (connectingIp) return connectingIp;
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || undefined;
}

function getRequestIp(request?: Request): string {
  return getClientIp(request) ?? "*global*";
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
interface RateLimitOptions {
  limit: number;
  windowMs: number;
  scope: string;
  allowMissingIp?: boolean;
  message?: string;
}

export function checkRateLimit(request?: Request, options?: RateLimitOptions): string | undefined {
  const limit = options?.limit ?? rateLimitPerMinute();
  const windowMs = options?.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const clientIp = getClientIp(request);
  if (!clientIp && options?.allowMissingIp) return undefined;

  const now = Date.now();
  const key = options ? options.scope + ":" + (clientIp ?? "*global*") : rateLimitKey(request);
  let win = rateWindows.get(key);
  if (!win || now >= win.resetAt) {
    win = { count: 0, resetAt: now + windowMs };
    rateWindows.set(key, win);
  }
  win.count += 1;
  if (win.count > limit) {
    if (options?.message) return options.message;
    const retry = Math.max(1, Math.ceil((win.resetAt - now) / 1000));
    return "Rate limit reached for AI generation (" + limit + " requests per minute). Try again in about " + retry + "s.";
  }
  if (rateWindows.size > 5000) {
    for (const [k, w] of rateWindows) if (now >= w.resetAt) rateWindows.delete(k);
  }
  return undefined;
}

export const GENERATION_RATE_LIMIT_MAX_REQUESTS = 30;
export const GENERATION_RATE_LIMIT_WINDOW_MS = 10 * 60_000;
export const GENERATION_RATE_LIMIT_MESSAGE =
  "Too many generation requests. Please try again in a few minutes.";

export function checkGenerationRateLimit(request: Request): string | undefined {
  return checkRateLimit(request, {
    limit: GENERATION_RATE_LIMIT_MAX_REQUESTS,
    windowMs: GENERATION_RATE_LIMIT_WINDOW_MS,
    scope: "generation",
    allowMissingIp: true,
    message: GENERATION_RATE_LIMIT_MESSAGE,
  });
}
