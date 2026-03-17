---
summary: "CLI reference for `openclaw bshield rules remove custom` (delete one custom security rule by typed id)"
read_when:
  - You need to remove a custom Berry Shield rule
  - You are cleaning up test or deprecated custom rules
title: "remove"
---

# `openclaw bshield rules remove custom`

Remove one custom Berry Shield rule by its identifier.

## What it does
- Looks up a custom rule by typed identifier (`type:name`).
- Removes the rule from persistent custom storage.
- Returns success output when the rule is removed.
- Returns failure output when the rule does not exist.
- Does not mutate baseline rules.

## When to use
- Removing obsolete custom patterns.
- Cleaning up temporary testing rules.
- Replacing a rule with a new pattern/version.

## Syntax

### Remove one custom rule by id
Use this to remove one existing custom rule.
```bash
openclaw bshield rules remove custom <id>
```
Expected: CLI confirms successful removal or reports that rule was not found.

## Options
Positional arguments:
- custom: required target for custom-rule removal.
- `<id>`: custom rule identifier in `type:name` format.

## Examples

### Remove an existing custom rule
Use this when the exact custom rule id is known.

Example (User custom):
```bash
openclaw bshield rules remove custom secret:MyToken
```
Result: CLI confirms custom rule removal.

### Remove a custom file rule
Use this when a file-pattern custom rule must be removed.

Example (User custom):
```bash
openclaw bshield rules remove custom file:team-key
```
Result: CLI confirms custom file-rule removal.

### Verify removal through rules list
Use this to confirm the removed rule is no longer present.
```bash
openclaw bshield rules list
```
Result: Removed custom rule no longer appears in custom entries.

### Disable a baseline rule (separate command)
Use this when the target is a baseline ID.

Example (Berry Shield):
```bash
openclaw bshield rules disable baseline berry:secret:openai-key
```

Example (Gitleaks Community):
```bash
openclaw bshield rules disable baseline gitleaks:secret:aws-access-token
```
Result: Baseline rule is marked disabled in rules inventory.

## Common errors

### Wrong target
Use this to validate explicit target semantics.

Example (Berry Shield):
```bash
# openclaw bshield rules remove baseline <id>
openclaw bshield rules remove baseline berry:secret:openai-key
```

Example (Gitleaks Community):
```bash
# openclaw bshield rules remove baseline <id>
openclaw bshield rules remove baseline gitleaks:secret:aws-access-key
```
Expected: CLI returns usage error because remove supports only custom target.

### Rule not found
Use this to verify missing-rule behavior.

Example (User custom):
```bash
openclaw bshield rules remove custom secret:UnknownRule
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
