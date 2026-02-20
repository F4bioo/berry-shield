---
summary: "CLI reference for `openclaw bshield remove` (delete one custom security rule by name)"
read_when:
  - You need to remove a custom Berry Shield rule
  - You are cleaning up test or deprecated custom rules
title: "remove"
---

# `openclaw bshield remove`

Remove one custom Berry Shield rule by its identifier.

## What it does
- Looks up a custom rule by name.
- Removes the rule from persistent custom storage.
- Returns success output with rule type and name.
- Returns failure output when the rule does not exist.
- Does not disable built-in rules (use `builtin remove` for built-ins).

## When to use
- Removing obsolete custom patterns.
- Cleaning up temporary testing rules.
- Replacing a rule with a new pattern/version.

## Syntax
### Remove one rule by name
Use this to remove one existing custom rule.
```bash
openclaw bshield remove <name>
```
Expected: CLI confirms successful removal or reports that rule was not found.

## Options
Positional argument:
- `<name>`: custom rule identifier to remove.

## Examples

### Remove an existing custom rule
Use this when the exact custom rule identifier is known.
```bash
openclaw bshield remove MyToken
```
Result: CLI confirms rule removal and prints rule type.

### Verify removal through rule listing
Use this to confirm the removed rule is no longer present.
```bash
openclaw bshield list
```
Result: Removed custom rule no longer appears in external rules.

### Disable a built-in rule (separate command)
Use this when the target is a built-in ID, not a custom rule name.
```bash
openclaw bshield builtin remove secret:openai-key
```
Result: Built-in rule is marked disabled in inventory and excluded from active enforcement/redaction matching.

## Common errors

### Rule not found
Use this to verify missing-rule behavior.
```bash
openclaw bshield remove UnknownRule
```
Expected: CLI reports that the rule was not found.

### Storage update failure
Use this when remove command reports operation failure unexpectedly.
```bash
openclaw bshield remove MyToken
```
Expected: On failure, CLI prints a failure message with operation details.

Possible causes:
- Custom rules storage is unavailable.
- Runtime permission issue for custom rules file path.

## Related commands
- [index](README.md)
- [list](list.md)
- [add](add.md)
- [builtin](builtin.md)
- [test](test.md)

---

## Navigation

- [Back to CLI Index](README.md)
- [Back to Wiki Index](../../README.md)
