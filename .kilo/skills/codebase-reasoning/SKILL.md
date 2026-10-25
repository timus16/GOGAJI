---
name: codebase-reasoning
description: 'Use when you need cross-module analysis rather than a single-file edit: finding duplicate logic, tracing a symbol across many files, locating dead or unreachable code, or reasoning about the call/dependency graph. Combines grep, glob, semantic search and AST/graph tools. Triggers on "find all usages", "where is this used", "duplicate logic", "dead code", "unused export", "trace the call chain", "impact analysis", "cross-module".'
---

# Codebase Reasoning

Reason across the whole tree, then narrow to the exact lines that matter.

## When to use
- A change's impact spans many files and you must find every touch point.
- Hunting duplication, dead code, or an inconsistency repeated across modules.

## Workflow
1. Define the exact question ("who calls `parseConfig`, and do they all handle errors the
   same way?") before searching.
2. Locate candidates with `grep` for the literal symbol and `semantic_search` for
   behaviour when the name is unknown. Use `glob` to scope by extension or directory.
3. Build the graph: for each hit, note caller -> callee and data in/out. Prefer tooling
   (AST parser, `tsc`/`madge`-style graph, language server) over eyeballing when available.
4. Cluster duplicates by semantics, not text: two functions doing the same thing with
   different names are still duplicates. Diff their behaviour, not just their bodies.
5. For dead code, prove unreachability: no calls, no dynamic references, no external
   entry point (exported API, route, CLI, config hook). Grep strings and reflection too.
6. Summarise findings with `file:line` evidence and a recommended action per cluster.

## Pitfalls
- Grepping only the obvious name and missing aliases, re-exports, or dynamic dispatch.
- Declaring code dead when it is reached via reflection, DI, routes, or an external API.
- Trusting text similarity: near-identical bodies may have different side effects.
- Reading whole files instead of the matched regions.

## Verify
- Every usage/inconsistency claim cites `file:line`.
- A "dead" verdict survives greps for strings, exports, and config references.
- Duplicate clusters were compared by behaviour; the merge is safe and stated.