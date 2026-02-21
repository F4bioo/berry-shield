---
summary: "CLI reference for `openclaw bshield rules remove custom` (delete one custom security rule by name)"
read_when:
  - You need to remove a custom Berry Shield rule
  - You are cleaning up test or deprecated custom rules
title: "remove"
---

# `openclaw bshield rules remove custom`

Remove one custom Berry Shield rule by its identifier.

## What it does
- Looks up a custom rule by name.
- Removes the rule from persistent custom storage.
- Returns success output when the rule is removed.
- Returns failure output when the rule does not exist.
- Does not mutate baseline rules.

## When to use
- Removing obsolete custom patterns.
- Cleaning up temporary testing rules.
- Replacing a rule with a new pattern/version.

## Syntax
### Remove one custom rule by name
Use this to remove one existing custom rule.
```bash
openclaw bshield rules remove custom <name>
```
Expected: CLI confirms successful removal or reports that rule was not found.

## Options
Positional arguments:
- custom: required target for custom-rule removal.
- `<name>`: custom rule identifier to remove.

## Examples

### Remove an existing custom rule
Use this when the exact custom rule identifier is known.
```bash
openclaw bshield rules remove custom MyToken
```
Result: CLI confirms custom rule removal.

### Verify removal through rules list
Use this to confirm the removed rule is no longer present.
```bash
openclaw bshield rules list
```
Result: Removed custom rule no longer appears in custom entries.

### Disable a baseline rule (separate command)
Use this when the target is a baseline ID.
```bash
openclaw bshield rules disable baseline secret:openai-key
```
Result: Baseline rule is marked disabled in rules inventory.

## Common errors

### Wrong target
Use this to validate explicit target semantics.
```bash
openclaw bshield rules remove baseline secret:openai-key
```
Expected: CLI returns usage error because remove supports only custom target.

### Rule not found
Use this to verify missing-rule behavior.
```bash
openclaw bshield rules remove custom UnknownRule
```
Expected: CLI reports that the rule was not found.

## Related commands
- [index](README.md)
- [rules](rules.md)
- [list](list.md)
- [add](add.md)
- [test](test.md)

---

## Navigation

- [Back to CLI Index](README.md)
- [Back to Wiki Index](../../README.md)
