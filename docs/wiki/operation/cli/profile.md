---
summary: "CLI reference for `openclaw bshield profile` (set policy profile to strict, balanced, or minimal)"
read_when:
  - You need to change policy behavior quickly without editing individual policy paths
  - You want to standardize profile setup before security tests
title: "profile"
---

# `openclaw bshield profile`

Set the Berry Shield policy profile to `strict`, `balanced`, or `minimal`.

## What it does
- Validates profile argument against allowed values.
- Writes profile into policy config path.
- Returns explicit success or failure output.

## When to use
- When switching between policy behavior presets.
- Before adaptive behavior validation.
- When setting a consistent baseline in scripts.

## Syntax
### Set strict profile
Use this profile when full policy injection is required each turn.
```bash
openclaw bshield profile strict
```
Expected: CLI confirms switch to STRICT profile.

### Set balanced profile
Use this profile as the default operating baseline.
```bash
openclaw bshield profile balanced
```
Expected: CLI confirms switch to BALANCED profile.

### Set minimal profile
Use this profile when low-noise behavior is preferred.
```bash
openclaw bshield profile minimal
```
Expected: CLI confirms switch to MINIMAL profile.

## Options
Positional argument:
- `<profile>`: accepted values are `strict`, `balanced`, `minimal`.

## Examples

### Apply balanced profile for standard operation
Use this before routine enforce-mode workflows.
```bash
openclaw bshield profile balanced
```
Result: Policy profile is set to balanced.

### Verify profile after update
Use this check immediately after profile changes.
```bash
openclaw bshield status
```
Result: Policy section shows the selected profile in uppercase.

## Common errors

### Invalid profile value
Use this to validate input checking behavior.
```bash
openclaw bshield profile advanced
```
Expected: CLI fails with an invalid profile message listing supported values.

### Profile write failure
Use this when profile update reports operation failure.
```bash
openclaw bshield profile strict
```
Expected: On failure, CLI prints operation failure and returns non-zero exit code.

Possible causes:
- Config write permission issue.
- Config backend/runtime error.

## Related commands
- [index](README.md)
- [policy](policy.md)
- [status](status.md)
- [mode](mode.md)
