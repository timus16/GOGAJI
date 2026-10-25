---
name: test-authoring
description: 'Use when designing or writing automated tests: unit, integration, or end-to-end (Playwright). Produces deterministic, evidence-first tests that assert real behaviour and fail for the right reason. Triggers on "write tests", "add a test", "unit test", "integration test", "e2e", "Playwright", "coverage", "test this function", "regression test".'
---

# Test Authoring

A test is only useful if it fails when the code is wrong and passes when it is right.

## When to use
- Adding coverage for new or existing behaviour.
- Encoding a bug as a regression test.
- Building an end-to-end flow check for a UI or API.

## Workflow
1. Discover the harness: read `package.json` scripts and find existing test files with
   `glob`/`grep`. Match the framework in use (bun test, vitest, jest, pytest, Playwright).
2. Choose the smallest level that proves the behaviour: unit for pure logic,
   integration for module boundaries, e2e only for user-visible flows.
3. Write the failing test first. Assert the specific observable output, not internals.
4. Make it deterministic: no real network, wall-clock, randomness, or ordering
   dependence. Inject clocks, seed RNG, stub external calls, use fixed fixtures.
5. Cover the happy path, one boundary, and one error/failure path.
6. For Playwright: prefer role/label selectors over CSS, wait for real conditions
   (text/appearance), never fixed sleeps. Reuse the browser the tool provides.
7. Run the suite and confirm each new test fails for the intended reason, then passes
   once the code is correct.

## Pitfalls
- Tests coupled to implementation details that break on any refactor.
- Hidden sleeps or arbitrary timeouts instead of waiting for state.
- Tests that pass whether or not the code is correct (no meaningful assertion).
- Shared mutable state between tests causing order dependence.
- Mocking so much that the test asserts the mock, not the code.

## Verify
- New tests fail on the pre-change code and pass after the change.
- The whole suite is green and repeatable on a clean run (`bun test` twice).
- No network, clock, or ordering dependence; no skipped-without-reason tests.