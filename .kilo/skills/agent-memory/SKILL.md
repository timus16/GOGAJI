---
name: agent-memory
description: 'Use when durable project context must be captured or reused across sessions: goals, house style, architecture decisions, and user preferences. Keeps a concise, curated memory so later work does not re-derive it or contradict it. Triggers on "remember this", "project conventions", "our preferences", "style guide", "persist context", "reuse decisions", "what did we decide".'
---

# Agent Memory

Store the few facts that change future decisions, not a transcript.

## When to use
- A durable decision, convention, or preference emerges that later work must respect.
- Starting a session and loading standing context from the repo's convention files.

## Workflow
1. On start, load memory from the tracked source of truth first: `AGENTS.md`, `README.md`,
   existing `.kilo/skills/`, and any project memory file. Read before assuming.
2. Capture only durable, decision-changing facts:
   - Goals and non-goals.
   - House style (language, formatting, naming, error shape).
   - Architecture decisions and the "source of truth" modules.
   - User preferences (tone, verbosity, forbidden actions).
3. Write each as a short, dated statement with the reason, in the project's memory
   location. Prefer editing an existing entry over appending a near-duplicate.
4. Keep it curated: prune stale or superseded entries; a wrong memory is worse than none.
5. Before a decision that memory might cover, re-read the relevant entry rather than
   relying on recall.
6. Never store secrets, keys, tokens, PII, or anything the user asked you to forget.

## Pitfalls
- Hoarding everything; memory bloat makes the right fact hard to find.
- Recording ephemeral task state that will be stale next session.
- Letting memory contradict the code without reconciling the two.
- Storing or logging credentials.

## Verify
- Each entry is durable, concise, and decision-relevant.
- No conflicts between entries, or with `AGENTS.md` / existing skills.
- Reloading memory reproduces the same guidance a reader of the repo would infer.