---
summary: "CLI reference for `openclaw bshield builtin` (list and disable built-in rule IDs)"
read_when:
  - You need to inspect built-in rule IDs and current disable status
  - You need to disable one built-in rule without deleting custom rules
title: "builtin"
---

# `openclaw bshield builtin`

Manage built-in rule IDs used by Berry Shield baseline protection.

## What it does
- Lists built-in rule IDs by type (secret, pii, file, command).
- Disables one built-in rule by canonical ID.
- Persists disabled IDs in `custom-rules.json` as user delta.
- Keeps custom rules unchanged.

## When to use
- Investigating false positives from one specific built-in rule.
- Temporarily reducing baseline strictness for one pattern family.
- Auditing current built-in inventory before making changes.

## Syntax
### List built-in rules
Use this to inspect available built-in IDs and disabled state.
```bash
openclaw bshield builtin list
```
Expected: CLI renders built-in IDs by type and appends `[DISABLED]` for disabled IDs.

### Filter built-in list by type
Use this to inspect only one family.
```bash
openclaw bshield builtin list --type file
```
Expected: CLI shows only file built-in IDs.

### Disable one built-in by ID
Use this to disable one specific baseline rule.
```bash
openclaw bshield builtin remove secret:openai-key
```
Expected: CLI confirms disable and shows type + ID.

## Options
Supported options:
- `--type <type>` for `builtin list` and `builtin remove`
  - Accepted values: secret, pii, file, command

Positional arguments:
- `remove <id>` requires one built-in rule ID.

## Examples

### Show all built-in IDs
Use this before deciding which built-in to disable.
```bash
openclaw bshield builtin list
```
Result: Full built-in ID inventory grouped by type.

### Show only destructive command built-ins
Use this for shell-command hardening tuning.
```bash
openclaw bshield builtin list --type command
```
Result: Only command-family built-ins are displayed.

### Disable one command built-in
Use this if one command pattern causes operational false positives.
```bash
openclaw bshield builtin remove command:dd
```
Result: Rule is persisted as disabled and no longer applied in active matching.

## Common errors

### Invalid type value
Use this to validate type input behavior.
```bash
openclaw bshield builtin list --type unknown
```
Expected: CLI returns failure with accepted type values.

### Unknown built-in ID
Use this to validate strict ID checks.
```bash
openclaw bshield builtin remove secret:does-not-exist
```
Expected: CLI returns failure and does not mutate stored rules.

## Related commands
- [index](README.md)
- [list](list.md)
- [remove](remove.md)
- [reset](reset.md)

---

## Navigation

- [Back to CLI Index](README.md)
- [Back to Wiki Index](../../README.md)
