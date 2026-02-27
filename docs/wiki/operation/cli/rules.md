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
- Reads and writes custom rule state from `pluginConfig.customRules` (single CLI/Web source).
- Lists baseline and custom inventory with explicit status.
- Removes custom rules by target + id (`type:name`).
- Enables or disables baseline and custom rules by ID or in bulk.

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

### List inventory with detailed patterns
Use this to inspect identifier and raw pattern together.
```bash
openclaw bshield rules list --detailed
```
Expected: Shows the same inventory plus `pattern:` lines for baseline and custom rules.

### Remove custom rule
Use this to remove one custom rule by its stable custom identifier.
```bash
openclaw bshield rules remove custom <id>
```
Expected: Removes one custom rule by typed id (`secret:<name> | file:<name> | command:<name>`).

### Disable one baseline rule
Use this to disable a single baseline rule when you need a controlled exception.
```bash
openclaw bshield rules disable baseline <id>
```
Expected: Marks one baseline rule as disabled.

### Disable one custom rule
Use this to disable one custom rule without deleting it.
```bash
openclaw bshield rules disable custom <id>
```
Expected: Marks one custom rule as disabled and keeps it in inventory.

### Enable one baseline rule
Use this to re-enable a previously disabled baseline rule by ID.
```bash
openclaw bshield rules enable baseline <id>
```
Expected: Marks one baseline rule as enabled.

### Enable one custom rule
Use this to re-enable one custom rule by ID.
```bash
openclaw bshield rules enable custom <id>
```
Expected: Marks one custom rule as enabled.

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

### Disable all custom rules
Use this to keep custom entries persisted but inactive.
```bash
openclaw bshield rules disable custom --all --yes
```
Expected: Disables all custom entries across secret, file, and command categories.

### Enable all custom rules
Use this to reactivate all custom entries in one operation.
```bash
openclaw bshield rules enable custom --all --yes
```
Expected: Enables all custom entries across secret, file, and command categories.

### Disable all rules globally
Use this to disable baseline and custom rules together.
```bash
openclaw bshield rules disable --all --yes
```
Expected: Applies disable to full rule scope (`baseline + custom`) with impact warning.

### Enable all rules globally
Use this to restore full baseline and custom coverage in one step.
```bash
openclaw bshield rules enable --all --yes
```
Expected: Applies enable to full rule scope (`baseline + custom`).

## Option rules
- disable/enable accept exactly one mode:
  - `<id>` OR `--all`
- target is optional only for global `--all`.
- Invalid combinations return usage failure:
  - `<id> + --all`
  - neither `<id>` nor `--all`
- `--yes` is meaningful only for `--all` operations.

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

### Unknown custom ID
Use this check to validate error handling when a custom rule is not found.
```bash
openclaw bshield rules disable custom secret:does-not-exist
```
Expected: Operation failure (`Unknown custom rule id`).

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
