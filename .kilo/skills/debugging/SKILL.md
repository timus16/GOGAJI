---
name: debugging
description: Use when something is broken, failing, or behaving unexpectedly and the cause is not yet known. Drives reproduce -> bisect/isolate -> root-cause -> fix -> prove-fix, and forbids guess-patching. Triggers on "it does not work", "bug", "error", "traceback", "fails", "crash", "regression", "why is this happening", "flaky test".
---

# Debugging

Find the cause before writing the fix. A fix without a cause is a guess.

## When to use
- A test, build, or runtime path fails or behaves unexpectedly.
- A regression appeared and you do not yet know which change caused it.

## Workflow
1. Reproduce deterministically. Get the smallest command, input, or test that fails
   every time. Capture the full error, stack trace, and exit code verbatim.
2. Read the error literally: file, line, and the actual value versus the expected value.
   Read the code at that location before hypothesising.
3. Form one falsifiable hypothesis at a time. Add a log or a temporary assertion to
   test it, then remove the probe once confirmed.
4. Isolate: narrow the input, the path, or the commit range. For regressions use
   `git bisect` or compare against the last known-good commit.
5. Fix the root cause, not the symptom. If you cannot explain why the fix works, keep digging.
6. Prove the fix: add or keep a test that fails before and passes after. Re-run the
   full failing suite plus the previously passing suite.

## Pitfalls
- Shotgun edits that change many things; you can no longer tell what fixed it.
- Catching/swallowing the exception so the symptom disappears without a cause.
- Assuming the bug is where the error is printed rather than where state went wrong.
- Fixing a flaky test by retrying instead of removing the nondeterminism.

## Verify
- The original failing command now passes, reproducibly.
- A regression test encodes the bug and fails on the pre-fix code.
- You can state the cause in one sentence and point to the exact line.