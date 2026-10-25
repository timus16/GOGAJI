/**
 * Password hashing and session-token signing.
 *
 * Two rules hold here:
 *  1. A password is stored as a salted PBKDF2-HMAC-SHA-256 hash in a VERSIONED
 *     string (`pbkdf2-sha256$v1$<iterations>$<salt>$<hash>`), so the cost can be
 *     raised later without losing the existing hashes: `verifyPassword()` also
 *     accepts the legacy `pbkdf2$<iterations>$<salt>$<hash>` form.
 *  2. The session secret is read LAZILY, per call, and NEVER falls back to a
 *     random value in production - there it fails closed with a clear error, so
 *     a misconfigured deployment cannot silently sign sessions with a secret
 *     nobody knows.
 */

const HASH_SCHEME = "pbkdf2-sha256";
const HASH_VERSION = "v1";
const LEGACY_HASH_SCHEME = "pbkdf2";
const PBKDF2_ITERATIONS = 150_000;
const MAX_ACCEPTED_ITERATIONS = 1_000_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
const SESSION_TTL_MS = 30 * 86_400_000;

export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

function toB64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(value: string): Uint8Array<ArrayBuffer> {
  let normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4 !== 0) normalized += "=";
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Constant-time comparison of two strings, for secrets. */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(new TextEncoder().encode(a), new TextEncoder().encode(b));
}

async function pbkdf2Bits(
  salt: Uint8Array<ArrayBuffer>,
  password: string,
  iterations: number,
): Promise<ArrayBuffer> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    KEY_BYTES * 8,
  );
}

/**
 * Is this a production deployment? Used to fail closed on a missing
 * SESSION_SECRET and to mark the session cookie `secure`.
 */
export function isProduction(): boolean {
  const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase();
  if (nodeEnv === "production" || nodeEnv === "prod") return true;
  const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase();
  if (vercelEnv === "production") return true;
  const cfPages = process.env.CF_PAGES?.trim().toLowerCase();
  if (cfPages === "true" || cfPages === "1") return true;
  return false;
}

let ephemeralSessionSecret: Uint8Array<ArrayBuffer> | null = null;
let ephemeralHashSecret: Uint8Array<ArrayBuffer> | null = null;
let warnedAboutMissingSecret = false;

/**
 * The session signing key, resolved per call.
 *
 * Production: SESSION_SECRET is REQUIRED - a missing value throws, so the
 * request fails closed instead of signing tokens with a throwaway key.
 * Development: an ephemeral per-process key is used, with ONE warning.
 */
function sessionSecret(): Uint8Array<ArrayBuffer> {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) return new TextEncoder().encode(configured);
  if (isProduction()) {
    throw new Error(
      "SESSION_SECRET is not set - sessions cannot be signed or verified. Add it to the server environment.",
    );
  }
  if (!warnedAboutMissingSecret) {
    warnedAboutMissingSecret = true;
    console.warn(
      "SESSION_SECRET not set - using an ephemeral development secret; every session resets on restart. Set SESSION_SECRET before deploying.",
    );
  }
  if (!ephemeralSessionSecret) {
    ephemeralSessionSecret = crypto.getRandomValues(new Uint8Array(32));
  }
  return ephemeralSessionSecret;
}

/**
 * A stable-per-process key for hashing client IPs. It is deliberately NOT the
 * session secret lookup: hashing must never throw, because a quota check that
 * throws would take the free path down with it. When SESSION_SECRET is set the
 * hashes are stable across restarts, so the daily counters survive a deploy.
 */
export function ipHashSecret(): Uint8Array<ArrayBuffer> {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) return new TextEncoder().encode(configured);
  if (!ephemeralHashSecret) {
    ephemeralHashSecret = crypto.getRandomValues(new Uint8Array(32));
  }
  return ephemeralHashSecret;
}

/** HMAC-SHA-256 of `data` under `key`, hex encoded. */
export async function hmacHexWith(key: Uint8Array<ArrayBuffer>, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  return toHex(new Uint8Array(sig));
}

interface ParsedHash {
  iterations: number;
  salt: Uint8Array<ArrayBuffer>;
  hash: Uint8Array<ArrayBuffer>;
}

function parseHash(stored: string): ParsedHash | null {
  const parts = stored.split("$");
  let iterations: number;
  let saltPart: string | undefined;
  let hashPart: string | undefined;
  if (parts.length === 5) {
    if (parts[0] !== HASH_SCHEME || parts[1] !== HASH_VERSION) return null;
    iterations = Number.parseInt(parts[2] ?? "", 10);
    saltPart = parts[3];
    hashPart = parts[4];
  } else if (parts.length === 4) {
    if (parts[0] !== LEGACY_HASH_SCHEME) return null;
    iterations = Number.parseInt(parts[1] ?? "", 10);
    saltPart = parts[2];
    hashPart = parts[3];
  } else {
    return null;
  }
  if (!Number.isFinite(iterations) || iterations <= 0) return null;
  if (iterations > MAX_ACCEPTED_ITERATIONS) return null;
  if (!saltPart || !hashPart) return null;
  try {
    return { iterations, salt: fromB64url(saltPart), hash: fromB64url(hashPart) };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const bits = new Uint8Array(await pbkdf2Bits(salt, password, PBKDF2_ITERATIONS));
  return `${HASH_SCHEME}$${HASH_VERSION}$${PBKDF2_ITERATIONS}$${toB64url(salt)}$${toB64url(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parsed = parseHash(stored);
    if (!parsed) return false;
    const derived = new Uint8Array(await pbkdf2Bits(parsed.salt, password, parsed.iterations));
    return timingSafeEqual(derived, parsed.hash);
  } catch {
    return false;
  }
}

export async function signSession(uid: string): Promise<string> {
  const payload = toB64url(
    new TextEncoder().encode(JSON.stringify({ uid, exp: Date.now() + SESSION_TTL_MS })),
  );
  const mac = await hmacHexWith(sessionSecret(), payload);
  return `${payload}.${mac}`;
}

/**
 * Verify a session token and return the user id, or null.
 *
 * The token carries `{uid, exp}` and nothing else: the PLAN is read from the
 * database on every request, so a plan change takes effect immediately.
 */
export async function verifySession(token: string): Promise<string | null> {
  try {
    const dot = token.indexOf(".");
    if (dot <= 0) return null;
    const payload = token.slice(0, dot);
    const mac = token.slice(dot + 1);
    if (!/^[0-9a-f]{64}$/.test(mac)) return null;
    const expected = await hmacHexWith(sessionSecret(), payload);
    if (!timingSafeEqual(new TextEncoder().encode(mac), new TextEncoder().encode(expected))) {
      return null;
    }
    const parsed = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as {
      uid?: unknown;
      exp?: unknown;
    };
    if (typeof parsed.uid !== "string" || typeof parsed.exp !== "number") return null;
    if (Date.now() >= parsed.exp) return null;
    return parsed.uid;
  } catch {
    return null;
  }
}

export const randomId = (): string => crypto.randomUUID();