---
summary: "CLI reference for `openclaw bshield list` (show built-in and custom rule inventory)"
read_when:
  - You need to inspect active Berry Shield rule inventory
  - You are auditing custom vs built-in rule coverage
title: "list"
---

# `openclaw bshield list`

List Berry Shield rules grouped by category and source.

## What it does
- Loads built-in and custom rule sets.
- Groups rules by category: secrets, PII redaction, sensitive files, destructive commands.
- Displays custom rules before built-in rules in each section.
- Prints a categorized inventory for operational review.

## When to use
- Before and after adding/removing custom rules.
- During rule inventory audits.
- While diagnosing missing pattern coverage.

## Syntax
### List all active rules
Use this command to inspect current built-in and custom rules.
```bash
openclaw bshield list
```
Expected: CLI prints categorized sections with rule source markers.

## Options
This command has no command-specific flags or positional arguments.

## Examples

### Inspect complete rule inventory
Use this as the primary inventory view for active protections.
```bash
openclaw bshield list
```
Result: Output is grouped by rule category and ordered by source within each group.

### Verify custom rule presence after add
Use this after adding one custom rule.
```bash
openclaw bshield list
```
Result: New rule appears under EXTERNAL entries in the matching category.

### Verify custom rule absence after remove
Use this after removing one custom rule.
```bash
openclaw bshield list
```
Result: Removed rule no longer appears in external entries.

## Common errors

### Rule storage read failure
Use this when output is incomplete or command fails unexpectedly.
```bash
openclaw bshield list
```
Expected: On failure, CLI/runtime reports storage or read error.

Possible causes:
- Custom rules file unreadable.
- Runtime permission issue for custom rules path.

## Related commands
- [index](README.md)
- [add](add.md)
- [remove](remove.md)
- [test](test.md)
