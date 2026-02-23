---
summary: "Use report output for incident triage and policy follow-up"
read_when:
  - You need to investigate suspicious activity patterns
  - You want to separate rule gaps from expected denials
  - You need a repeatable incident-response flow
title: "Incident Triage with Report"
---

# `Incident Triage with Report`

This tutorial provides a practical incident triage flow using Berry Shield report output.
It helps teams turn raw event summaries into concrete policy actions.

## Prerequisites

- Berry Shield running in your target environment
- Access to report output and policy/rule management commands

## Step 1: Capture current evidence snapshot

Use this command to read the current event summary and detail samples.
```bash
openclaw bshield report
```
Expected:
- Output includes event count, period, summary rows, and details

## Step 2: Confirm runtime posture

Use this command to validate mode and profile before drawing conclusions.
```bash
openclaw bshield status
```
Expected:
- Mode and profile are visible and match expected operating state

## Step 3: Test suspected gap with dry-style check

Use this command to test a candidate path or token string against active rule coverage.
```bash
openclaw bshield test "/home/team/.config/newservice/credentials.json"
```
Expected:
- Output indicates whether active patterns already detect this input

## Step 4: Add a temporary custom rule when gap is confirmed

Use this command to quickly patch detection coverage for a validated gap.
```bash
openclaw bshield add file --name newservice-creds --pattern "/home/.*/.config/newservice/credentials.json"
```
Expected:
- CLI confirms custom file rule persistence

## Step 5: Verify rule presence

Use this command to ensure the new rule is visible in active rule inventory.
```bash
openclaw bshield rules list
```
Expected:
- Custom list includes `id: file:/home/.*/.config/newservice/credentials.json`

## Step 6: Re-check detection behavior

Use this command to confirm the new pattern now matches the targeted input.
```bash
openclaw bshield test "/home/team/.config/newservice/credentials.json"
```
Expected:
- Output reports match for the newly added custom rule

## Step 7: Document and normalize policy

Use this command to print all policy values and capture final triage state for handoff.
```bash
openclaw bshield policy get
```
Expected:
- Full policy values are printed for incident notes

## Triage decision guide

- If repeated suspicious inputs are not detected, add a custom rule and track it.
- If detection is too broad, tighten regex before promoting rule to shared baseline.
- If behavior differs across sessions, verify mode/profile and session context first.

## Related pages

- [tutorial index](README.md)
- [build custom rules](build-custom-rules.md)
- [report command reference](../operation/cli/report.md)
- [posture and limits](../decision/posture.md)

---

## Navigation

- [Back to Tutorials Index](README.md)
- [Back to Wiki Index](../README.md)
