---
summary: "Decision model for audit and enforce runtime behavior, and how mode interacts with profile/adaptive policy"
read_when:
  - You need to reason about allow/block/redact outcomes
  - You are validating audit vs enforce behavior in real runs
  - You are debugging mismatches between expected and observed security outcomes
title: "modes"
---

# `modes`

This page defines how Berry Shield runtime mode affects security decisions.

## What this page defines

- What `audit` means in decision paths.
- What `enforce` means in decision paths.
- How mode differs from profile.
- How adaptive triggers interact with mode.
- Which outcomes to expect in common scenarios.

## Mental model

Mode answers this question:

**After risk is detected, should the system only record intent, or actively mitigate?**

- `audit` is observation-first posture.
- `enforce` is mitigation-first posture.

Mode does not define how frequently policy text is injected into agent context.  
That belongs to profile/adaptive policy behavior.

## Decision order (runtime perspective)

1. A layer intercepts an operation or message.
2. The layer extracts match candidates (path, command, output text, etc.).
3. Rule matching determines whether risk is present.
4. Mode determines whether matched risk is recorded-only or actively mitigated.
5. The layer emits decision outcomes (for example would_block, blocked, would_redact, redacted) according to mode and path.

## Mode behavior

### audit

In audit mode, risk matches are treated as observable events.

Expected behavior pattern:
- decision events are still produced and logged
- operation flow generally continues
- outputs generally remain unblocked by mode-level mitigation

Important clarification:
- audit is **shadow mode for block/redact mitigation paths**
- audit is **not** "plugin fully passive"
- policy-injection strategy (full/short/none) still follows profile/adaptive settings
- message hygiene guards can still run (for example stripping leaked `<berry_shield_policy>` snippets)

Audit mode is useful for:
- measuring policy impact before hard enforcement
- understanding false-positive surface
- collecting decision evidence for rule tuning

### enforce

In enforce mode, risk matches are treated as active mitigation points.

Expected behavior pattern:
- risky operations may be denied before execution
- risky output may be redacted before delivery
- decision events reflect active mitigation outcomes

Enforce mode is useful for:
- production workloads
- safety-critical environments
- workflows where prevention is required, not only observation

## Mode vs profile

Mode and profile solve different problems:

- Mode (`audit | enforce`) controls **mitigation posture** after risk is detected.
- Profile (`strict | balanced | minimal`) controls **policy-injection strategy** in agent context.

These controls are complementary:
- Changing profile does not change mode identity.
- Changing mode does not change profile strategy.

## Adaptive trigger interaction

Adaptive triggers (for example denied-based escalation windows and stale-based reinjection windows) change policy-injection intensity over time.

They do not redefine runtime mode.

Practical implication:
- You can have `enforce + minimal` (active mitigation with quieter injection strategy).
- You can have `audit + strict` (strong policy-injection strategy with observation-first mitigation posture).

## Layer mapping (mode behavior by layer)

### Stem (security gate tool)
- audit: emits would_block events and allows flow to continue.
- enforce: emits blocked events and returns denied outcomes.

### Thorn (before_tool_call hook)
- audit: emits would_block events and does not hard-block the call.
- enforce: emits blocked events and returns block response.

### Vine (external-content trust guard)
- audit: records trust-risk outcomes as would_block without hard-block.
- enforce: can block sensitive actions when external-risk state is active.

### Pulp (output scanner hooks)
- audit: emits would_redact events and preserves content for observation paths.
- enforce: emits redacted events and returns redacted content.

### Message policy-block hygiene
- outgoing message sanitation may still strip leaked `<berry_shield_policy>` snippets as a hygiene guard.
- this is not equivalent to full secret redaction behavior.

## Scenarios

### Scenario A: mode=enforce, profile=balanced

- operation hits a risky match
- runtime can actively deny/redact
- policy injection follows balanced adaptive strategy

Use case: default recommended operational baseline.

### Scenario B: mode=audit, profile=strict

- operation hits a risky match
- runtime records decision outcomes as audit evidence
- policy injection remains strong/explicit by profile strategy

Use case: pre-enforcement tuning with high policy visibility.

### Scenario C: mode=enforce, profile=minimal

- operation hits a risky match
- runtime can still deny/redact
- policy injection stays low-noise unless adaptive triggers escalate

Use case: low-noise interaction with active safety barriers.

## Limits and non-goals

- Mode behavior is constrained by available runtime hooks.
- Hook availability/timing can affect when mitigation is observable.
- Mode does not provide host-level sandboxing or kernel isolation.
- Mode should not be interpreted as complete exploit prevention.

## See CLI

For operational command usage:
- [CLI mode command](../operation/cli/mode.md)
- [CLI status command](../operation/cli/status.md)
- [CLI profile command](../operation/cli/profile.md)
- [CLI policy command](../operation/cli/policy.md)

## Related pages

- [decision index](README.md)
- [patterns](patterns.md)
- [security posture](posture.md)
- [stem layer](../layers/stem.md)
- [thorn layer](../layers/thorn.md)
- [vine layer](../layers/vine.md)
- [pulp layer](../layers/pulp.md)

---

## Navigation

- [Back to Decision Index](README.md)
- [Back to Wiki Index](../README.md)
