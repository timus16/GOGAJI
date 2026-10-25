---
name: project-architect
description: 'Use when turning requirements into a concrete design before coding: choosing a stack, defining folder layout, API contracts, database schema, and milestones. Produces a buildable blueprint, not code. Triggers on "design the app", "choose a stack", "architect this", "plan the architecture", "define the schema", "API design", "greenfield project", "system design".'
---

# Project Architect

Convert a fuzzy requirement into a blueprint someone can implement without guessing.

## When to use
- Starting a new project or a substantial new subsystem.
- A request needs structural decisions (stack, schema, contracts) before coding.

## Workflow
1. Nail the requirements: users, core use cases, scale, latency, and explicit non-goals.
   Write them down; ambiguity here is the top source of rework.
2. Choose the stack by constraints, not taste: team familiarity, hosting, data shape,
   and the smallest tool that meets the load. Prefer boring, well-supported choices.
3. Define the folder layout and the responsibility of each top-level area. State where
   "source of truth" lives versus generated code.
4. Specify API contracts first (endpoints, request/response shapes, status codes, errors)
   and the database schema (tables, keys, indexes, relationships) with migrations.
5. Identify the risky / uncertain parts and spike them before committing to the design.
6. Break the build into milestones, each independently demoable, with acceptance criteria.
7. Record decisions as ADRs so the "why" survives; note rejected alternatives.

## Pitfalls
- Choosing technology before understanding the requirement.
- Designing in the abstract with no spike on the risky part.
- Schemas without keys/indexes or without a migration path.
- Contracts left implicit so frontend and backend diverge.
- Over-engineering for scale the project does not have.

## Verify
- Every requirement maps to a component, endpoint, or table.
- The schema and contracts are concrete enough to code against.
- Each milestone has a testable done-condition and the risky parts are de-risked.