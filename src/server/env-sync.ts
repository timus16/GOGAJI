import type { EnvLike } from "~/lib/env";

export interface WorkerEnv extends EnvLike {
  DATABASE_URL?: string;
  PREMIUM_BYPASS_CODE?: string;
  SESSION_SECRET?: string;
  DB?: D1Database;
}

const SYNCED_KEYS = [
  "DATABASE_URL",
  "GEMINI_API_KEY",
  "NVIDIA_API_KEY",
  "BAIDU_API_KEY",
  "PREMIUM_BYPASS_CODE",
  "SESSION_SECRET",
] as const;

let currentEnv: WorkerEnv = {};

export function syncEnv(env: WorkerEnv): WorkerEnv {
  currentEnv = env ?? {};

  for (const name of SYNCED_KEYS) {
    const value = currentEnv[name];
    if (typeof value !== "string" || !value.trim()) continue;
    try {
      process.env[name] = value;
    } catch {
    }
  }

  if (currentEnv.DB) {
    (globalThis as any).__D1_DB__ = currentEnv.DB;
    process.env.CF_WORKER = "true";
  }

  return currentEnv;
}

export function syncedEnv(): WorkerEnv {
  return currentEnv;
}

// Type for D1 database binding
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(data: ArrayBuffer): Promise<ArrayBuffer>;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  exec(query: string): Promise<D1Result>;
}

interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = any>(): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = any>(): Promise<D1Result<T>>;
}

interface D1Result<T = any> {
  results: T[];
  success: boolean;
  error?: string;
  meta: {
    duration: number;
    rows_read: number;
    rows_written: number;
    changed_db: boolean;
    last_row_id?: number;
    changed_rows?: number;
  };
}
