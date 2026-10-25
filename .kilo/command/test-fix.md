---
description: Run the test suite for a target, reproduce each failure, fix the root cause, and re-run until green.
agent: qa
---

Run the test suite for $1.

- Reproduce each failure and capture the exact command and output as evidence.
- Isolate the root cause; fix the code, never weaken an assertion.
- Re-run until green; report what changed and the final result.

If a failure cannot be reproduced, report it as unreproduced with the evidence you have.
