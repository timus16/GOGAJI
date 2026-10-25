---
name: repo-understanding
description: Use when starting work in a large, unfamiliar, or partially-understood codebase and you need to reconstruct its structure, stack, conventions, entry points and data flow before changing anything. Cheapest-reads-first orientation. Triggers on "understand this repo", "how is this project structured", "where does X live", "orient yourself", "map the codebase", "explore this project".
---

# Repo Understanding

Build an accurate mental model fast, spending the fewest tokens possible.

## When to use
- First contact with a repo, or returning after time away.
- Before any non-trivial edit, to locate the right module and conventions.

## Workflow
1. State and stack in one cheap batch:
   ```bash
   git ls-files | head -100
   git log --oneline -10
   ```
   Then read only the manifest (`package.json`, `pyproject.toml`, `go.mod`,
   `Cargo.toml`) and one convention doc (`README.md`, `AGENTS.md`, `CONTRIBUTING.md`).
2. Infer architecture from the tree shape without reading bodies:
   ```bash
   git ls-files | awk -F/ 'NF>1{print $1"/"$2}' | sort | uniq -c | sort -rn | head -30
   ```
3. Find the entry point(s) and trace one real request/flow end to end using `grep`
   for the symbol and `read` on matched regions only.
4. Identify conventions: test layout, naming, error handling, config loading, state
   ownership. Note the "source of truth" modules versus generated ones.
5. Write down a short map (areas -> responsibility -> key files) before editing.

## Pitfalls
- Reading whole directories or 1000-line files to "see what is there".
- Reading lockfiles, `dist/`, `build/`, `node_modules/`, minified or generated files.
- Assuming a framework layout from the folder name alone.
- Leaving orientation as a mental model without writing it down.

## Verify
- You can name each top-level area and its responsibility.
- You can point to the file that owns the specific behaviour you were asked about.
- Any claim about the stack is backed by the manifest, not a hunch.