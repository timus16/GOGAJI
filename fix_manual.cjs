const fs = require("fs");
let content = fs.readFileSync("src/components/Generator.tsx", "utf8");

// Fix manual -> showManual references in JSX
content = content.replace(/setManual\(\(m\) => !m\)/g, "setShowManual((m) => !m)");
content = content.replace(/\{manual \?/g, "{showManual ?");
content = content.replace(/\}manual \&\&/g, "}showManual &&");
content = content.replace(/manual \?/g, "showManual ?");
content = content.replace(/manual \&\&/g, "showManual &&");

fs.writeFileSync("src/components/Generator.tsx", content);
console.log("Fixed manual references");
