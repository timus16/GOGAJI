---
name: ai-wallpaper-composite
description: Use when working on the GOGAJI wallpaper request path — the WallpaperRequest contract, BYOK per-request provider keys, the focus-areas problem checklist, the banner/error tone, or the compositing of deterministic SVG chart art with NVIDIA AI artwork. Complements astrology-premium-service (pipeline) and regional-panchanga (pañchāṅga rules). Triggers on "WallpaperRequest", "BYOK", "bring your own key", "focus areas", "problem checklist", "all-in-one", "banner tone", "keys override".
---

# AI Wallpaper Composite (GOGAJI)

Operating contract for the wallpaper request path: what the client sends, how the
per-request keys and focus areas thread through the pipeline, and how failure is
presented. The pipeline itself is documented in
`astrology-premium-service/SKILL.md`; the pañchāṅga/regional rules in
`regional-panchanga/SKILL.md`.

## 1. The request contract

```ts
WallpaperRequest = BirthInput & {
  presetId?: string;   // style archetype; omitted => previous chart-only behaviour
  focusAreas?: string[]; // subset of the 8 LIFE_AREAS; empty/omitted = all
  keys?: { gemini?: string; openrouter?: string; nvidia?: string };
}
```

The client (`src/components/Generator.tsx`) sends exactly this shape; the server
(`src/server/ai.ts`) validates against it. No field outside the contract is sent.

## 2. Per-request keys (BYOK)

**Contract.** The user may type their own provider keys in the browser. They live
only in `localStorage` under `gogaji.keys`, ride along in `WallpaperRequest.keys`
per request, and override `process.env` for that single call via
`geminiKey(override)` / `openrouterKey(override)` / `nvidiaKey(override)`
(`src/lib/server-key.ts`). An absent/empty override falls back to the env key.

**Security rules (non-negotiable).**

- Keys are **NEVER persisted server-side** — not in a file, DB, cache, or log.
- **NEVER logged**, at any level, in any provider error path.
- **NEVER echoed** in responses, chart summaries, prompts, or error strings.
- They are used for the one call and dropped. Every response must be safe to
  inspect: if a key could appear anywhere in it, that is a bug.
- The UI collects them in masked inputs and sends them only when non-empty.

## 3. Focus areas (problem checklist)

The checklist "What should this wallpaper help with?" produces `focusAreas`, a
subset of the 8 `LIFE_AREAS` (`src/content/problems.ts`). **"All-in-one" means
all 8 areas.** Threading path:

1. `chartFactSheet(chart, assessment?, focusAreas?)` — relevant conditions move
   to the **front** of the fact sheet and a `Querent focus:` line is added, so
   the model reads the user's stated concern first.
2. `buildReadingPrompt(chartSummary, focusAreas?)` — adds a
   `QUERENT'S STATED FOCUS` line to the canonical prompt.
3. `promptFromBrief(reading, chartFacts, { focusAreas })` — injects **one
   thematic-mood sentence** into the NVIDIA art direction. The mood map:

| focusArea | Mood sentence theme |
|---|---|
| `wealth` | abundance |
| `relationships` | union |
| `health` | vitality |
| `protection` | shielding |
| `career` | ascending path |
| `education` | lamp of learning |
| `spiritual` | mandala stillness |
| `family` | hearth and roots |

While threading focus in, the `NO_TEXT_CLAUSE` in `src/lib/nvidia.ts`
("no readable text, no letters, no watermark, no lettering, no caption") **always
stays** — the deterministic renderer draws the Devanagari mantra and kundli on
top, so the model must never paint lettering of its own.

## 4. Banner-tone rule

Every failure, gate, or missing-key message is shown as **one calm amber line**
(`border-amber-500/25`, `bg-amber-500/10`, `text-amber-100` in
`src/components/Generator.tsx`) that always reassures and never alarms:

- name what still works: "The chart wallpaper above is complete."
- name what unlocks the rest: "Add your own AI keys to unlock the Vedic reading
  + premium artwork." (with a button that opens the BYOK panel), or a collapsed
  `<details>` for provider errors (truncated to 160 chars).
- The qualification gate (`shouldCallAI` in `src/lib/qualification.ts`) blocks
  with the same calm amber line. The deterministic wallpaper always renders;
  a blocked or failed AI step is never a page failure.
