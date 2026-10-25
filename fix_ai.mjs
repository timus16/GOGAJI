import fs from "fs";

const content = fs.readFileSync("E:/sentir/gogaji/GOGAJI/src/server/ai.ts", "utf8");
const fixed = content.replace(
  "const sessionMod = await import(\"~/server/session\");\n        const authMod = await import(\"~/server/api-auth\");\n        const userId = await sessionMod.currentUserId();\n        const premiumStatus = await authMod.premiumStatusFor(userId);",
  "const authMod = await import(\"~/server/api-auth\");\n        const userId = await (await import(\"~/server/session\")).currentUserId();\n        const premiumStatus = await authMod.premiumStatusFor(userId);"
);
fs.writeFileSync("E:/sentir/gogaji/GOGAJI/src/server/ai.ts", fixed);
console.log("Fixed");
