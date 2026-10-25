---
name: cost-optimization
description: 'Use when reducing the cost of a system or of the agent''s own work: token/API spend, model choice, caching, batching, rate limits, and compute. Defines budgets and measures before and after. Triggers on "too expensive", "reduce cost", "token usage", "API spend", "caching", "batching", "rate limit", "cheaper model", "optimize costs", "budget".'
---

# Cost Optimization

Measure spend, find the dominant term, cut it without losing correctness.

## When to use
- API/token/compute spend is too high or unbounded.
- Designing a feature where cost per request matters.

## Workflow
1. Measure first: find where cost is actually incurred (which call, per request, per
   token, per compute-hour). An unmeasured "optimization" is a guess.
2. Set an explicit budget: per request, per session, and per day. Make exceeding it
   fail safe (degrade), not fail open (spend).
3. Attack the dominant term:
   - Model choice: use the smallest model that meets quality; escalate only when needed.
   - Prompt/context: trim context, summarise history, avoid resending large blobs.
   - Caching: memoise deterministic results and cache provider responses by content hash.
   - Batching: group independent calls; parallelise where it lowers overhead.
   - Rate limits: cap concurrency and retries with backoff to avoid runaway loops.
4. Prefer local/deterministic computation over paid inference when it is equivalent.
5. Re-measure after each change; keep only changes that actually reduce cost without
   regressing quality or latency beyond the acceptable bound.
6. Make cost observable: log usage per call and surface it, so regressions are visible.

## Pitfalls
- Optimising without a baseline; you cannot prove a win.
- Trimming context that the task needed, trading cost for wrong answers.
- Caching non-deterministic or user-specific results and serving stale data.
- Retry storms that multiply cost on failure.
- Downgrading the model below the quality the task requires.

## Verify
- Before/after numbers for cost (tokens, calls, billable units) and quality/latency.
- Budgets are enforced and degrade gracefully when exceeded.
- Caches are keyed correctly and invalidate when inputs change.