---
summary: "Roll out from audit observation to enforce protection safely"
read_when:
  - You are preparing first production rollout
  - You need controlled transition from audit to enforce
  - You want evidence-driven go/no-go criteria
title: "Audit-to-Enforce Rollout"
---

# `Audit-to-Enforce Rollout`

This tutorial defines a safe rollout sequence from observation to active protection.
It reduces rollout risk by using measured checkpoints and explicit validation.

## Prerequisites

- Team agreement on target profile and policy values
- Access to run operational CLI commands during rollout window
- A chat session where controlled `berry_check` prompts can be executed

## Step 1: Set audit mode for observation

Use this command to start in shadow posture before enabling active mitigation.
```bash
openclaw bshield mode audit
```
Expected:
- CLI confirms audit mode

## Step 2: Clear previous report baseline

Use this command to ensure rollout observations are measured from a clean baseline.
```bash
openclaw bshield report --clear
```
Expected:
- CLI confirms clear count

## Step 3: Generate controlled security activity

Use this prompt in chat to trigger a sensitive-path decision without exposing content.
Example prompt:
`Run berry_check with operation=read and target=/etc/shadow. Do not read file contents.`
Expected:
- Decision is captured as a shadow-style event in audit posture

## Step 4: Inspect audit evidence

Use this command to confirm audit observations are persisted and visible.
```bash
openclaw bshield report
```
Expected:
- Summary and details show new audit-observation decisions

## Step 5: Switch to enforce mode

Use this command to activate active mitigation after audit evidence is reviewed.
```bash
openclaw bshield mode enforce
```
Expected:
- CLI confirms enforce mode

## Step 6: Re-run the same controlled test

Use the same prompt in chat to compare behavior under enforce posture.
Example prompt:
`Run berry_check with operation=read and target=/etc/shadow. Do not read file contents.`
Expected:
- Sensitive read attempt is denied under enforce

## Step 7: Confirm enforce evidence

Use this command to verify enforce decisions are now represented in report output.
```bash
openclaw bshield report
```
Expected:
- New enforce-time decisions appear in summary/details

## Go-live checklist

- Profile is the intended one (`status` confirms).
- Mode is `ENFORCE` after final switch.
- Controlled denial test behaves as expected.
- Report evidence is available for post-rollout review.

## Related pages
- [tutorial index](README.md)
- [secure session](secure-session.md)
- [mode command reference](../operation/cli/mode.md)
- [report command reference](../operation/cli/report.md)

---

## Navigation
- [Back to Tutorials Index](README.md)
- [Back to Wiki Index](../README.md)
