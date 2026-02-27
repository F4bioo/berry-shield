---
summary: "Choose the right Berry Shield profile for your workload"
read_when:
  - You are deciding between strict, balanced, and minimal
  - You want a safe baseline profile before broader rollout
  - You need quick profile verification steps
title: "Choose Your Profile"
---

# `Choose Your Profile`

This tutorial helps you choose and validate a policy profile without editing low-level paths first.
It is the fastest way to put teams on a predictable baseline.

## Prerequisites

- Berry Shield installed and enabled
- Access to run `openclaw bshield` commands

## Step 1: Inspect current profile

Use this command to view the current profile and adaptive values before changes.
```bash
openclaw bshield status
```
Expected:
- Policy section is visible
- Profile appears as STRICT, BALANCED, or MINIMAL

## Step 2: Start with balanced baseline

Use this command to set a practical default for most environments.
```bash
openclaw bshield profile balanced
```
Expected:
- CLI confirms profile update

## Step 3: Verify profile application

Use this command to confirm the profile was persisted and is visible in status output.
```bash
openclaw bshield status
```
Expected:
- Profile is shown as BALANCED

## Step 4: Compare strict behavior

Use this command when you need maximum prompt-policy presence every turn.
```bash
openclaw bshield profile strict
```
Expected:
- CLI confirms strict profile

## Step 5: Compare minimal behavior

Use this command when your priority is lower prompt noise and trigger-based behavior.
```bash
openclaw bshield profile minimal
```
Expected:
- CLI confirms minimal profile

## Step 6: Return to team baseline

Use this command to restore the recommended daily-operation profile.
```bash
openclaw bshield profile balanced
```
Expected:
- Profile returns to balanced for normal operation

## Decision guide

- Choose `strict` for high-control sessions where repeated policy injection is preferred.
- Choose `balanced` for default production posture with good safety-to-noise tradeoff.
- Choose `minimal` when low prompt overhead is required and risk triggers are tuned.

## Related pages
- [tutorial index](README.md)
- [policy tuning](tune-policy.md)
- [profile command reference](../operation/cli/profile.md)
- [modes and profiles model](../decision/modes.md)

---

## Navigation
- [Back to Tutorials Index](README.md)
- [Back to Wiki Index](../README.md)
