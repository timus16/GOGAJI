/**
 * The accounts + quota repository.
 *
 * ONE API, TWO drivers, chosen at RUNTIME on every call:
 *   - `neon`  : the sanctioned Postgres layer (`~/db` -> Neon serverless) when
 *               DATABASE_URL is set. This is production.
 *   - `memory`: a pure in-process store when DATABASE_URL is missing, so the
 *               site runs with zero setup in local dev and preview.
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
  created_at: string;
}

export type DbErrorCode = "conflict" | "unavailable" | "invalid";

export type DbResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; code: DbErrorCode };

export type DbDriver = "neon" | "memory";

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
  return process.env.DATABASE_URL?.trim() ? "neon" : "memory";
}

/*
 * ----------------------------------------------------------------- Neon driver
 */

interface SqlRunner {
  query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
}

let cachedRunner: { url: string; runner: SqlRunner } | null = null;

function neonRunner(): SqlRunner {
  const url = process.env.DATABASE_URL?.trim() ?? "";
  if (!url) throw new Error("DATABASE_URL is not set");
  if (cachedRunner && cachedRunner.url === url) return cachedRunner.runner;
  const runner = sql() as unknown as SqlRunner;
  cachedRunner = { url, runner };
  return runner;
}

const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
     id text PRIMARY KEY,
     email text UNIQUE NOT NULL,
     password_hash text NOT NULL,
     plan text NOT NULL DEFAULT 'free',
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free'`,
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
];

let schemaPromise: Promise<void> | null = null;

/** Create the schema once per process. Idempotent, and retried after a failure. */
function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const runner = neonRunner();
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

const memoryStore = {
  users: new Map<string, MemoryUser>(),
  emails: new Map<string, string>(),
  generations: [] as MemoryGeneration[],
};

/** Drop every in-memory row. Used by tests; a no-op on the Neon driver. */
export function resetMemoryStore(): void {
  memoryStore.users.clear();
  memoryStore.emails.clear();
  memoryStore.generations.length = 0;
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
    created_at: created instanceof Date ? created.toISOString() : String(created ?? ""),
  };
}

export async function findUserByEmail(email: string): Promise<DbResult<UserRow | null>> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return ok(null);
  try {
    if (activeDriver() === "neon") {
      await ensureSchema();
      const runner = neonRunner();
      const rows = await runner.query(
        "SELECT id, email, password_hash, plan, created_at FROM users WHERE email = $1 LIMIT 1",
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
    if (activeDriver() === "neon") {
      await ensureSchema();
      const runner = neonRunner();
      const rows = await runner.query(
        "SELECT id, email, password_hash, plan, created_at FROM users WHERE id = $1 LIMIT 1",
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
    if (activeDriver() === "neon") {
      await ensureSchema();
      const runner = neonRunner();
      const rows = await runner.query(
        "INSERT INTO users (id, email, password_hash, plan) VALUES ($1, $2, $3, 'free') ON CONFLICT (email) DO NOTHING RETURNING id",
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
    if (activeDriver() === "neon") {
      await ensureSchema();
      const runner = neonRunner();
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
    if (activeDriver() === "neon") {
      await ensureSchema();
      const runner = neonRunner();
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
    if (activeDriver() === "neon") {
      await ensureSchema();
      const runner = neonRunner();
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