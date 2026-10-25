---
name: code-generation
description: Use when writing new code, functions, components, modules, or services from scratch, or when asked to implement a feature. Produces clean, production-grade code that matches the surrounding conventions, reuses existing utilities, and compiles/passes checks before being reported done. Triggers on "implement", "write a function", "add a feature", "scaffold", "create module", "new endpoint", "build this".
---

# Code Generation

Write code that looks like the code already there, then prove it runs.

## When to use
- Adding new files, functions, components, endpoints, or modules.
- Implementing a feature or behaviour described by the user.

## Workflow
1. Recon before writing: `glob` for sibling files, `grep` for the symbol or pattern you
   are about to add, and `read` one to three near neighbours to copy their idioms.
2. Confirm the stack from the manifest (`package.json`, `pyproject.toml`, `Cargo.toml`,
   `go.mod`). Never import a library the repo does not already depend on.
3. Reuse over reinvent: search for an existing helper before adding a new one; prefer the
   standard library and existing dependencies.
4. Write small, single-purpose units. Match indentation, quote style, export style and
   file naming exactly.
5. Validate at boundaries. Handle errors explicitly; never swallow them silently.
6. Keep the diff honest: no dead code, unused imports, commented-out blocks, or TODO stubs.
7. Run whatever the repo provides: formatter, linter and typecheck (`bun run lint`,
   `bun run typecheck`, `ruff`, `cargo check`, `tsc --noEmit`).

## Pitfalls
- Inventing an API: always read the real signature before calling it.
- Adding a dependency for something a few lines of stdlib would do.
- Copying a pattern from another project that does not fit this one.
- Reporting done without running the build or typecheck.

## Verify
- Linter, typecheck and any present tests pass; the build succeeds.
- The new path is exercised by a test or a direct `bun` / `node` invocation.
- `git diff` shows only the intended files.