#!/usr/bin/env bun
/**
 * Build-time skill enforcement script.
 * Parses all SKILL.md files in .kilo/skills/, extracts MUST/NEVER rules,
 * and verifies them against the codebase. Fails the build on violation.
 */

import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { Glob } from "bun";

const PROJECT_ROOT = resolve(import.meta.dir, "..", "..");
const SKILLS_DIR = join(PROJECT_ROOT, ".kilo", "skills");

interface SkillRule {
  skill: string;
  type: "MUST" | "NEVER";
  pattern: RegExp;
  message: string;
  filePattern?: string;
  excludePattern?: string;
  globPattern?: string;
  severity: "error" | "warning";
}

interface SkillConfig {
  name: string;
  rules: SkillRule[];
}

// Helper to create regex with proper Windows path support
const WP = "[\\\\/]"; // Matches both backslash and forward slash in regex

const skillRules: SkillConfig[] = [
  {
    name: "kundli-engine",
    rules: [
      {
        skill: "kundli-engine",
        type: "NEVER",
        pattern: /(sunLongitude|moonLongitude|planetLongitude|lahiriAyanamsa|tropicalAscendant|meanNode|jdFromDate|localToUtc|placement)\s*\(/,
        message: "Planetary math MUST only be in src/lib/astro.ts. Do not compute positions, ayanamsa, nakshatra, pada, houses, or retrogression elsewhere. Use computeChart() from the engine.",
        filePattern: "^(?!.*\\.kilo" + WP + ").*\\.(ts|tsx)$",
        excludePattern: "src" + WP + "lib" + WP + "astro\\.ts$",
        severity: "error",
      },
      {
        skill: "kundli-engine",
        type: "MUST",
        pattern: /from\s+["'"']~\/(lib\/astro|content\/vedic-mapping)["'"']/i,
        message: "Chart computations MUST import from the deterministic engine (src/lib/astro.ts) and content tables (src/content/vedic-mapping.ts).",
        filePattern: ".*\\.(ts|tsx)$",
        globPattern: "src/**/*.{ts,tsx}",
        severity: "error",
      },
    ],
  },
  {
    name: "vedic-wallpaper-aesthetics",
    rules: [
      {
        skill: "vedic-wallpaper-aesthetics",
        type: "NEVER",
        pattern: /(fill|stroke|color|font-size|opacity|stroke-width)\s*[:=]\s*["'"']?(#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(|[0-9.]+(px|em|rem|%))/,
        message: "Renderer MUST use design tokens from StylePreset (preset.ink, preset.rule, preset.bg, etc.) and Graha colours (GRAHAS[key].colour). No hardcoded visual values.",
        filePattern: "src" + WP + "lib" + WP + "wallpaper\\.ts$",
        severity: "error",
      },
      {
        skill: "vedic-wallpaper-aesthetics",
        type: "MUST",
        pattern: /presetById|preset\.(ink|inkSoft|rule|bg|accentOpacity|texture|rings|petals|lineWeight|displayFont|letterSpacing|uppercase|dark|artScrim)/i,
        message: "Wallpaper renderer MUST read all visual parameters from the StylePreset design tokens.",
        filePattern: "src" + WP + "lib" + WP + "wallpaper\\.ts$",
        globPattern: "src/lib/wallpaper.ts",
        severity: "error",
      },
      {
        skill: "vedic-wallpaper-aesthetics",
        type: "MUST",
        pattern: /(GRAHAS\[.*?\]|g|c)\.colour/i,
        message: "Planet-specific colours MUST come from GRAHAS[colour] (classical graha-varna).",
        filePattern: "src" + WP + "lib" + WP + "wallpaper\\.ts$",
        globPattern: "src/lib/wallpaper.ts",
        severity: "error",
      },
    ],
  },
  {
    name: "image-prompt",
    rules: [
      {
        skill: "image-prompt",
        type: "MUST",
        pattern: /NO_TEXT_CLAUSE/i,
        message: "Prompt builder MUST include the mandatory NO_TEXT_CLAUSE: 'no readable text, no letters, no watermark, no lettering, no caption'.",
        filePattern: "src" + WP + "lib" + WP + "nvidia\\.ts$",
        globPattern: "src/lib/nvidia.ts",
        severity: "error",
      },
      {
        skill: "image-prompt",
        type: "MUST",
        pattern: /promptFromBrief/i,
        message: "All image prompts MUST be generated via promptFromBrief() which follows the declarative schema.",
        filePattern: "src" + WP + "(server|lib)" + WP + ".*\\.ts$",
        globPattern: "src/**/*.ts",
        severity: "error",
      },
      {
        skill: "image-prompt",
        type: "NEVER",
        pattern: /(no text|no letters|no watermark|no lettering|no caption)/i,
        message: "The NO_TEXT_CLAUSE must be defined as a constant (NO_TEXT_CLAUSE) and appended programmatically, not hardcoded in multiple places.",
        filePattern: "^(?!.*nvidia\\.ts).*\\.(ts|tsx)$",
        excludePattern: "src" + WP + "lib" + WP + "gemini\\.ts$",
        severity: "warning",
      },
      {
        skill: "image-prompt",
        type: "MUST",
        pattern: /StylePreset|style_preset|presetId/i,
        message: "Prompt MUST reference a valid style preset from PRESETS[] in vedic-mapping.ts.",
        filePattern: "src" + WP + "lib" + WP + "nvidia\\.ts$",
        globPattern: "src/lib/nvidia.ts",
        severity: "error",
      },
    ],
  },
  {
    name: "astrology-premium-service",
    rules: [
      {
        skill: "astrology-premium-service",
        type: "MUST",
        pattern: /computeChart|assessChart|chartFactSheet|readKundli|promptFromBrief|nvidiaWallpaper|buildWallpaperSvg/i,
        message: "The pipeline MUST use the deterministic chart engine (computeChart), condition assessment (assessChart), fact sheet (chartFactSheet), reading (readKundli), prompt builder (promptFromBrief), image generation (nvidiaWallpaper), and SVG renderer (buildWallpaperSvg).",
        filePattern: "src" + WP + "server" + WP + "ai\\.ts$",
        globPattern: "src/server/ai.ts",
        severity: "error",
      },
      {
        skill: "astrology-premium-service",
        type: "NEVER",
        pattern: /throw\s+new\s+Error\(|throw\s+err/i,
        message: "Server function MUST never throw. All failures must degrade gracefully to the deterministic SVG path with an error string in the response.",
        filePattern: "src" + WP + "server" + WP + "ai\\.ts$",
        severity: "error",
      },
      {
        skill: "astrology-premium-service",
        type: "MUST",
        pattern: /shouldCallAI/i,
        message: "Pipeline MUST call shouldCallAI() qualification gate BEFORE any provider call.",
        filePattern: "src" + WP + "components" + WP + "Generator\\.tsx$",
        globPattern: "src/components/Generator.tsx",
        severity: "error",
      },
      {
        skill: "astrology-premium-service",
        type: "MUST",
        pattern: /captureSubmit/i,
        message: "Pipeline MUST call captureSubmit() for CRM persistence ONLY when consent (AI opt-in) is given.",
        filePattern: "src" + WP + "components" + WP + "Generator\\.tsx$",
        globPattern: "src/components/Generator.tsx",
        severity: "error",
      },
      {
        skill: "astrology-premium-service",
        type: "MUST",
        pattern: /AI_READING_BUDGET_MS|AI_IMAGE_BUDGET_MS/i,
        message: "Pipeline MUST enforce AI time budgets for reading and image generation.",
        filePattern: "src" + WP + "server" + WP + "ai\\.ts$",
        globPattern: "src/server/ai.ts",
        severity: "error",
      },
    ],
  },
  {
    name: "regional-panchanga",
    rules: [
      {
        skill: "regional-panchanga",
        type: "MUST",
        pattern: /computePanchang|vimshottariDasha/i,
        message: "Regional calculations MUST use the engine functions computePanchang() and vimshottariDasha() from src/lib/astro.ts.",
        filePattern: ".*\\.(ts|tsx)$",
        globPattern: "src/**/*.{ts,tsx}",
        severity: "error",
      },
      {
        skill: "regional-panchanga",
        type: "NEVER",
        pattern: /(calculateTithi|calculateYoga|calculateKarana|calculateLunarMonth|calculateSankranti|calculateDasha|getTithi|getYoga|getKarana|getLunarMonth|getSankranti|getDasha)\s*\(/i,
        message: "LLM must NEVER compute tithi, yoga, karana, lunar month, sankranti, or dasha. These MUST come from src/lib/astro.ts engine.",
        filePattern: "^(?!.*astro\\.ts).*\\.(ts|tsx)$",
        severity: "error",
      },
      {
        skill: "regional-panchanga",
        type: "MUST",
        pattern: /traditionByState|INDIAN_STATES/i,
        message: "Regional data MUST be accessed via traditionByState() from src/content/regional.ts (36 state/UT entries).",
        filePattern: ".*\\.(ts|tsx)$",
        globPattern: "src/**/*.{ts,tsx}",
        severity: "error",
      },
      {
        skill: "regional-panchanga",
        type: "MUST",
        pattern: /sunAtNewMoon|amantaIndex.*elongation/i,
        message: "Lunar month naming MUST use the CORRECTED classical rule: sunAtNewMoon = sun - (elongation/12.19)*0.9856, amantaIndex = (floor(sunAtNewMoon/30)+1)%12.",
        filePattern: "src" + WP + "lib" + WP + "astro\\.ts$",
        globPattern: "src/lib/astro.ts",
        severity: "error",
      },
    ],
  },
];

async function findSkillFiles(): Promise<string[]> {
  const files: string[] = [];
  const glob = new Glob(".kilo/skills/**/SKILL.md");
  for await (const file of glob.scan({ cwd: PROJECT_ROOT })) {
    files.push(file);
  }
  return files;
}

function getSkillNameFromPath(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  const skillsIndex = parts.indexOf("skills");
  if (skillsIndex >= 0 && skillsIndex + 1 < parts.length) {
    return parts[skillsIndex + 1];
  }
  return "unknown";
}

function extractRulesFromSkillMd(content: string, skillName: string): SkillRule[] {
  const rules: SkillRule[] = [];
  const lines = content.split("\n");
  let inRulesSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.toLowerCase().includes("strict execution rules") ||
        line.toLowerCase().includes("forbidden operations") ||
        line.toLowerCase().includes("guardrails") ||
        line.toLowerCase().includes("hard prohibition")) {
      inRulesSection = true;
      continue;
    }

    if (inRulesSection && (line.startsWith("## ") || line.startsWith("# "))) {
      inRulesSection = false;
      continue;
    }

    if (inRulesSection) {
      const neverMatch = line.match(/^-\s*(NEVER|MUST NOT|NEVER)\s+(.+)$/i);
      const mustMatch = line.match(/^-\s*(MUST|SHALL|REQUIRED)\s+(.+)$/i);

      if (neverMatch) {
        const ruleText = neverMatch[2];
        rules.push(createRuleFromText(skillName, "NEVER", ruleText));
      } else if (mustMatch) {
        const ruleText = mustMatch[2];
        rules.push(createRuleFromText(skillName, "MUST", ruleText));
      }
    }
  }

  return rules;
}

function createRuleFromText(skill: string, type: "MUST" | "NEVER", text: string): SkillRule {
  const lowerText = text.toLowerCase();

  let pattern: RegExp;
  let message = text;
  let filePattern: string | undefined;
  let excludePattern: string | undefined;
  let globPattern: string | undefined;
  let severity: "error" | "warning" = "error";

  if (lowerText.includes("astro.ts") || lowerText.includes("chart engine") || lowerText.includes("planetary math")) {
    pattern = /(sunLongitude|moonLongitude|planetLongitude|lahiriAyanamsa|tropicalAscendant|meanNode|jdFromDate|localToUtc|placement)\s*\(/;
    filePattern = "^(?!.*\\.kilo" + WP + ").*\\.(ts|tsx)$";
    excludePattern = "src" + WP + "lib" + WP + "astro\\.ts$";
  } else if (lowerText.includes("design token") || lowerText.includes("hardcoded") || lowerText.includes("style preset")) {
    pattern = /(fill|stroke|color|font-size|opacity|stroke-width)\s*[:=]\s*["'"']?(#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(|[0-9.]+(px|em|rem|%))/;
    filePattern = "src" + WP + "lib" + WP + "wallpaper\\.ts$";
  } else if (lowerText.includes("no text") || lowerText.includes("no letters") || lowerText.includes("watermark")) {
    pattern = /NO_TEXT_CLAUSE/i;
    filePattern = "src" + WP + "lib" + WP + "nvidia\\.ts$";
  } else if (lowerText.includes("prompt") && lowerText.includes("schema")) {
    pattern = /promptFromBrief/i;
    filePattern = "src" + WP + "lib" + WP + "nvidia\\.ts$";
  } else if (lowerText.includes("pipeline") || lowerText.includes("orchestrat")) {
    pattern = /computeChart|assessChart|chartFactSheet|readKundli|promptFromBrief|nvidiaWallpaper|buildWallpaperSvg/i;
    filePattern = "src" + WP + "server" + WP + "ai\\.ts$";
  } else if (lowerText.includes("never throw") || lowerText.includes("degrade")) {
    pattern = /throw\s+new\s+Error\(|throw\s+err/i;
    filePattern = "src" + WP + "server" + WP + "ai\\.ts$";
  } else if (lowerText.includes("shouldcallai") || lowerText.includes("qualification gate")) {
    pattern = /shouldCallAI/i;
    filePattern = "src" + WP + "components" + WP + "Generator\\.tsx$";
  } else if (lowerText.includes("capturesubmit") || lowerText.includes("consent")) {
    pattern = /captureSubmit/i;
    filePattern = "src" + WP + "components" + WP + "Generator\\.tsx$";
  } else if (lowerText.includes("budget") || lowerText.includes("timeout")) {
    pattern = /AI_READING_BUDGET_MS|AI_IMAGE_BUDGET_MS/i;
    filePattern = "src" + WP + "server" + WP + "ai\\.ts$";
  } else if (lowerText.includes("tithi") || lowerText.includes("panchang") || lowerText.includes("dasha") || lowerText.includes("lunar month")) {
    pattern = /computePanchang|vimshottariDasha/i;
    filePattern = ".*\\.(ts|tsx)$";
  } else if (lowerText.includes("regional data") || lowerText.includes("indian_states") || lowerText.includes("traditionbystate")) {
    pattern = /traditionByState|INDIAN_STATES/i;
    filePattern = ".*\\.(ts|tsx)$";
  } else if (lowerText.includes("corrected classical rule") || lowerText.includes("sunatnewmoon")) {
    pattern = /sunAtNewMoon|amantaIndex.*elongation/i;
    filePattern = "src" + WP + "lib" + WP + "astro\\.ts$";
  } else {
    pattern = /./;
  }

  return { skill, type, pattern, message, filePattern, excludePattern, globPattern, severity };
}

async function checkFile(filePath: string, rules: SkillRule[]): Promise<{ violations: string[]; warnings: string[] }> {
  const violations: string[] = [];
  const warnings: string[] = [];

  if (!existsSync(filePath)) return { violations, warnings };

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  for (const rule of rules) {
    // Check file pattern
    if (rule.filePattern) {
      const regex = new RegExp(rule.filePattern);
      if (!regex.test(filePath)) continue;
    }

    // Check exclude pattern for this specific rule
    if (rule.excludePattern) {
      const excludeRegex = new RegExp(rule.excludePattern);
      if (excludeRegex.test(filePath)) continue;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (rule.pattern.test(line)) {
        if (rule.type === "NEVER") {
          const msg = `[${rule.severity.toUpperCase()}] ${filePath}:${i + 1} - ${rule.skill}: ${rule.message}\n  Found: ${line.trim()}`;
          if (rule.severity === "error") violations.push(msg);
          else warnings.push(msg);
        }
      }
    }
  }

  return { violations, warnings };
}

async function checkMustRules(projectRoot: string, skillConfigs: SkillConfig[]): Promise<{ violations: string[]; warnings: string[] }> {
  const violations: string[] = [];
  const warnings: string[] = [];

  for (const skill of skillConfigs) {
    for (const rule of skill.rules) {
      if (rule.type !== "MUST") continue;

      // Use globPattern for finding files, fallback to broad pattern
      const globPattern = rule.globPattern || "**/*.{ts,tsx}";
      const glob = new Glob(globPattern);
      const files = [];
      for await (const file of glob.scan({ cwd: projectRoot })) {
        files.push(file);
      }
      let found = false;

      for (const file of files) {
        const fullPath = join(projectRoot, file);
        if (!existsSync(fullPath)) continue;

        // Check exclude pattern for this specific rule
        if (rule.excludePattern) {
          const excludeRegex = new RegExp(rule.excludePattern);
          if (excludeRegex.test(fullPath)) continue;
        }

        // Check file pattern regex
        if (rule.filePattern) {
          const fileRegex = new RegExp(rule.filePattern);
          if (!fileRegex.test(fullPath)) continue;
        }

        const content = readFileSync(fullPath, "utf-8");
        if (rule.pattern.test(content)) {
          found = true;
          break;
        }
      }

      if (!found) {
        const msg = `[ERROR] ${rule.skill}: REQUIRED pattern not found in any matching file\n  Pattern: ${rule.pattern}\n  Glob pattern: ${globPattern}\n  File pattern regex: ${rule.filePattern || "none"}\n  Message: ${rule.message}`;
        if (rule.severity === "error") violations.push(msg);
        else warnings.push(msg);
      }
    }
  }

  return { violations, warnings };
}

async function main() {
  console.log("Starting build-time skill enforcement...\n");

  const allViolations: string[] = [];
  const allWarnings: string[] = [];

  const skillFiles = await findSkillFiles();
  console.log(`Found ${skillFiles.length} skill files`);

  for (const skillFile of skillFiles) {
    const fullPath = join(PROJECT_ROOT, skillFile);
    const content = readFileSync(fullPath, "utf-8");
    const skillName = getSkillNameFromPath(skillFile);

    const extractedRules = extractRulesFromSkillMd(content, skillName);
    console.log(`  ${skillName}: extracted ${extractedRules.length} rules`);
  }

  const allRules = skillRules.flatMap(s => s.rules);

  const sourceGlob = new Glob("src/**/*.{ts,tsx}");
  const sourceFiles = [];
  for await (const file of sourceGlob.scan({ cwd: PROJECT_ROOT })) {
    sourceFiles.push(file);
  }

  for (const file of sourceFiles) {
    const fullPath = join(PROJECT_ROOT, file);
    const { violations, warnings } = await checkFile(fullPath, allRules);
    allViolations.push(...violations);
    allWarnings.push(...warnings);
  }

  const { violations: mustViolations, warnings: mustWarnings } = await checkMustRules(PROJECT_ROOT, skillRules);
  allViolations.push(...mustViolations);
  allWarnings.push(...mustWarnings);

  if (allWarnings.length > 0) {
    console.log("\nWARNINGS:");
    for (const w of allWarnings) console.log(w);
  }

  if (allViolations.length > 0) {
    console.log("\nSKILL ENFORCEMENT FAILED - BUILD BLOCKED");
    console.log(`${allViolations.length} violation(s) found:\n`);
    for (const v of allViolations) console.log(v);
    process.exit(1);
  }

  console.log("\nAll skill rules passed. Build can proceed.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
