/**
 * The accounts + quota repository.
 *
 * ONE API, THREE drivers, chosen at RUNTIME on every call:
 *   - `d1`    : Cloudflare D1 (SQLite) when DB binding is available. This is
 *               the primary driver on Cloudflare Workers.
 *   - `neon`  : the sanctioned Postgres layer (`~/db` -> Neon serverless) when
 *               DATABASE_URL is set. This is production for non-Workers.
 *   - `memory`: a pure in-process store when neither D1 nor Neon is available,
 *               so the site runs with zero setup in local dev and preview.
 *
 * There is no `bun:sqlite` and no `node:fs` here on purpose: the Cloudflare
 * Workers bundle is built with `target: "browser"`, and a filesystem database
 * cannot survive there anyway.
 *
 * Every public function returns a TYPED result (`DbResult<T>`): a database
 * outage is surfaced, never thrown, so a request can never crash because the
 * database blinked.
 */

import { sql } from "~/db";

export type Plan = "free" | "premium";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  plan: Plan;
  credits: number;
  created_at: string;
}

export type DbErrorCode = "conflict" | "unavailable" | "invalid";

export type DbResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; code: DbErrorCode };

export type DbDriver = "d1" | "neon" | "memory";

/** The value stored in `generations.ip_hash` when no client IP is available. */
export const UNKNOWN_IP_HASH = "unknown";

const ok = <T>(value: T): DbResult<T> => ({ ok: true, value });
const fail = <T>(error: string, code: DbErrorCode = "unavailable"): DbResult<T> => ({
  ok: false,
  error,
  code,
});

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function normalizePlan(value: unknown): Plan {
  return String(value ?? "").trim().toLowerCase() === "premium" ? "premium" : "free";
}

/** `ip_hash` is NOT NULL, so it always gets a non-empty value. */
export function normalizeIpHash(value?: string | null): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : UNKNOWN_IP_HASH;
}

/** Which driver is in play right now? Re-read per call, never cached. */
export function activeDriver(): DbDriver {
  // Check for D1 binding first (Cloudflare Workers)
  if (typeof globalThis !== "undefined" && (globalThis as any).__D1_DB__) return "d1";
  // Then check for Neon (DATABASE_URL)
  return process.env.DATABASE_URL?.trim() ? "neon" : "memory";
}

/*
 * ----------------------------------------------------------------- D1 driver
 */

interface D1Runner {
  query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
  exec: (text: string) => Promise<void>;
}

let cachedD1Runner: D1Runner | null = null;

function getD1Binding(): any {
  return typeof globalThis !== "undefined" ? (globalThis as any).__D1_DB__ : null;
}

async function d1Runner(): Promise<D1Runner> {
  if (cachedD1Runner) return cachedD1Runner;
  const db = getD1Binding();
  if (!db) throw new Error("D1 binding not available");
  
  const runner: D1Runner = {
    async query(text: string, params: unknown[] = []) {
      const stmt = db.prepare(text);
      const bound = params.length ? stmt.bind(...params) : stmt;
      const result = await bound.all();
      if (!result.success) throw new Error(result.error || "D1 query failed");
      return (result.results || []) as Record<string, unknown>[];
    },
      async exec(text: string) {
    const stmt = db.prepare(text);
    const result = await stmt.run();
    if (!result.success) throw new Error(result.error || "D1 exec failed");
  },
  };
  cachedD1Runner = runner;
  return runner;
}

const D1_SCHEMA_STATEMENTS: string[] = [
  "CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY, email text UNIQUE NOT NULL, password_hash text NOT NULL, plan text NOT NULL DEFAULT 'free', credits integer NOT NULL DEFAULT 0, created_at text NOT NULL DEFAULT (datetime('now')));",
  "CREATE TABLE IF NOT EXISTS generations (id text PRIMARY KEY, user_id text, device_id text, ip_hash text NOT NULL, preset_id text, nakshatra text, focus_areas text, created_at text NOT NULL DEFAULT (datetime('now')));",
  "CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);",
  "CREATE INDEX IF NOT EXISTS idx_generations_device_id ON generations(device_id);",
  "CREATE INDEX IF NOT EXISTS idx_generations_ip_hash ON generations(ip_hash);",
  "CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at);",
  "CREATE TABLE IF NOT EXISTS wallpapers (id text PRIMARY KEY, user_id text NOT NULL, device_id text, ip_hash text NOT NULL, preset_id text, nakshatra text, focus_areas text, chart_summary text, conditions text, reading text, wallpaper_prompt text, image_data text, status text NOT NULL DEFAULT 'pending_payment', razorpay_order_id text, razorpay_payment_id text, paid_at text, failed_at text, failure_reason text, created_at text NOT NULL DEFAULT (datetime('now')));",
  "CREATE INDEX IF NOT EXISTS idx_wallpapers_user_id ON wallpapers(user_id);",
  "CREATE INDEX IF NOT EXISTS idx_wallpapers_status ON wallpapers(status);",
  "CREATE INDEX IF NOT EXISTS idx_wallpapers_razorpay_order_id ON wallpapers(razorpay_order_id);",
];

let d1SchemaPromise: Promise<void> | null = null;

/** Create the schema once per process. Idempotent, and retried after a failure. */
function ensureD1Schema(): Promise<void> {
  if (!d1SchemaPromise) {
    d1SchemaPromise = (async () => {
      const runner = await d1Runner();
      for (const statement of D1_SCHEMA_STATEMENTS) {
        await runner.exec(statement);
      }
    })().catch((err) => {
      d1SchemaPromise = null;
      throw err;
    });
  }
  return d1SchemaPromise;
}

/*
 * ----------------------------------------------------------------- Neon driver
 */

interface SqlRunner {
  query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
}

let cachedRunner: { url: string; runner: SqlRunner } | null = null;

async function neonRunner(): Promise<SqlRunner> {
  const url = process.env.DATABASE_URL?.trim() ?? "";
  if (!url) throw new Error("DATABASE_URL is not set");
  if (cachedRunner && cachedRunner.url === url) return cachedRunner.runner;
  const runner = (await sql()) as unknown as SqlRunner;
  cachedRunner = { url, runner };
  return runner;
}

const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
     id text PRIMARY KEY,
     email text UNIQUE NOT NULL,
     password_hash text NOT NULL,
     plan text NOT NULL DEFAULT 'free',
     credits integer NOT NULL DEFAULT 0,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS credits integer NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS generations (
     id text PRIMARY KEY,
     user_id text,
     device_id text,
     ip_hash text NOT NULL,
     preset_id text,
     nakshatra text,
     focus_areas text,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  `ALTER TABLE generations ADD COLUMN IF NOT EXISTS focus_areas text`,
  `CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_generations_device_id ON generations(device_id)`,
  `CREATE INDEX IF NOT EXISTS idx_generations_ip_hash ON generations(ip_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at)`,
  `CREATE TABLE IF NOT EXISTS wallpapers (
     id text PRIMARY KEY,
     user_id text NOT NULL,
     device_id text,
     ip_hash text NOT NULL,
     preset_id text,
     nakshatra text,
     focus_areas text,
     chart_summary text,
     conditions text,
     reading text,
     wallpaper_prompt text,
     image_data text,
     status text NOT NULL DEFAULT 'pending_payment',
     razorpay_order_id text,
     razorpay_payment_id text,
     paid_at timestamptz,
     failed_at timestamptz,
     failure_reason text,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_wallpapers_user_id ON wallpapers(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_wallpapers_status ON wallpapers(status)`,
  `CREATE INDEX IF NOT EXISTS idx_wallpapers_razorpay_order_id ON wallpapers(razorpay_order_id)`,
];

let schemaPromise: Promise<void> | null = null;

/** Create the schema once per process. Idempotent, and retried after a failure. */
function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const runner = await neonRunner();
      for (const statement of SCHEMA_STATEMENTS) {
        await runner.query(statement, []);
      }
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

/*
 * --------------------------------------------------------------- Memory driver
 */

interface MemoryUser {
  id: string;
  email: string;
  password_hash: string;
  plan: Plan;
  credits: number;
  created_at: string;
}

interface MemoryGeneration {
  id: string;
  user_id: string | null;
  device_id: string | null;
  ip_hash: string;
  preset_id: string | null;
  nakshatra: string | null;
  focus_areas: string | null;
  created_at: string;
}

interface MemoryWallpaper {
  id: string;
  user_id: string;
  device_id: string | null;
  ip_hash: string;
  preset_id: string | null;
  nakshatra: string | null;
  focus_areas: string | null;
  chart_summary: string | null;
  conditions: string | null;
  reading: string | null;
  wallpaper_prompt: string | null;
  image_data: string | null;
  status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  paid_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  created_at: string;
}

const memoryStore = {
  users: new Map<string, MemoryUser>(),
  emails: new Map<string, string>(),
  generations: [] as MemoryGeneration[],
  wallpapers: [] as MemoryWallpaper[],
};

/** Drop every in-memory row. Used by tests; a no-op on the Neon/D1 driver. */
export function resetMemoryStore(): void {
  memoryStore.users.clear();
  memoryStore.emails.clear();
  memoryStore.generations.length = 0;
  memoryStore.wallpapers.length = 0;
}

/*
 * ----------------------------------------------------------------- Public API
 */

export interface GenerationFilter {
  userId?: string;
  /** Count only rows that belong to NO account (anonymous usage). */
  userIdIsNull?: boolean;
  deviceId?: string;
  /** Count only rows that were recorded without a device id. */
  deviceIdIsNull?: boolean;
  ipHash?: string;
  sinceUtc?: Date | string;
  /** How the device and IP filters combine: "any" (OR, default) or "all" (AND). */
  scope?: "any" | "all";
}

export interface GenerationInput {
  id?: string;
  userId?: string;
  deviceId?: string;
  ipHash?: string;
  presetId?: string;
  nakshatra?: string;
  focusAreas?: string | string[];
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toUserRow(row: Record<string, unknown>): UserRow {
  const created = row.created_at;
  return {
    id: String(row.id ?? ""),
    email: String(row.email ?? ""),
    password_hash: String(row.password_hash ?? ""),
    plan: normalizePlan(row.plan),
    credits: Number(row.credits ?? 0),
    created_at: created instanceof Date ? created.toISOString() : String(created ?? ""),
  };
}

export async function findUserByEmail(email: string): Promise<DbResult<UserRow | null>> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return ok(null);
  try {
    const driver = activeDriver();
    if (driver === "d1") {
      await ensureD1Schema();
      const runner = await d1Runner();
      const rows = await runner.query(
        "SELECT id, email, password_hash, plan, credits, created_at FROM users WHERE email = ? LIMIT 1",
        [normalized],
      );
      const row = rows[0];
      return ok(row ? toUserRow(row) : null);
    }
    if (driver === "neon") {
      await ensureSchema();
      const runner = await neonRunner();
      const rows = await runner.query(
        "SELECT id, email, password_hash, plan, credits, created_at FROM users WHERE email = $1 LIMIT 1",
        [normalized],
      );
      const row = rows[0];
      return ok(row ? toUserRow(row) : null);
    }
    const id = memoryStore.emails.get(normalized);
    if (!id) return ok(null);
    const user = memoryStore.users.get(id);
    if (!user) return ok(null);
    return ok({ ...user });
  } catch (err) {
    return fail(describeError(err));
  }
}

export async function findUserById(id: string): Promise<DbResult<UserRow | null>> {
  const userId = id.trim();
  if (!userId) return ok(null);
  try {
    const driver = activeDriver();
    if (driver === "d1") {
      await ensureD1Schema();
      const runner = await d1Runner();
      const rows = await runner.query(
        "SELECT id, email, password_hash, plan, credits, created_at FROM users WHERE id = ? LIMIT 1",
        [userId],
      );
      const row = rows[0];
      return ok(row ? toUserRow(row) : null);
    }
    if (driver === "neon") {
      await ensureSchema();
      const runner = await neonRunner();
      const rows = await runner.query(
        "SELECT id, email, password_hash, plan, credits, created_at FROM users WHERE id = $1 LIMIT 1",
        [userId],
      );
      const row = rows[0];
      return ok(row ? toUserRow(row) : null);
    }
    const user = memoryStore.users.get(userId);
    return ok(user ? { ...user } : null);
  } catch (err) {
    return fail(describeError(err));
  }
}

export async function insertUser(user: {
  id: string;
  email: string;
  password_hash: string;
}): Promise<DbResult<{ id: string }>> {
  const email = user.email.trim().toLowerCase();
  if (!email) return fail("email is required", "invalid");
  try {
    const driver = activeDriver();
    if (driver === "d1") {
      await ensureD1Schema();
      const runner = await d1Runner();
      const rows = await runner.query(
        "INSERT INTO users (id, email, password_hash, plan, credits) VALUES (?, ?, ?, 'free', 5) ON CONFLICT (email) DO NOTHING RETURNING id",
        [user.id, email, user.password_hash],
      );
      if (!rows.length) return fail("email already registered", "conflict");
      return ok({ id: user.id });
    }
    if (driver === "neon") {
      await ensureSchema();
      const runner = await neonRunner();
      const rows = await runner.query(
        "INSERT INTO users (id, email, password_hash, plan, credits) VALUES ($1, $2, $3, 'free', 5) ON CONFLICT (email) DO NOTHING RETURNING id",
        [user.id, email, user.password_hash],
      );
      if (!rows.length) return fail("email already registered", "conflict");
      return ok({ id: user.id });
    }
    if (memoryStore.emails.has(email)) return fail("email already registered", "conflict");
    const record: MemoryUser = {
      id: user.id,
      email,
      password_hash: user.password_hash,
      plan: "free",
      credits: 5,
      created_at: new Date().toISOString(),
    };
    memoryStore.users.set(record.id, record);
    memoryStore.emails.set(email, record.id);
    return ok({ id: record.id });
  } catch (err) {
    return fail(describeError(err));
  }
}

export async function setUserPlan(userId: string, plan: Plan): Promise<DbResult<Plan>> {
  const id = userId.trim();
  if (!id) return fail("user id is required", "invalid");
  const next = normalizePlan(plan);
  try {
    const driver = activeDriver();
    if (driver === "d1") {
      await ensureD1Schema();
      const runner = await d1Runner();
      const rows = await runner.query(
        "UPDATE users SET plan = ? WHERE id = ? RETURNING plan",
        [next, id],
      );
      if (!rows.length) return fail("user not found", "invalid");
      return ok(normalizePlan(rows[0]?.plan));
    }
    if (driver === "neon") {
      await ensureSchema();
      const runner = await neonRunner();
      const rows = await runner.query(
        "UPDATE users SET plan = $2 WHERE id = $1 RETURNING plan",
        [id, next],
      );
      if (!rows.length) return fail("user not found", "invalid");
      return ok(normalizePlan(rows[0]?.plan));
    }
    const user = memoryStore.users.get(id);
    if (!user) return fail("user not found", "invalid");
    user.plan = next;
    return ok(user.plan);
  } catch (err) {
    return fail(describeError(err));
  }
}

export async function getCredits(userId: string): Promise<DbResult<number>> {
  const id = userId.trim();
  if (!id) return fail("user id is required", "invalid");
  try {
    const driver = activeDriver();
    if (driver === "d1") {
      await ensureD1Schema();
      const runner = await d1Runner();
      const rows = await runner.query(
        "SELECT credits FROM users WHERE id = ? LIMIT 1",
        [id],
      );
      if (!rows.length) return fail("user not found", "invalid");
      return ok(Number(rows[0]?.credits ?? 0));
    }
    if (driver === "neon") {
      await ensureSchema();
      const runner = await neonRunner();
      const rows = await runner.query(
        "SELECT credits FROM users WHERE id = $1 LIMIT 1",
        [id],
      );
      if (!rows.length) return fail("user not found", "invalid");
      return ok(Number(rows[0]?.credits ?? 0));
    }
    const user = memoryStore.users.get(id);
    if (!user) return fail("user not found", "invalid");
    return ok(user.credits);
  } catch (err) {
    return fail(describeError(err));
  }
}

export async function deductCredits(userId: string, amount: number): Promise<DbResult<number>> {
  const id = userId.trim();
  if (!id) return fail("user id is required", "invalid");
  if (!Number.isInteger(amount) || amount <= 0) return fail("amount must be a positive integer", "invalid");
  try {
    const driver = activeDriver();
    if (driver === "d1") {
      await ensureD1Schema();
      const runner = await d1Runner();
      const rows = await runner.query(
        "UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ? RETURNING credits",
        [amount, id, amount],
      );
      if (!rows.length) return fail("insufficient credits", "invalid");
      return ok(Number(rows[0]?.credits ?? 0));
    }
    if (driver === "neon") {
      await ensureSchema();
      const runner = await neonRunner();
      const rows = await runner.query(
        "UPDATE users SET credits = credits - $2 WHERE id = $1 AND credits >= $2 RETURNING credits",
        [id, amount],
      );
      if (!rows.length) return fail("insufficient credits", "invalid");
      return ok(Number(rows[0]?.credits ?? 0));
    }
    const user = memoryStore.users.get(id);
    if (!user) return fail("user not found", "invalid");
    if (user.credits < amount) return fail("insufficient credits", "invalid");
    user.credits -= amount;
    return ok(user.credits);
  } catch (err) {
    return fail(describeError(err));
  }
}

function matchesGeneration(row: MemoryGeneration, filters: GenerationFilter): boolean {
  if (filters.userId && row.user_id !== filters.userId) return false;
  if (filters.userIdIsNull && row.user_id !== null) return false;
  const deviceIp: boolean[] = [];
  if (filters.deviceId) deviceIp.push(row.device_id === filters.deviceId);
  if (filters.ipHash) deviceIp.push(row.ip_hash === filters.ipHash);
  if (deviceIp.length) {
    const matched =
      filters.scope === "all" ? deviceIp.every(Boolean) : deviceIp.some(Boolean);
    if (!matched) return false;
  }
  if (filters.deviceIdIsNull && row.device_id !== null) return false;
  if (filters.sinceUtc) {
    const since = new Date(toIso(filters.sinceUtc)).getTime();
    const created = new Date(row.created_at).getTime();
    if (Number.isFinite(since) && Number.isFinite(created) && created < since) return false;
  }
  return true;
}

export async function countGenerationsFor(
  filters: GenerationFilter,
): Promise<DbResult<number>> {
  try {
    const driver = activeDriver();
    if (driver === "d1") {
      await ensureD1Schema();
      const runner = await d1Runner();
      const params: unknown[] = [];
      const clauses: string[] = [];
      if (filters.userId) {
        params.push(filters.userId);
        clauses.push(`user_id = ?`);
      }
      if (filters.userIdIsNull) clauses.push("user_id IS NULL");
      if (filters.deviceIdIsNull) clauses.push("device_id IS NULL");
      const deviceIp: string[] = [];
      if (filters.deviceId) {
        params.push(filters.deviceId);
        deviceIp.push(`device_id = ?`);
      }
      if (filters.ipHash) {
        params.push(filters.ipHash);
        deviceIp.push(`ip_hash = ?`);
      }
      if (deviceIp.length) {
        const joiner = filters.scope === "all" ? " AND " : " OR ";
        const group = deviceIp.length > 1 ? `(${deviceIp.join(joiner)})` : deviceIp[0];
        clauses.push(group);
      }
      if (filters.sinceUtc) {
        params.push(toIso(filters.sinceUtc));
        clauses.push(`created_at >= ?`);
      }
      const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
      const rows = await runner.query(
        `SELECT count(*) AS n FROM generations${where}`,
        params,
      );
      const n = Number(rows[0]?.n ?? 0);
      return ok(Number.isFinite(n) ? n : 0);
    }
    if (driver === "neon") {
      await ensureSchema();
      const runner = await neonRunner();
      const params: unknown[] = [];
      const clauses: string[] = [];
      if (filters.userId) {
        params.push(filters.userId);
        clauses.push(`user_id = $${params.length}`);
      }
      if (filters.userIdIsNull) clauses.push("user_id IS NULL");
      if (filters.deviceIdIsNull) clauses.push("device_id IS NULL");
      const deviceIp: string[] = [];
      if (filters.deviceId) {
        params.push(filters.deviceId);
        deviceIp.push(`device_id = $${params.length}`);
      }
      if (filters.ipHash) {
        params.push(filters.ipHash);
        deviceIp.push(`ip_hash = $${params.length}`);
      }
      if (deviceIp.length) {
        const joiner = filters.scope === "all" ? " AND " : " OR ";
        const group = deviceIp.length > 1 ? `(${deviceIp.join(joiner)})` : deviceIp[0];
        clauses.push(group);
      }
      if (filters.sinceUtc) {
        params.push(toIso(filters.sinceUtc));
        clauses.push(`created_at >= $${params.length}`);
      }
      const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
      const rows = await runner.query(
        `SELECT count(*)::int AS n FROM generations${where}`,
        params,
      );
      const n = Number(rows[0]?.n ?? 0);
      return ok(Number.isFinite(n) ? n : 0);
    }
    let count = 0;
    for (const row of memoryStore.generations) {
      if (matchesGeneration(row, filters)) count += 1;
    }
    return ok(count);
  } catch (err) {
    return fail(describeError(err));
  }
}

export async function countGenerationsSince(
  filters: GenerationFilter & { sinceUtc: Date | string },
): Promise<DbResult<number>> {
  return countGenerationsFor(filters);
}

export async function insertGeneration(
  input: GenerationInput,
): Promise<DbResult<{ id: string }>> {
  const id = input.id ?? crypto.randomUUID();
  const userId = input.userId?.trim() || null;
  const deviceId = input.deviceId?.trim() || null;
  const ipHash = normalizeIpHash(input.ipHash);
  const presetId = input.presetId?.trim() || null;
  const nakshatra = input.nakshatra?.trim() || null;
  const focusAreas = Array.isArray(input.focusAreas)
    ? input.focusAreas.join(",").trim() || null
    : input.focusAreas?.trim() || null;
  try {
    const driver = activeDriver();
    if (driver === "d1") {
      await ensureD1Schema();
      const runner = await d1Runner();
      await runner.query(
        "INSERT INTO generations (id, user_id, device_id, ip_hash, preset_id, nakshatra, focus_areas) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, userId, deviceId, ipHash, presetId, nakshatra, focusAreas],
      );
      return ok({ id });
    }
    if (driver === "neon") {
      await ensureSchema();
      const runner = await neonRunner();
      await runner.query(
        "INSERT INTO generations (id, user_id, device_id, ip_hash, preset_id, nakshatra, focus_areas) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [id, userId, deviceId, ipHash, presetId, nakshatra, focusAreas],
      );
      return ok({ id });
    }
    memoryStore.generations.push({
      id,
      user_id: userId,
      device_id: deviceId,
      ip_hash: ipHash,
      preset_id: presetId,
      nakshatra,
      focus_areas: focusAreas,
      created_at: new Date().toISOString(),
    });
    return ok({ id });
  } catch (err) {
    return fail(describeError(err));
  }
}



