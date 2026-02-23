---
summary: "CLI reference for `openclaw bshield status` (runtime mode, policy, rules, and layers)"
read_when:
  - You need to verify current Berry Shield runtime configuration
  - You changed mode, profile, policy, or layers and want confirmation
title: "status"
---

# `openclaw bshield status`

Show the effective Berry Shield runtime state resolved from OpenClaw plugin config plus Berry defaults.

## What it does
- Reads plugin config from OpenClaw config storage.
- Merges config with Berry Shield defaults.
- Prints current plugin state (`Status`, `Mode`, and rule counters).
- Prints policy state (`Profile`, adaptive values, and global escalation toggle).
- Prints Vine state (`Mode`, thresholds, retention, and allowlist size).
- Prints each security layer status as `ACTIVE` or `OFF`.

## When to use
- After changing `mode`, `profile`, or `policy`.
- After toggling a layer.
- Before and after smoke tests to confirm runtime posture.
- During incident triage to verify what is effectively active.

## Syntax

### Base command
Use this command to inspect the full Berry Shield state.
```bash
openclaw bshield status
```
Expected: Output includes Status, Mode, Rules, Policy, Vine, and Security Layers sections.

## Options
This command has no command-specific flags or positional arguments.

## Output interpretation guide

### Status and mode
Command for this check: `openclaw bshield status`.
Result expected for an active deployment:
- `Status` should be `ENABLED`.
- `Mode` should be either `AUDIT` or `ENFORCE`, matching your intended test posture.

### Rules counters
Command for this check: `openclaw bshield status`.
Result expected:
- `Built-in` count represents baseline shipped protections.
- `Custom` count represents user-defined entries currently loaded.

### Policy section
Command for this check: `openclaw bshield status`.
Result expected:
- `Profile` is one of `STRICT`, `BALANCED`, `MINIMAL`.
- `Escalation`, `Stale (min)`, `Heartbeat`, and `Global Escalation` reflect configured values.

### Vine section
Command for this check: `openclaw bshield status`.
Result expected:
- `Mode` shows Vine behavior (`BALANCED` or `STRICT`).
- Thresholds and retention values match expected operational tuning.
- `Allowlist` shows the number of exempt tools.

### Security layers section
Command for this check: `openclaw bshield status`.
Result expected:
- Each layer is explicitly shown as `ACTIVE` or `OFF`.
- Use this as the authoritative source before any behavior validation run.

## Common errors

### Status command fails due to config read error
Use this check when the status command exits with operation failure.
Expected: CLI prints a failure message and returns non-zero exit code.

Possible causes:
- OpenClaw config path is unavailable or corrupted.
- Runtime permission issue when reading config.
- Unexpected config wrapper/backend failure.

### Output does not reflect a recent change
Use this check when you changed config in Web or CLI but output still looks stale.
Expected: after OpenClaw restarts its gateway, `status` reflects the new effective values.

Possible causes:
- Gateway restart has not happened yet.
- You edited a different environment/root than the active OpenClaw runtime.
- Another write operation overwrote your previous setting.

## Related commands
- [index](README.md)
- [mode](mode.md)
- [profile](profile.md)
- [policy](policy.md)
- [vine](vine.md)

---

## Navigation
- [Back to CLI Index](README.md)
- [Back to Wiki Index](../../README.md)
