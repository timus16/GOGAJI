---
name: terminal-execution
description: Use when you need to run shell commands, install packages, start or manage long-running processes (dev servers, watchers), capture logs, or diagnose command failures. Covers Windows PowerShell versus POSIX differences and safe handling of processes that outlive a turn. Triggers on "run the command", "start the server", "install dependencies", "why did this fail", "check the build", "npm install", "bun install", "PowerShell".
---

# Terminal Execution

Run commands deliberately, capture their output, and never lose a running process.

## When to use
- Running build, lint, test or install commands.
- Starting a dev server, watcher, or any command that does not exit.
- Diagnosing a non-zero exit code or empty/odd output.

## Workflow
1. Know the shell: this environment is Windows PowerShell 5.1. No `&&`; chain with
   `cmd1; if ($?) { cmd2 }`. Use the call operator `&` for paths with spaces.
2. Prefer the repo's own scripts (`bun run dev`, `npm test`) over ad-hoc invocations.
3. For anything that finishes on its own (build, test, deploy), use a monitored
   background call and read its output; do not poll with repeated checks.
4. For anything that must keep running (server, watcher), start it as a background
   process with a readiness probe (`ready.port` or `ready.pattern`), then read logs.
5. Capture failures fully: exit code, stderr, and enough context. Quote paths and
   avoid destructive globs.
6. Long commands need an explicit timeout; set it rather than letting the default cut off.

## Pitfalls
- Using POSIX syntax (`&&`, `export`, forward-slash paths) in PowerShell.
- Backgrounding with `&`, `nohup`, `Start-Process`, `disown` instead of the process tool.
- Assuming a command succeeded without checking the exit code.
- Re-running an install that mutates a lockfile without intending to.
- Letting a started server keep a port occupied across reruns.

## Verify
- Exit code is zero, or the failure is quoted verbatim with its cause.
- A started server answers on its port (or prints its ready line) before you proceed.
- Install/upgrade changed the lockfile only when intended; `git status` confirms.