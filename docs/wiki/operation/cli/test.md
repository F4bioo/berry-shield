---
summary: "CLI reference for `openclaw bshield test` (test one input against active match patterns)"
read_when:
  - You need to verify if a string matches built-in or custom patterns
  - You are validating custom regex behavior before production use
title: "test"
---

# `openclaw bshield test`

Test one input string against active built-in and custom match patterns.

## What it does
- Loads built-in secret/PII patterns and custom secret rules.
- Evaluates the provided input against active patterns.
- Prints either no-match output or match details with rule source and redaction placeholder.

## When to use
- Validating new custom secret patterns.
- Debugging false positives or false negatives.
- Verifying expected redaction placeholder mapping.

## Syntax
### Test one input
Use this command to evaluate one input string against current match rules.
```bash
openclaw bshield test "<input>"
```
Expected: CLI reports no matches or prints one or more matching rule entries.

## Options
Positional argument:
- `<input>`: string to test against active built-in and custom patterns.

## Examples

### Test a string with no expected match
Use this to validate baseline no-match behavior.
```bash
openclaw bshield test "hello world"
```
Result: CLI reports no matches found.

### Test a token-like string
Use this to validate secret-pattern detection.
```bash
openclaw bshield test "sk_live_1234567890abcdef123456"
```
Result: CLI reports one or more matches with source and redaction placeholder.

### Test after adding one custom rule
Use this to verify new custom match behavior.
```bash
openclaw bshield test "MY_CUSTOM_TOKEN_ABC123"
```
Result: CLI reports custom match entry if the pattern is configured correctly.

## Common errors

### Shell quoting issue on input value
Use this when shell splits the intended input unexpectedly.
```bash
openclaw bshield test sk_live_1234567890abcdef123456
```
Expected: CLI still runs, but testing semantics depend on shell parsing of the input.

### Pattern read failure
Use this when command output is missing expected custom matches due to storage/runtime issues.
```bash
openclaw bshield test "sample"
```
Expected: On failure, runtime reports storage/read issues for custom rule loading.

## Related commands
- [index](README.md)
- [add](add.md)
- [list](list.md)
- [remove](remove.md)
