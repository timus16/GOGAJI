---
name: multi-agent-orchestration
description: Use when a large task should be split across multiple roles or worker agents (architect, backend, frontend, qa, devops) that work in parallel. Plans non-conflicting waves, assigns owners, sets contracts between them, and defines integration and review gates. Triggers on "split the work", "multiple agents", "parallelize", "orchestrate", "assign tasks", "team of agents", "divide and conquer".
---

# Multi-Agent Orchestration

Split the work so parallel agents never step on each other, then integrate deliberately.

## When to use
- A task is large enough to benefit from concurrent specialist workers.
- Distinct skill areas (design, backend, frontend, QA, infra) are involved.

## Workflow
1. Decompose into outcomes and assign a role to each: architect (design/contracts),
   backend, frontend, qa, devops. Use `task-planning` for the breakdown.
2. Freeze the interfaces first: API contracts, schemas, shared types, and file
   boundaries. Consumers can build against the contract before the provider finishes.
3. Partition files so no two waves edit the same file. Assign explicit ownership;
   conflicts come from shared files, so eliminate sharing up front.
4. Order into waves: wave 1 has no internal dependencies; a wave starts only when its
   blockers are integrated.
5. Give each worker a scoped prompt: goal, inputs, exact deliverable, done-condition,
   and what it must not touch. Independent workers should not depend on peer chatter.
6. Integrate after each wave: pull results together, run the full build/tests on the
   merged state, resolve conflicts once, in one place.
7. Gate with QA and review before the next wave or release.

## Pitfalls
- Two agents editing one file; last writer wins and work is lost.
- Letting workers invent interfaces that then do not match at integration.
- Coupling workers so tightly they cannot proceed independently.
- Integrating without a full-tree verification after the merge.
- Duplicated scaffolding each worker builds separately.

## Verify
- No file is owned by more than one concurrent worker.
- Every interface was fixed before its consumers started.
- The merged result builds and passes tests, and each deliverable meets its done-condition.