---
description: Run format, lint and tests, review git status, then commit a conventional message and push.
---

Ship the change described by $ARGUMENTS.

1. Run format/lint and the test suite; if any check fails, stop and report - do not commit.
2. Show git status and git diff; stage only the intended files.
3. Commit with a conventional message (for example feat: ...) describing $ARGUMENTS.
4. Push the current branch to its upstream.

Never force-push. Never commit secrets. Stop on failing checks.
