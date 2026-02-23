---
summary: "CLI reference for `openclaw bshield init` (initialize Berry Shield config with defaults)"
read_when:
  - You need to bootstrap Berry Shield configuration on a new environment
  - You want to ensure the plugin config entry exists before running other commands
title: "init"
---

# `openclaw bshield init`

Initialize Berry Shield configuration if it does not exist.

## What it does
- Checks whether the Berry Shield plugin config entry already exists.
- If config already exists, it exits successfully without overwriting it.
- If config is missing, it writes default Berry Shield settings.
- Sets the Berry Shield enabled flag during initialization.

## When to use
- First setup on a new host/profile.
- Recovery after config resets where the plugin entry is missing.
- Preflight before mode/profile/policy commands on unknown environments.

## Syntax

### Initialize config
Use this to create Berry Shield config only when it is missing.
```bash
openclaw bshield init
```
Expected: CLI shows either `Configuration already exists.` or `Initialized successfully with default settings.`

## Common errors

### Write or config backend failure
Use this when init reports operation failure during config write/bootstrap.
Expected: CLI prints `Failed to initialize: ...` and exits with a non-zero code.

Possible causes:
- No write permission to the OpenClaw config/state path.
- Runtime/config backend unavailable.
- Invalid or corrupted config store state.

## Related commands
- [index](README.md)
- [status](status.md)

---

## Navigation
- [Back to CLI Index](README.md)
- [Back to Wiki Index](../../README.md)
