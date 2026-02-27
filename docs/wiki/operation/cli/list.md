---
summary: "CLI reference for `openclaw bshield rules list` (compact vs detailed inventory)"
read_when:
  - You need to inspect current baseline/custom rule state
  - You need to confirm ENABLED or DISABLED status after rule changes
title: "list"
---

# `openclaw bshield rules list`

Show current Berry Shield rule inventory grouped by source and status.

## What it does
- Loads rule state from plugin config/runtime.
- Prints two sections: baseline and custom.
- Shows each rule with status marker:
  - `[ENABLED]`
  - `[DISABLED]`
- In detailed mode, adds one `pattern:` line per rule.

## When to use
- Before rule updates to capture a state snapshot.
- After `rules enable` or `rules disable` to confirm final state.
- During troubleshooting when behavior and expected coverage differ.

## Syntax

### Compact inventory
Use this for quick state checks.
```bash
openclaw bshield rules list
```
Expected:
- Prints Baseline and Custom sections.
- Shows IDs and status markers only.

### Detailed inventory
Use this when you need exact regex visibility.
```bash
openclaw bshield rules list --detailed
```
Expected:
- Prints the same sections and statuses as compact mode.
- Adds one `pattern:` line for each rule entry.

### Short flag for detailed mode
Use this as a compact equivalent of `--detailed`.
```bash
openclaw bshield rules list -d
```
Expected: same output as `--detailed`.

## Options
- `--detailed` (`-d`): include raw pattern details for all listed entries.

## Common errors

### Runtime/config read failure
Use this when command output is incomplete or the command fails unexpectedly while reading runtime/config state.
Expected: CLI reports a runtime/config read error.

Possible causes:
- Invalid custom rule structure in config.
- Read failure on plugin config storage path.

## Related commands
- [index](README.md)
- [rules](rules.md)
- [add](add.md)
- [remove](remove.md)
- [reset](reset.md)
- [test](test.md)

---

## Navigation
- [Back to CLI Index](README.md)
- [Back to Wiki Index](../../README.md)
