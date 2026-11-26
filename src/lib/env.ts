/**
 * Unified environment-like interface for accessing secrets.
 *
 * All AI provider keys are optional - the site builds and serves without them.
 * Errors only surface when a provider is actually called.
 *
 * Keys resolve in this order: per-request BYOK, Workers binding, then
 * process.env for local development. Never log or echo key values.
 */

export interface EnvLike {
  GEMINI_API_KEY?: string;
  NVIDIA_API_KEY?: string;
  BAIDU_API_KEY?: string;
  [name: string]: unknown;
}

function bindingValue(env: EnvLike | undefined, name: string): string | undefined {
  const value = env?.[name];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function processValue(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value : undefined;
}

/**
 * Resolve a key from env (Workers) or process.env (Node.js).
 * Throws if not found - caller should catch and handle gracefully.
 */
export function requireKey(name: string, env?: EnvLike): string {
  const value = bindingValue(env, name) ?? processValue(name);
  if (!value) {
    throw new Error(
      `${name} is not set — add it to the environment (server secrets) before using AI features.`
    );
  }
  return value;
}

/**
 * Get a key with optional override (BYOK per-request).
 * Priority: override > env > process.env
 */
export function getKey(
  name: string,
  override?: string,
  env?: EnvLike
): string | undefined {
  if (override?.trim()) return override;
  return bindingValue(env, name) ?? processValue(name);
}

// Provider-specific key accessors (maintain backward compatibility)
export function geminiKey(override?: string, env?: EnvLike): string {
  return getKey("GEMINI_API_KEY", override, env) ?? requireKey("GEMINI_API_KEY", env);
}

export function nvidiaKey(override?: string, env?: EnvLike): string {
  return getKey("NVIDIA_API_KEY", override, env) ?? requireKey("NVIDIA_API_KEY", env);
}

export function baiduKey(env?: EnvLike): string {
  return getKey("BAIDU_API_KEY", undefined, env) ?? requireKey("BAIDU_API_KEY", env);
}
