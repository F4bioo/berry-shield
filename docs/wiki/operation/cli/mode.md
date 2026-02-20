---
summary: "CLI reference for `openclaw bshield mode` (set runtime mode to audit or enforce)"
read_when:
  - You need to switch Berry Shield runtime behavior
  - You are validating security behavior in audit vs enforce mode
title: "mode"
---

# `openclaw bshield mode`

Set Berry Shield runtime mode to `audit` or `enforce`.

## What it does
- Writes mode value to plugin config (`audit` or `enforce`).
- Validates mode argument before write.
- Returns explicit success or failure output.

## When to use
- Before security behavior tests.
- Before production hardening checks.
- When switching between observation and active protection workflows.

## Audit semantics (important)
- `audit` is shadow mode for block/redact decisions.
- `audit` does not mean "Berry Shield fully disabled" or "100 percent passive".
- Policy behavior (profile/adaptive injection strategy) still applies.
- Message hygiene safeguards can still apply (for example leaked policy-block stripping).

## Syntax
### Set enforce mode
Use this form for active blocking behavior.
```bash
openclaw bshield mode enforce
```
Expected: CLI confirms switch to ENFORCE mode.

### Set audit mode
Use this form for shadow behavior and monitoring.
```bash
openclaw bshield mode audit
```
Expected: CLI confirms switch to AUDIT mode.

## Options
Positional argument:
- `<mode>`: accepted values are `audit` or `enforce`.

## Examples

### Switch to enforce before deny tests
Use this before testing blocked behavior for sensitive operations.
```bash
openclaw bshield mode enforce
```
Result: Subsequent checks run under enforce behavior.

### Switch to audit for observation
Use this when validating policy behavior without active block expectations.
```bash
openclaw bshield mode audit
```
Result: Mode is set to audit for shadow-mode style verification.

### Confirm mode after switch
Use this to verify runtime state after mode change.
```bash
openclaw bshield status
```
Result: Status output mode field matches the last configured mode.

## Common errors

### Invalid mode value
Use this to see expected validation behavior for wrong input.
```bash
openclaw bshield mode monitor
```
Expected: CLI fails with message: invalid mode, use `audit` or `enforce`.

### Mode write failure
Use this when mode command reports operation failure.
```bash
openclaw bshield mode enforce
```
Expected: On failure, CLI prints operation failure and returns non-zero exit code.

Possible causes:
- Config write permission issue.
- Config backend/runtime error.

## Related commands
- [index](README.md)
- [status](status.md)
- [profile](profile.md)
- [policy](policy.md)

---

## Navigation

- [Back to CLI Index](README.md)
- [Back to Wiki Index](../../README.md)
