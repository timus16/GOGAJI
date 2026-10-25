import { buildWallpaperResponse } from "~/server/ai";
import { premiumStatusFor } from "~/server/api-auth";
import { recordGeneration, currentQuotaIdentity, enforceQuota } from "~/server/quota";
import { resetMemoryStore } from "~/server/db";

console.log("=== AI WIRING SELF-CHECK ===\n");

let allPassed = true;

async function assert(condition, msg) {
  if (!condition) {
    console.log("  FAIL: " + msg);
    allPassed = false;
  } else {
    console.log("  PASS: " + msg);
  }
}

const testBirth = {
  name: "Test User",
  date: "1990-01-01",
  time: "12:00",
  place: "New Delhi",
  latitude: 28.6139,
  longitude: 77.209,
  timezone: "Asia/Kolkata"
};

// Test 1: No keys - should resolve with chart, no reading, error about missing key
console.log("Test 1: No keys provided");
const r1 = await buildWallpaperResponse(testBirth);
assert(r1.chartSummary && Object.keys(r1.chartSummary.facts).length > 0, "chartSummary.facts populated");
assert(r1.reading === null, "reading is null");
assert(r1.wallpaperPrompt && r1.wallpaperPrompt.length > 0, "wallpaperPrompt non-empty");
assert(r1.error && (r1.error.includes("key") || r1.error.includes("Key") || r1.error.includes("provider") || r1.error.includes("unavailable")), "error mentions missing provider key: " + r1.error);

// Test 2: BYOK with anonymous session - should ignore keys and show premium error
console.log("\nTest 2: BYOK with anonymous session");
const r2 = await buildWallpaperResponse({
  ...testBirth,
  keys: { gemini: "test-key", openrouter: "test-key", nvidia: "test-key" }
});
assert(r2.error && (r2.error.includes("Premium") || r2.error.includes("premium")), "error mentions Premium/BYOK: " + r2.error);
assert(r2.reading === null, "reading is null (keys not used)");
assert(r2.wallpaperPrompt && r2.wallpaperPrompt.length > 0, "wallpaperPrompt still non-empty");

// Test 3: premiumStatusFor(null) -> {isPremium:false, plan:"free"}
console.log("\nTest 3: premiumStatusFor(null)");
const ps = await premiumStatusFor(null);
assert(ps.isPremium === false, "isPremium is false");
assert(ps.plan === "free", "plan is free");
console.log("  Result:", JSON.stringify(ps));

// Test 4: Quota exhaustion simulation
console.log("\nTest 4: Quota exhaustion (5 generations for same device+IP)");
resetMemoryStore(); // reset in-memory store for clean test
const deviceId = "test-device-" + Date.now();
const testData = { ...testBirth, deviceId };

// Record 5 generations (FREE_ANON_LIMIT_DEFAULT = 5)
for (let i = 0; i < 5; i++) {
  const identity = await currentQuotaIdentity(deviceId);
  await recordGeneration({
    ...identity,
    presetId: "test",
    nakshatra: "Ashwini",
    focusAreas: []
  });
}

// Now the 6th request should be quota-limited
const r4 = await buildWallpaperResponse(testData);
assert(r4.reading === null, "reading is null (quota blocked)");
assert(r4.wallpaperPrompt && r4.wallpaperPrompt.length > 0, "wallpaperPrompt still non-empty");
assert(r4.error && (r4.error.includes("Daily") || r4.error.includes("limit") || r4.error.includes("limit reached")), "error names daily limit: " + r4.error);

// Final result
console.log("\n=== RESULT ===");
if (allPassed) {
  console.log("AI_WIRING_OK");
} else {
  console.log("AI_WIRING_FAIL");
}
process.exit(allPassed ? 0 : 1);
