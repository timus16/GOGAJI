---
name: documentation-authoring
description: 'Use when writing or updating project documentation: README files, architecture notes, ADRs, changelogs, setup guides, or API references. Keeps docs accurate to the code, with runnable examples and a clear audience. Triggers on "write a README", "document this", "ADR", "architecture doc", "changelog", "update the docs", "add a guide".'
---

# Documentation Authoring

Docs that drift from the code are worse than no docs. Verify every claim.

## When to use
- A new project, feature, or decision needs a written record.
- Existing docs no longer match behaviour.

## Workflow
1. Identify the reader and their task: newcomer setup, API consumer, or future
   maintainer weighing a decision. Write to that one audience per document.
2. For a README: what it is (one line), why, install, minimal runnable usage
   example, configuration, testing, licence. Keep the happy path first.
3. For an ADR: title, status, context, decision, consequences, alternatives
   considered. One decision per file, dated and numbered.
4. For a changelog: group by `Added / Changed / Fixed / Removed`, newest first,
   link to the PR or commit. Follow Keep-a-Changelog conventions.
5. Every command and code sample must be copied from something that runs. Execute
   it once to confirm, or mark it explicitly as illustrative.
6. Keep docs next to the code they describe; update them in the same change as the code.

## Pitfalls
- Copy-pasted examples with stale flags, imports, or paths.
- Documenting intended behaviour that is not implemented.
- Wall-of-text with no runnable quickstart.
- Burying the one fact the reader came for under preamble.

## Verify
- All commands/paths in the doc were run or read from the actual source.
- Links resolve; referenced files and symbols exist.
- A reader can go from clone to running using only the doc.