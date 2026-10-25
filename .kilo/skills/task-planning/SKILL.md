---
name: task-planning
description: 'Use when a goal is large, multi-step, or spans several areas and needs to be decomposed before work starts: waves, dependencies, owners, and acceptance criteria. Produces an ordered plan with testable done-conditions. Triggers on "plan this", "break this down", "how should we approach", "milestones", "roadmap", "work breakdown", "sequence the work".'
---

# Task Planning

Decompose a goal into waves that can start, finish, and be verified independently.

## When to use
- A request that touches many files, modules, or roles.
- Anything that will take more than one focused session.

## Workflow
1. Restate the goal as a concrete outcome ("X works for Y when Z"), not an activity.
2. List acceptance criteria first: each must be observable and testable
   ("GET /health returns 200", "tests pass", "bundle < 250 kB").
3. Inventory the work as tasks. Each task is one owner-sized unit with: input,
   output, and a done-condition.
4. Map dependencies: which tasks block which. Anything with no blockers is wave 1.
5. Group into waves so tasks within a wave do not touch the same files and can run in
   parallel; serialise anything sharing a file or a resource.
6. Order for early risk: do the uncertain or high-blast-radius work first.
7. Define checkpoints between waves where the result is validated before the next starts.
8. Record the plan in the tracked format (goal/plan file or issue) so it survives context loss.

## Pitfalls
- Planning activities instead of outcomes; no way to tell when a task is done.
- Parallelising tasks that edit the same file (merge conflicts, lost work).
- Hiding a huge task instead of splitting it; a task should fit one focused pass.
- No verification step, so failure is only discovered at the end.

## Verify
- Every task has an owner and a testable done-condition.
- The dependency graph has no cycle; every wave is internally conflict-free.
- Acceptance criteria can each be checked by a specific command or observation.