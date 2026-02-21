---
summary: "CLI reference for `openclaw bshield --help` and command-specific help output"
read_when:
  - You are discovering available Berry Shield commands
  - You need exact syntax for one command before execution
title: "help"
---

# `openclaw bshield --help`

Show Berry Shield command discovery output and command-specific usage details.

## What it does
- Lists available Berry Shield subcommands.
- Shows command arguments and options.
- Provides per-command help output for targeted usage checks.

## When to use
- First contact with Berry Shield CLI.
- Before scripting command execution.
- During troubleshooting for wrong argument shape.

## Syntax
### Global help
Use this form to inspect the full Berry Shield command surface.
```bash
openclaw bshield --help
```
Expected: CLI prints the list of available bshield subcommands and basic usage.

### Command-specific help
Use this form to inspect usage for one command.
```bash
openclaw bshield mode --help
```
Expected: CLI prints the mode command syntax and accepted argument values.

## Options
Help output is exposed through standard help flags:
- `--help`
- `-h`

## Examples

### Discover all bshield commands
Use this when you need to choose the next command from the available surface.
```bash
openclaw bshield --help
```
Result: Output includes command names such as init, status, mode, profile, policy, vine, rules, reset, and report.

### Inspect one command before execution
Use this when you need argument details for policy operations.
```bash
openclaw bshield policy --help
```
Result: Output describes policy command usage, including action and argument format.

## Common errors

### Mistyped command name
Use this check when help output is missing because the command name is invalid.
```bash
openclaw bshiled --help
```
Expected: Shell or CLI returns command-not-found or unknown command output.

### Running global openclaw help by mistake
Use this check when output is too broad and not Berry Shield-specific.
```bash
openclaw --help
```
Expected: OpenClaw global command index is shown instead of bshield-only help.

## Related commands
- [index](README.md)
- [init](init.md)
- [status](status.md)
- [mode](mode.md)
- [policy](policy.md)
- [vine](vine.md)
- [rules](rules.md)
- [reset](reset.md)

---

## Navigation

- [Back to CLI Index](README.md)
- [Back to Wiki Index](../../README.md)
