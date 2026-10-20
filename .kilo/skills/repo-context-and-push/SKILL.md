---
name: repo-context-and-push
description: Use when starting work in an unfamiliar or partially-understood git repository, or when the user asks to commit, push, or ship changes to GitHub. Rapidly reconstructs repo context (structure, stack, conventions, git state) with minimal reads, then performs a safe commit and push. Triggers on "get context", "orient yourself in this repo", "commit and push", "ship it", "push to github", "commit this".
---

# Repo Context & Push

Repo-agnostic. Works in any git repo — detect the layout, never assume it.
Two phases, in order: **CONTEXT** (cheap → precise), then **SHIP** (clean → pushed).

## 1. Context acquisition ladder

Cheapest reads first. Climb only while the plan is still ambiguous.

### 1a. Git state — one cheap batch

```bash
git status --short          # what changed, what is untracked
git log --oneline -10       # recent work, message style
git branch -vv              # current branch + upstream
git remote -v               # remote name + URL
git diff --stat             # size of the working change
```

Read all five in one shot. Gives: what changed, how this repo writes commit messages, where
you are, where you push, how big the change is. Zero file bodies.

### 1b. Manifest + convention doc only

- Manifest: `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Gemfile`, `composer.json`, `*.csproj`
- Conventions: `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `SITE.md`

These two give stack, scripts, entry points and house style in the fewest tokens. Still no source.

### 1c. Map the tree WITHOUT reading file bodies

```bash
git ls-files | head -100
git ls-files | awk -F/ 'NF>1{print $1"/"$2}' | sort | uniq -c | sort -rn | head -30
```

Or a directory listing, or a glob of source extensions. Group the list by directory and infer
architecture from the **shape**:

| Shape | Likely architecture |
|---|---|
| `routes/` + `components/` + `lib/` + `server/` | full-stack app: route-driven UI + domain lib + server-only code |
| `src/<feature>/` | feature-folder layout |
| `app/` + `api/` | app-router framework (Next-style) |
| `cmd/` + `internal/` + `pkg/` | Go service |
| `packages/*/src` | monorepo / multi-package |

Worked example (this repo) — never carry it to another repo: `src/lib/*` = domain logic
(the source of truth), `src/content/*.ts` = data tables, `src/routes/*` = routes,
`src/components/*` = UI, `src/server/*` = server-only, `scripts/` = validation utilities.

### 1d. Read AT MOST 3–5 files

Pick by value: entry point → main module of the area you are touching → the exact file the
task names → (optional) the type/schema file → (optional) the covering test.

**Grep first, then read a region.** Search symbols and patterns with `grep`/`glob`/
`semantic_search`; then read only the matched region using `offset`/`limit`. Never read a
1000-line file whole.

### 1e. Hard rules

- Prefer `grep`/`glob`/`semantic_search` over full-file reads.
- NEVER read: lockfiles (`bun.lock`, `package-lock.json`, `Cargo.lock`), minified bundles,
  `dist/`, `build/`, `node_modules/`, `.next/`, generated files (`routeTree.gen.ts`, `*.pb.go`),
  binary assets, `.env`.
- Do not dump whole directories into context to "see what is there".
- Stop as soon as the plan is unambiguous. Extra reads are waste.
