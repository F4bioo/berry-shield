---
summary: "CLI reference for `openclaw bshield toggle` (enable or disable one security layer)"
read_when:
  - You need to temporarily disable or re-enable one Berry Shield layer
  - You are debugging behavior at layer level
title: "toggle"
---

# `openclaw bshield toggle`

Toggle one Berry Shield security layer between enabled and disabled states.

## What it does
- Validates layer name against known layer keys.
- Reads current layer state (or uses default when config is missing).
- Writes the inverse state to config.
- Returns explicit success or failure output.

## When to use
- Isolated diagnostics for one layer.
- Controlled troubleshooting in non-production workflows.
- Temporary layer disable/enable during rule tuning.

## Syntax
### Toggle one layer
Use this to invert the current state of a selected layer.
```bash
openclaw bshield toggle <layer>
```
Expected: CLI confirms selected layer is now ENABLED or DISABLED.

## Options
Positional argument:
- `<layer>`: one of root, pulp, thorn, leaf, stem.

## Examples

### Toggle root layer
Use this when debugging root policy injection behavior.
```bash
openclaw bshield toggle root
```
Result: Root layer flips state and CLI confirms the new value.

### Toggle stem layer
Use this when isolating gate behavior during security tests.
```bash
openclaw bshield toggle stem
```
Result: Stem layer flips state and CLI confirms the new value.

### Verify layer states after toggle
Use this check after any toggle operation.
```bash
openclaw bshield status
```
Result: Security Layers section reflects ACTIVE or OFF for each layer.

## Common errors

### Invalid layer name
Use this to validate layer allowlist behavior.
```bash
openclaw bshield toggle kernel
```
Expected: CLI fails with message listing available layers.

### Toggle write failure
Use this when toggle command reports operation failure.
```bash
openclaw bshield toggle leaf
```
Expected: On failure, CLI prints operation failure and returns non-zero exit code.

Possible causes:
- Config write permission issue.
- Config backend/runtime error.

## Related commands
- [index](README.md)
- [status](status.md)
- [mode](mode.md)
- [policy](policy.md)
