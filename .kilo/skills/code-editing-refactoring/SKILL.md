---
name: code-editing-refactoring
description: 'Use when modifying existing code rather than adding new files: renaming symbols, extracting or inlining functions, restructuring, simplifying, or optimizing a working module. Enforces minimal diffs, behaviour preservation, and verification after every edit. Triggers on "refactor", "rename", "extract method", "inline", "clean up", "simplify", "restructure", "optimize this code", "reduce duplication".'
---

# Code Editing & Refactoring

Change the shape of code without changing what it does, in the smallest diff that works.

## When to use
- Renaming a symbol, variable, file, or parameter.
- Extracting, inlining, moving, or merging functions and modules.
- Removing duplication or dead branches in working code.

## Workflow
1. Establish the blast radius: `grep` every reference to the symbol or file you intend to
   change before touching it. Count call sites.
2. Read the full unit and its tests; confirm what behaviour must be preserved.
3. Make the smallest edit that achieves the goal. One logical change per edit.
4. For a rename, update every reference in the same pass; never leave a half-renamed repo.
5. After each edit, run the formatter, typecheck and the covering tests before moving on.
6. Review the diff with `git diff` and confirm it contains nothing unrelated.
7. Keep refactors and behaviour changes in separate commits/steps, never mixed.

## Pitfalls
- Refactoring and adding a feature at the same time; reviewers and tests cannot tell them apart.
- Renaming via search-and-replace that also hits strings, comments, or unrelated names.
- Changing public signatures without updating every caller and the tests.
- "While I am here" edits that inflate the diff and hide the real change.

## Verify
- Tests that passed before still pass; behaviour is unchanged unless intended.
- The old name/pattern no longer appears (`grep` returns nothing, or only the intended new use).
- `git diff` is minimal and self-explanatory.