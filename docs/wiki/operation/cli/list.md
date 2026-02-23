---
summary: "CLI reference for `openclaw bshield rules list` (show baseline and custom rule inventory)"
read_when:
  - You need to inspect active Berry Shield rule inventory
  - You are auditing baseline vs custom rule coverage
title: "list"
---

# `openclaw bshield rules list`

List Berry Shield rules grouped by source (baseline/custom) with explicit status.

## What it does
- Loads baseline IDs and custom rules from persisted storage.
- Displays baseline rows as `BASELINE id: <id> [ENABLED|DISABLED]`.
- Displays custom rows as `CUSTOM id: <type:name> [ENABLED]`.
- Prints one inventory view for operational review.

## When to use
- Before and after adding/removing custom rules.
- During rule inventory audits.
- While diagnosing missing pattern coverage.

## Syntax
### List all rules
Use this command to inspect current baseline and custom rules.
```bash
openclaw bshield rules list
```
Expected: CLI prints sections for Baseline and Custom with explicit status markers.

### List all rules with full patterns
Use this command to inspect IDs together with raw patterns.
```bash
openclaw bshield rules list --full
```
Expected: CLI prints the same sections plus pattern details for baseline and custom rows.
Expected: CLI prints one detailed inventory view with IDs and patterns.

## Options
Flags:
- `--full`: include raw pattern details for all listed entries.

## Examples

### Inspect complete rule inventory
Use this as the primary inventory view for active protections.
```bash
openclaw bshield rules list
```
Result: Output is grouped by source and displays explicit enabled/disabled state.

### Verify custom rule presence after add
Use this after adding one custom rule.
```bash
openclaw bshield rules list
```
Result: New rule appears under Custom entries.

### Verify custom rule absence after remove
Use this after removing one custom rule.
```bash
openclaw bshield rules list
```
Result: Removed custom rule no longer appears in custom entries.

### Verify baseline disable status
Use this after disabling a baseline rule by ID.
```bash
openclaw bshield rules list
```
Result: Target baseline entry appears with `[DISABLED]` marker.

## Common errors

### Rule storage read failure
Use this when output is incomplete or command fails unexpectedly.
```bash
openclaw bshield rules list
```
Expected: On failure, CLI/runtime reports storage or read error.

Possible causes:
- Custom rules file unreadable.
- Runtime permission issue for custom rules path.

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
