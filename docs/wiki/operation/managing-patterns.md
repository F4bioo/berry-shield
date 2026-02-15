# How to Manage Security Patterns

This guide explains how to audit and manage the underlying regex patterns used by the Berry Shield engine.

## Pattern Architecture
Security patterns are stored in the following structure:
- `src/patterns/index.ts`: The central registry and standard Berry patterns.
- `src/patterns/generated.ts`: Patterns integrated from community sources (e.g., Gitleaks).

## Auditing Active Patterns
To view all rules currently loaded in your environment, use the `list` command:

```bash
openclaw bshield list
```
This command provides the **Rule ID**, **Type**, and a **Description** for every active pattern.

## Removing Patterns
To deactivate a specific rule, use the `remove` command followed by the unique ID:

```bash
openclaw bshield remove [ID]
```

### Examples:
- To remove a custom rule: `openclaw bshield remove "my-custom-token"`
- To remove a standard preset: `openclaw bshield remove "credit-card"`

## Pattern Verification (Advanced)
Technical users can verify pattern definitions directly in the source code. The patterns follow the `RulePreset` interface, which includes fields for identification, the regex pattern, and a factual description.

---
- [Back to Operation Index](README.md)
- [Back to Wiki Index](../README.md)
