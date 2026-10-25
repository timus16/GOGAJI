---
name: git-operations
description: 'Use when performing version-control work: checking status/diff, branching, staging, committing, merging, rebasing, stashing, reverting or recovering work. Protects uncommitted changes and never destroys work. Writes conventional commit messages. Triggers on "commit", "branch", "merge", "rebase", "stash", "revert", "git status", "undo my last change", "checkout".'
---

# Git Operations

Every git action is reversible only if you plan for the reversal first.

## When to use
- Inspecting state before or after edits (`status`, `diff`, `log`).
- Creating branches, committing, merging, rebasing, stashing, reverting.
- Recovering from a bad merge or a lost change.

## Workflow
1. Always start with `git status --short` and `git diff` so you know exactly what is
   uncommitted. Never run a mutating command blind.
2. Protect work first: if there are unrelated local changes, `git stash` (or a WIP
   commit) before switching branches or rebasing.
3. Stage deliberately: `git add <path>` per file; avoid `git add -A` when the tree is dirty.
4. Commit one logical change with a conventional message:
   `type(scope): imperative summary` (`feat`, `fix`, `refactor`, `docs`, `test`, `chore`).
   Keep the body to why, not what.
5. For history work, prefer `merge` over `rebase` on shared branches; never rebase
   commits already pushed to a shared branch without explicit instruction.
6. To undo safely: `git revert <sha>` for pushed commits; `git reset --soft` to
   uncommit but keep changes. Avoid `--hard` unless you truly mean to discard.
7. Only commit/push/PR when the user asked for it.

## Pitfalls
- `git checkout`/`git restore`/`git reset --hard` wiping uncommitted work.
- Force-pushing a shared branch.
- Committing secrets, `.env`, lockfile churn, or unrelated files.
- Mixing unrelated changes in one commit.
- Amending a push that hooks already rejected; make a new commit instead.

## Verify
- `git status` and `git log --oneline -5` show the intended result.
- Nothing untracked or modified that you did not intend remains.
- `git diff --stat` matches the described change, and the commit message matches repo style.