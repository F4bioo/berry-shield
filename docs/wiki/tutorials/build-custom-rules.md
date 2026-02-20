---
summary: "Create, validate, and maintain custom rules with safe workflow"
read_when:
  - You need organization-specific secret/file/command coverage
  - You want to avoid broad or unsafe regex patterns
  - You need a repeatable custom-rule lifecycle
title: "Build Custom Rules"
---

# `Build Custom Rules`

This tutorial shows a full custom-rule lifecycle: add, validate, list, and remove.
Use it to extend built-in coverage for your environment.

## Prerequisites

- Berry Shield enabled
- Basic regex familiarity for custom patterns

## Step 1: Add one custom secret rule

Use this command to create a deterministic secret pattern entry.
```bash
openclaw bshield add secret --name team_token_rule --pattern "team_tok_[a-z0-9]{16}"
```
Expected:
- CLI confirms rule was persisted

## Step 2: Validate rule matching behavior

Use this command to test whether your custom pattern matches expected sample input.
```bash
openclaw bshield test "team_tok_a1b2c3d4e5f6g7h8"
```
Expected:
- Output reports a custom rule match

## Step 3: Validate negative sample

Use this command to verify non-matching strings do not produce false positives.
```bash
openclaw bshield test "team_token_invalid_shape"
```
Expected:
- Output reports no match

## Step 4: List active rules

Use this command to inspect built-in and custom rule counts and entries.
```bash
openclaw bshield list
```
Expected:
- Rule list includes your custom `team_token_rule` entry

## Step 5: Remove test rule when done

Use this command to remove the temporary custom rule after validation.
```bash
openclaw bshield remove team_token_rule
```
Expected:
- CLI confirms rule removal

## Step 6: Confirm clean state

Use this command to verify the removed rule no longer appears.
```bash
openclaw bshield list
```
Expected:
- `team_token_rule` is absent from custom entries

## Optional: Use wizard for guided creation

Use this command when you want prompts, preview loop, and confirmation flow.
```bash
openclaw bshield add
```
Expected:
- Wizard guides type selection, pattern input, and save decision

## Rule quality checklist

- Keep patterns narrow and specific to reduce accidental matches.
- Validate both positive and negative samples before production use.
- Use clear rule names that encode source or owner context.

## Related pages

- [tutorial index](README.md)
- [add command reference](../operation/cli/add.md)
- [test command reference](../operation/cli/test.md)
- [pattern model](../decision/patterns.md)

---

## Navigation

- [Back to Tutorials Index](README.md)
- [Back to Wiki Index](../README.md)
