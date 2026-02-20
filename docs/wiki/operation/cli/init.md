---
summary: "CLI reference for `openclaw bshield init` (initialize Berry Shield plugin config)"
read_when:
  - You are enabling Berry Shield in a new environment
  - You need to restore missing plugin defaults in config
title: "init"
---

# `openclaw bshield init`

Initialize Berry Shield configuration under the plugin config path and ensure the plugin is enabled.

## What it does
- Checks whether Berry Shield plugin config already exists.
- If missing, writes default Berry Shield config values.
- Forces plugin enabled state to `true`.
- If config already exists, returns without overwriting existing values.

## When to use
- First setup of Berry Shield in a workspace.
- Recovery when plugin config entry was removed.
- Verification that plugin defaults exist before running policy/rule commands.

## Syntax
### Base command
Use this command to initialize Berry Shield configuration with defaults.
```bash
openclaw bshield init
```
Expected: CLI reports successful initialization or reports that configuration already exists.

## Options
This command has no specific flags or positional arguments.

## Examples

### Initialize Berry Shield defaults
Use this in a fresh or repaired environment before other Berry Shield commands.
```bash
openclaw bshield init
```
Result: Berry Shield config is created if missing and plugin enabled state is set to true.

### Verify initialization state
Use this after initialization to confirm mode, profile, and layers are available.
```bash
openclaw bshield status
```
Result: Status output includes Berry Shield mode, policy values, and active layer states.

## Common errors

### Config write failed
Use this diagnosis when the command reports initialization failure.
```bash
openclaw bshield init
```
Expected: On failure, CLI shows an operation failure message and returns non-zero exit code.

Possible causes:
- Config file path is not writable.
- Invalid runtime permissions for OpenClaw state directory.
- Unexpected config backend/runtime error.

## Related commands
- [index](README.md)
- [status](status.md)
- [mode](mode.md)
- [policy](policy.md)

---

## Navigation

- [Back to CLI Index](README.md)
- [Back to Wiki Index](../../README.md)
