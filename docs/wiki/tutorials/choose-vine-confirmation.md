---
summary: "Choose the right Vine confirmation strategy for external-risk workflows"
read_when:
  - You are deciding between one-to-one and one-to-many confirmation
  - You want a practical Vine baseline before smoke tests or rollout
  - You need to verify confirmation behavior from CLI and status output
title: "Choose Your Vine Confirmation Strategy"
---

# `Choose Your Vine Confirmation Strategy`

This tutorial helps you choose and validate the Vine confirmation strategy without editing low-level config files.
Use it when you need a predictable human pause after external-content risk becomes active.

## Prerequisites

- Berry Shield installed and enabled
- Access to run `openclaw bshield` commands
- Vine layer enabled in the active runtime

## Step 1: Inspect current confirmation state

Use this command to inspect the active Vine confirmation strategy before changing anything.
```bash
openclaw bshield status
```
Expected:
- `Vine Confirmation` section is visible
- `Confirmation Strategy` is shown as `ONE_TO_ONE` or `ONE_TO_MANY`

## Step 2: Start with the default strategy

Use this command when you want the recommended general-purpose confirmation baseline.
```bash
openclaw bshield vine set confirmation.strategy one_to_many
```
Expected:
- CLI confirms `confirmation.strategy = one_to_many`

## Step 3: Verify the runtime state

Use this command to confirm the strategy is visible in status output.
```bash
openclaw bshield status
```
Expected:
- `Confirmation Strategy` is `ONE_TO_MANY`
- `ONE_TO_MANY` is marked `ACTIVE`

## Step 4: Try the interactive selector

Use this command when you want the TTY selector with `1:1` and `1:N` labels.
```bash
openclaw bshield vine confirmation
```
Expected:
- CLI opens the confirmation strategy selector

## Step 5: Switch to one-to-one when every action must pause

Use this command when each sensitive action should require its own human confirmation.
```bash
openclaw bshield vine set confirmation.strategy one_to_one
```
Expected:
- CLI confirms `confirmation.strategy = one_to_one`

## Step 6: Return to one-to-many for smoother operator flow

Use this command when you want one confirmation to unlock a short bounded sequence of sensitive actions.
```bash
openclaw bshield vine set confirmation.strategy one_to_many
```
Expected:
- CLI confirms `confirmation.strategy = one_to_many`

## Decision guide

- Choose `one_to_one` (`1:1`) when every sensitive action should stop and wait for a new human confirmation.
- Choose `one_to_many` (`1:N`) when the goal is to insert one visible human pause and then allow a short bounded sequence of related sensitive actions.
- Keep `one_to_many` as the default when operator experience matters and the bounded window is acceptable.
- Use `one_to_one` for higher-friction validation sessions or when you want the clearest action-by-action audit trail.

## Related pages
- [tutorial index](README.md)
- [Vine layer reference](../layers/vine.md)
- [vine command reference](../operation/cli/vine.md)
- [status command reference](../operation/cli/status.md)

---

## Navigation
- [Back to Tutorials Index](README.md)
- [Back to Wiki Index](../README.md)
