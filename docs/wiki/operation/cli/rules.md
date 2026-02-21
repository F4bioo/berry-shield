---
summary: "CLI reference for `openclaw bshield rules` (baseline/custom rule management)"
read_when:
  - You need to manage baseline and custom rule state from one namespace
  - You are onboarding operators to the new rules command family
title: "rules"
---

# `openclaw bshield rules`

Manage baseline and custom Berry Shield rules from one command group.

## What it does
- Centralizes rule operations under rules.
- Lists baseline and custom inventory with explicit status.
- Removes custom rules by target + name.
- Enables or disables baseline rules by ID or in bulk.

## When to use
- Day-to-day rule operations in terminal automation.
- Security hardening sessions for baseline tuning.
- Cleanup or rotation of custom patterns.

## Syntax
### List inventory
Use this to review the current baseline and custom inventory before applying any change.
```bash
openclaw bshield rules list
```
Expected: Shows Baseline and Custom sections with explicit status.

### Remove custom rule
Use this to remove one custom rule by its stable custom identifier.
```bash
openclaw bshield rules remove custom <name>
```
Expected: Removes one custom rule by name.

### Disable one baseline rule
Use this to disable a single baseline rule when you need a controlled exception.
```bash
openclaw bshield rules disable baseline <id>
```
Expected: Marks one baseline rule as disabled.

### Enable one baseline rule
Use this to re-enable a previously disabled baseline rule by ID.
```bash
openclaw bshield rules enable baseline <id>
```
Expected: Marks one baseline rule as enabled.

### Disable all baseline rules
Use this only in controlled testing scenarios where default baseline coverage must be turned off.
```bash
openclaw bshield rules disable baseline --all --yes
```
Expected: Disables all baseline IDs and warns about protection impact.

### Enable all baseline rules
Use this to restore complete baseline coverage after bulk-disable scenarios.
```bash
openclaw bshield rules enable baseline --all --yes
```
Expected: Re-enables all baseline IDs.

## Option rules
- disable/enable accept exactly one mode:
  - `<id>` OR `--all`
- Invalid combinations return usage failure:
  - `<id> + --all`
  - neither `<id>` nor `--all`
- `--yes` skips interactive confirmation for `--all` operations.

## Common errors

### Wrong target for remove
Use this check to validate that remove only accepts the custom target.
```bash
openclaw bshield rules remove baseline secret:openai-key
```
Expected: Usage failure (remove supports only custom target).

### Unknown baseline ID
Use this check to validate error handling when an ID does not exist in baseline catalog.
```bash
openclaw bshield rules disable baseline secret:does-not-exist
```
Expected: Operation failure (`Unknown baseline rule id`).

## Related commands
- [index](README.md)
- [list](list.md)
- [remove](remove.md)
- [add](add.md)
- [reset](reset.md)

---

## Navigation

- [Back to CLI Index](README.md)
- [Back to Wiki Index](../../README.md)
