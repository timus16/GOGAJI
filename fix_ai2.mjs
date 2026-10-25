import fs from "fs";

const content = fs.readFileSync("E:/sentir/gogaji/GOGAJI/src/server/ai.ts", "utf8");
const fixed = content.replace(
  "      try {\n        const quotaMod = await import(\"~/server/quota\");\n        const sessionMod = await import(\"~/server/session\");\n        quotaIdentity = await quotaMod.currentQuotaIdentity(data.deviceId);",
  "      try {\n        const quotaMod = await import(\"~/server/quota\");\n        quotaIdentity = await quotaMod.currentQuotaIdentity(data.deviceId);"
);
fs.writeFileSync("E:/sentir/gogaji/GOGAJI/src/server/ai.ts", fixed);
console.log("Fixed");
