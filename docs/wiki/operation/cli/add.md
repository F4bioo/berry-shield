---
summary: "CLI reference for `openclaw bshield add` (create custom security rules via wizard or direct arguments)"
read_when:
  - You need to add custom secret, file, or command rules
  - You want interactive rule creation with guided prompts
title: "add"
---

# `openclaw bshield add`

Add one custom Berry Shield rule, either through an interactive wizard or direct command arguments.

## What it does
- Opens the rule wizard when required arguments are missing.
- Supports direct rule creation with command arguments.
- Stores the new custom rule in persistent custom rule storage.
- Prints operation success or failure details.

## When to use
- Adding organization-specific token patterns.
- Adding custom sensitive file patterns.
- Adding custom destructive command patterns.

## Syntax
### Interactive mode
Use this to create a rule with guided prompts.
```bash
openclaw bshield add
```
Expected: Wizard prompts for type, pattern details, and confirmation.

### Direct mode
Use this when rule values are already known.
```bash
openclaw bshield add [type] --name <name> --pattern <regex>
```
Expected: CLI adds the rule directly and prints summary details.

## Options
Positional argument:
- `[type]`: rule category selected by wizard or passed directly.

Flags:
- `--name <name>`: technical rule identifier.
- `--pattern <regex>`: regex pattern to match.
- `--placeholder <text>`: redaction placeholder for secret rules.
- `--force`: overwrite existing custom rule with same identifier.

## Examples

### Add a secret rule directly
Use this when you already have a validated token regex.
```bash
openclaw bshield add secret --name MyToken --pattern "sk_live_[0-9a-z]{24}"
```
Result: Rule is persisted as a custom secret rule.

### Add a sensitive file rule directly
Use this for local paths that should be treated as sensitive.
```bash
openclaw bshield add file --name TeamKey --pattern "/srv/app/keys/team.key"
```
Result: Rule is persisted as a custom sensitive file rule.

### Add using wizard
Use this when you want guided selection and validation.
```bash
openclaw bshield add
```
Result: Wizard flow creates a rule and prints success summary on save.

## Common errors

### Missing required values in direct mode
Use this to validate argument requirements.
```bash
openclaw bshield add secret --name MissingPattern
```
Expected: CLI falls back to wizard flow or fails if required values are not resolved.

### Invalid regex pattern
Use this when pattern compilation is invalid.
```bash
openclaw bshield add secret --name BrokenRegex --pattern "(abc"
```
Expected: CLI fails with pattern validation/storage error.

### Duplicate rule without force
Use this to validate duplicate handling.
```bash
openclaw bshield add secret --name MyToken --pattern "sk_live_[0-9a-z]{24}"
```
Expected: CLI fails if rule already exists and force flag is not provided.

## Interactive wizard flow

### Wizard entry
Use this to start guided rule creation when you do not want direct flags.
```bash
openclaw bshield add
```
Expected: Wizard starts and prompts for rule category and rule details.

### Step 1: Rule type selection
The first prompt offers:
- secret
- file
- command
- cancel

If cancel is selected, the wizard exits without persisting data.

### Step 2: Preset or custom pattern
After choosing type, the wizard offers:
- custom pattern
- built-in presets for the selected type
- cancel

If a preset is selected, name/pattern/placeholder values are prefilled from that preset.
If custom is selected, manual inputs are requested.

### Step 3: Manual inputs (custom path)
For secret type:
- name is required
- pattern is required and regex-validated
- placeholder is optional

For file/command type:
- pattern is required and regex-validated

Invalid regex typically prevents progress until a valid pattern is entered or the user cancels.

### Step 4: Broad-pattern confirmation
If the pattern is detected as broad, the wizard asks explicit confirmation.
If the user does not confirm, the wizard exits without saving.

### Step 5: Preview and validation loop
Before save, the wizard enters a loop with sample tests:
- select one preview sample or skip
- see match/no-match result
- see expectation status

Then choose one action:
- save rule
- test another sample
- edit pattern
- cancel

If edit pattern is selected, the wizard returns to pattern input and repeats validation.
If cancel is selected, no data is persisted.

### Step 6: Save result
When save is selected, the command persists the rule and prints:
- rule type
- rule identifier
- stored pattern
- redaction placeholder (when available)

### Wizard cancellation behavior
Use this to validate safe exit in the middle of wizard flow.
```bash
openclaw bshield add
```
Result: Any cancel branch exits immediately and no new custom rule is written.

## Related commands
- [index](README.md)
- [list](list.md)
- [remove](remove.md)
- [test](test.md)
