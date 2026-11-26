// Polyfill for Node.js built-ins in Cloudflare Workers
// With nodejs_compat flag, most globals are provided automatically.
// This file ensures they exist and are properly typed.

// Polyfill createRequire
if (typeof globalThis.createRequire === "undefined") {
  const { createRequire } = await import("node:module");
  globalThis.createRequire = createRequire;
}

// Ensure util exists (provided by nodejs_compat)
if (typeof globalThis.util === "undefined") {
  globalThis.util = await import("node:util");
}

// Ensure process exists (provided by nodejs_compat)
if (typeof globalThis.process === "undefined") {
  globalThis.process = await import("node:process");
}

// Ensure Buffer exists (provided by nodejs_compat)
if (typeof globalThis.Buffer === "undefined") {
  const { Buffer } = await import("node:buffer");
  globalThis.Buffer = Buffer;
}

// Ensure path exists (provided by nodejs_compat)
if (typeof globalThis.path === "undefined") {
  globalThis.path = await import("node:path");
}

// Ensure events/EventEmitter exists (provided by nodejs_compat)
if (typeof globalThis.EventEmitter === "undefined") {
  const { EventEmitter } = await import("node:events");
  globalThis.EventEmitter = EventEmitter;
}

// Ensure crypto exists (provided by nodejs_compat)
if (typeof globalThis.crypto === "undefined") {
  globalThis.crypto = await import("node:crypto");
}

// Ensure stream exists (provided by nodejs_compat)
if (typeof globalThis.stream === "undefined") {
  globalThis.stream = await import("node:stream");
}

// Ensure assert exists (provided by nodejs_compat)
if (typeof globalThis.assert === "undefined") {
  globalThis.assert = await import("node:assert");
}
