---
summary: "CLI reference for `openclaw bshield reset defaults` (restore built-in and optional full defaults)"
read_when:
  - You need to restore built-in defaults after custom tuning
  - You need to reset all custom state and policy to defaults
title: "reset"
---

# `openclaw bshield reset`

Restore Berry Shield defaults with explicit scope control.

## What it does
- Supports `reset defaults` as the default restoration target.
- Scope builtins clears disabled built-in IDs only.
- Scope all clears disabled built-ins, custom rules, and restores default policy.
- Requests confirmation unless `--yes` is provided.

## When to use
- Reverting built-in tuning after a temporary exception.
- Returning to baseline protection before deployment.
- Recovering from heavy local customization during testing.

## Syntax

### Reset built-in defaults only
Use this to restore built-in baseline and keep custom rules.
```bash
openclaw bshield reset defaults --scope builtins
```
Expected: Disabled built-in IDs are cleared; custom rules remain intact.

### Reset full defaults
Use this to restore both rule state and policy defaults.
```bash
openclaw bshield reset defaults --scope all
```
Expected: Disabled built-ins and custom rules are cleared; policy is restored to default config.

### Non-interactive reset
Use this in automation where prompts are not allowed.
```bash
openclaw bshield reset defaults --scope builtins --yes
```
Expected: Command executes without confirmation prompt.

## Options
Supported options:
- `--scope <scope>`
  - builtins (default): reset disabled built-in IDs only
  - all: reset disabled built-ins + custom rules + policy defaults
- `--yes`: skip confirmation prompt

Positional arguments:
- `<target>` currently supports defaults.

## Examples

### Restore only built-in baseline
Use this to keep your custom rules while undoing built-in disables.
```bash
openclaw bshield reset defaults
```
Result: Same behavior as `--scope builtins`.

### Restore full baseline for clean-room testing
Use this before a full smoke test.
```bash
openclaw bshield reset defaults --scope all --yes
```
Result: Rules and policy return to default baseline without prompt.

## Common errors

### Invalid target
Use this to validate target parsing behavior.
```bash
openclaw bshield reset unknown
```
Expected: CLI returns usage failure and exits with error.

### Invalid scope
Use this to validate scope values.
```bash
openclaw bshield reset defaults --scope unknown
```
Expected: CLI returns failure with valid scope values.

## Related commands
- [index](README.md)
- [rules](rules.md)
- [list](list.md)
- [policy](policy.md)

---

## Navigation
- [Back to CLI Index](README.md)
- [Back to Wiki Index](../../README.md)
