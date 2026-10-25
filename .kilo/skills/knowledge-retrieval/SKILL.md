---
name: knowledge-retrieval
description: 'Use when you need information from outside the current file: official docs, GitHub source/issues, RFCs, Stack Overflow, or other project files, and must cite where it came from. Follows a retrieve -> verify -> cite workflow in a RAG style. Triggers on "look up", "find docs", "search the web", "how does X work", "check GitHub", "cite sources", "external documentation", "reference".'
---

# Knowledge Retrieval

Retrieve, verify against a primary source, and cite. Never present recall as a source.

## When to use
- An API behaviour, error, or specification is not in the repo.
- You need to confirm a claim against official documentation or upstream source.

## Workflow
1. Prefer local truth first: `grep`/`read` the repo; the installed version's own
   docs, types, or source beat the internet.
2. If external, go to a primary source (official docs, the upstream repo, the RFC,
   the actual source file) before secondary content (blog posts, Q&A sites).
3. Form the query around exact identifiers, error strings, or version numbers.
4. Read the source and extract the specific answer; check the version it applies to,
   since APIs change between releases.
5. Verify the claim against a second independent source when it is load-bearing, or
   test it locally.
6. Report the answer with citations (URL or `file:line`), the version/date, and any
   uncertainty. Distinguish what you verified from what you inferred.

## Pitfalls
- Answering from memory and dressing it as a citation.
- Using stale docs for a version the project does not run.
- Quoting a secondary source over the primary specification.
- Ignoring conflicting sources instead of surfacing the disagreement.
- Fabricating URLs or line numbers.

## Verify
- Every load-bearing claim has a real, checkable citation.
- The cited version matches the project's actual version.
- Uncertainty and any conflict between sources are stated explicitly.