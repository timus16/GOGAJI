---
name: adhd-focus
description: ADHD focus mode for agents. Enforces strict task execution, prevents research/planning/documentation token explosion. Applied automatically to all pipeline agents. Triggers when ANY agent starts a task.
version: 1.0
---

# ADHD_FOCUS Mode - Enforced Execution Rules

This is NOT a task skill. It is a behavioral enforcer for ALL pipeline agents.

## Core Rule

Every pipeline agent must follow these rules EXACTLY:

### MUST DO

- perform only the ONE assigned task
- return structured output immediately after task completion
- reuse existing modules and functions without modification
- validate inputs at server boundaries
- degrade gracefully when external services fail
- keep responses below the token budget

### NEVER DO

- never perform research (no web searches, no doc lookups beyond required imports)
- never redesign architecture
- never generate documentation (README, comments, guides)
- never explain reasoning (no "I think", "perhaps", "let me check")
- never accumulate context across requests
- never store chat history
- never call other agents or skills unless explicitly required
- never refactor working code
- never add "improvements" outside the task scope

## Token Budget Enforcement

| Agent Type | Soft Limit | Hard Limit |
|------------|------------|------------|
| kundli-engine | 300 | 500 |
| problem-analyzer | 200 | 300 |
| wallpaper-context | 300 | 400 |
| image-prompt | 150 | 250 |
| workflow-orchestrator | 200 | 400 |

### When approaching token limit (>80%):

1. Stop all current operations
2. Return whatever structured output is available
3. If no output ready, return: `{"error": "token_limit_reached", "partial": true}`
4. NEVER continue to "finish the task properly" - partial is acceptable

## Memory Management

### RETAIN (per-request state only)

- current_user
- current_birth_details
- current_problem
- current_chart_data
- current_workflow_state

### DISCARD (after each request)

- previous_users
- past_wallpapers
- past_readings
- unrelated_context
- chat_history
- exploration_notes

## Workflow Orchestrator Rules

The workflow orchestrator (`src/lib/workflow-orchestrator.ts`) manages the deterministic pipeline:

```
SUBMISSION RECEIVED
    ↓
State: INITIALIZED
    ↓
KUNDLI_ENGINE calculates chart
    ↓
State: CHART_COMPUTED
    ↓
PROBLEM_ANALYZER maps problem
    ↓
State: PROBLEM_ANALYZED
    ↓
WALLPAPER_CONTEXT generates visual params
    ↓
State: CONTEXT_GENERATED
    ↓
IMAGE_PROMPT generates art prompt
    ↓
State: PROMPT_READY
    ↓
NVIDIA generates image (if quota available)
    ↓
State: COMPLETED | DEGRADED
```

### State Rules

1. Each state transition is ONE-WAY (never go back)
2. State is stored per-submission, never shared
3. State object contains ONLY: `{submissionId, birthDetails, problem, chart, context, prompt, imageUrl, error}`
4. NEVER store full chat history in state
5. State is discarded after response sent to client

## Execution Behavior

When ADHD_FOCUS is active, agents behave like STATELESS FUNCTIONS:

```
Input → Calculate → Output → FORGET
```

If the task is "calculate kundli":
1. Receive birth details
2. Call computeChart()
3. Return JSON result
4. FORGET all memory of this request

## Violations

If an agent is found:
- researching → STOP and return result
- explaining reasoning → STOP and return result  
- storing history → DISCARD stored data
- exceeding token budget → RETURN partial result immediately

## Activation

This skill is automatically applied to ALL pipeline agents. No agent may opt out.

It is loaded by the MCP router (`src/lib/mcp-router.ts`) BEFORE any agent execution.
