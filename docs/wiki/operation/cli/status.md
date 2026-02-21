---
summary: "CLI reference for `openclaw bshield status` (runtime mode, policy, rules, and layers)"
read_when:
  - You need to verify current Berry Shield runtime configuration
  - You changed mode, profile, policy, or layers and want confirmation
title: "status"
---

# `openclaw bshield status`

Show the current Berry Shield state resolved from plugin config plus defaults.

## What it does
- Reads plugin config from OpenClaw config storage.
- Merges config with Berry Shield defaults.
- Shows current mode, rule counts, and plugin enabled state.
- Shows policy values (profile and adaptive settings).
- Shows active/inactive state for each security layer.
- Includes Vine layer state (`Vine (External Guard)`) when available.

## When to use
- After changing mode or profile.
- After editing policy values with wizard or deterministic set.
- Before running security validation tests.

## Syntax
### Base command
Use this command to inspect the full Berry Shield state.
```bash
openclaw bshield status
```
Expected: Output includes Status, Mode, Rules, Policy, and Security Layers sections.

## Options
This command has no command-specific flags or positional arguments.

## Examples

### Verify plugin is enabled and in enforce mode
Use this check before running deny/block tests.
```bash
openclaw bshield status
```
Result: Status is ENABLED and mode shows ENFORCE when enforce mode is active.

### Verify policy values after profile update
Use this after changing profile or adaptive settings.
```bash
openclaw bshield status
```
Result: Policy section reflects current profile, escalation turns, stale timeout, heartbeat, and global escalation.

### Verify layer state after toggle
Use this after toggling one layer for diagnostics.
```bash
openclaw bshield status
```
Result: Security Layers section shows ACTIVE or OFF for each layer.
This includes Root, Pulp, Thorn, Leaf, Stem, and Vine.

## Common errors

### Status command fails due to config read error
Use this check when status command exits with operation failure.
```bash
openclaw bshield status
```
Expected: On failure, the CLI prints a failure message and returns non-zero exit code.

Possible causes:
- OpenClaw config path is unavailable or corrupted.
- Runtime permission issue when reading config.
- Unexpected config wrapper/backend failure.

## Related commands
- [index](README.md)
- [mode](mode.md)
- [profile](profile.md)
- [policy](policy.md)

---

## Navigation

- [Back to CLI Index](README.md)
- [Back to Wiki Index](../../README.md)
