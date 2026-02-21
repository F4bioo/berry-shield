---
summary: "Berry Shield CLI reference index for openclaw bshield commands"
read_when:
  - Adding or changing Berry Shield CLI commands
  - Documenting command usage, options, and operational flows
  - Reviewing CLI docs for consistency with runtime behavior
title: "Berry Shield CLI Reference"
---

# `Berry Shield CLI reference`

This page is the entry point for Berry Shield CLI documentation.
If command behavior changes, update this index and the command pages.

## Command pages

- [help](help.md) (global discovery and command help)
- [init](init.md)
- [status](status.md)
- [mode](mode.md)
- [profile](profile.md)
- [policy](policy.md)
- [vine](vine.md)
- [toggle](toggle.md)
- [add](add.md)
- [rules](rules.md)
- [remove](remove.md)
- [reset](reset.md)
- [list](list.md)
- [test](test.md)
- [report](report.md)

## Global command shape
Use this syntax as the baseline for all Berry Shield CLI operations.

```bash
openclaw bshield <command> [options]
```
Expected: Run one Berry Shield command with optional flags and arguments.

## Quick start

### 1) Inspect current state
Use this to confirm mode, policy profile, rule counts, and active layers.
```bash
openclaw bshield status
```
Expected: Status output includes `Mode`, `Rules`, `Policy`, and `Security Layers`.

### 2) Set enforce mode
Use this for active protection behavior.
```bash
openclaw bshield mode enforce
```
Expected: CLI confirms ENFORCE mode is active.

### 3) Set balanced profile
Use this as the recommended default profile for general operation.
```bash
openclaw bshield profile balanced
```
Expected: CLI confirms profile changed to `balanced`.

### 4) Open policy wizard
Use this for interactive policy tuning.
```bash
openclaw bshield policy
```
Expected: Wizard prompts for profile, adaptive, and retention values.

### 5) List rules inventory
Use this to inspect baseline and custom rules in one place.
```bash
openclaw bshield rules list
```
Expected: CLI shows baseline IDs and custom names, including `[ENABLED]` and `[DISABLED]` status.

### 6) Disable one baseline rule
Use this to disable one baseline rule by stable ID.
```bash
openclaw bshield rules disable baseline secret:openai-key
```
Expected: CLI marks the target baseline rule as disabled.

### 7) Tune Vine mode for smoke tests
Use this to switch Vine behavior deterministically.
```bash
openclaw bshield vine set mode strict
```
Expected: CLI confirms strict Vine mode for external-content guard behavior.

## Documentation structure

Each command page follows the same structure:
- What it does
- When to use
- Syntax
- Options
- Examples (one command per `bash` block)
- Expected output
- Common errors
- Related commands

## Notes

- Keep examples deterministic and copy/paste-safe.
- Keep one `openclaw bshield` command per `bash` block.
- Prefer explicit expected outcomes after each example.

---

## Navigation

- [Back to Operation Index](../README.md)
- [Back to Wiki Index](../../README.md)
