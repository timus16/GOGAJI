---
name: security-audit
description: 'Use when reviewing code or design for security: leaked secrets or PII, injection (SQL/command/XSS), broken authz/authentication, SSRF, insecure deserialization, and dependency CVEs. Threat-models first, then audits and reports with evidence and fixes. Triggers on "security review", "audit", "check for secrets", "is this safe", "SSRF", "injection", "auth", "authorization", "CVE", "vulnerability", "OWASP".'
---

# Security Audit

Threat-model first, then look for the classes of bug that model predicts.

## When to use
- Reviewing a new feature, endpoint, or data flow before shipping.
- Auditing a codebase or dependency tree for known weaknesses.

## Workflow
1. Threat-model: what are the assets (secrets, PII, money, admin actions), who are the
   actors (anonymous, user, admin), and where are the trust boundaries (input edges,
   auth checks, external calls)? Use a short data-flow list.
2. Secrets/PII: `grep` for key-like patterns (`api[_-]?key`, `secret`, `token`,
   `password`, `BEGIN ... PRIVATE KEY`), check `.env` is git-ignored, and confirm no
   secret is logged or returned in responses.
3. Injection: check every query built from input (SQL/NoSQL), shell/exec calls,
   template/HTML rendering (XSS), and deserialization. Require parameterisation and
   output encoding; never string-concatenate untrusted data.
4. AuthN/AuthZ: verify authentication on every entry point and an authorization check
   on every object access (no IDOR). Confirm least privilege and deny by default.
5. SSRF/network: validate and allow-list outbound URLs; block internal/metadata
   addresses; bound timeouts and redirects.
6. Dependencies: run the ecosystem audit (`npm audit`, `bun audit`, `cargo audit`,
   `pip-audit`) and flag high/critical advisories with the fix version.
7. Report each finding with severity, `file:line`, impact, reproduction, and a concrete fix.

## Pitfalls
- Reviewing code without a threat model, so look-alikes are rated equally.
- Trusting client-side validation as a security control.
- Only checking the "front door" and missing object-level authorization.
- Logging secrets/tokens while "debugging", which persists them.
- Ignoring transitive dependencies when hunting CVEs.

## Verify
- Every finding cites `file:line` and states impact and fix.
- No secret, key, or PII is present in the tree or logs.
- Authz is checked per object, not just per route; inputs are parameterised/encoded.