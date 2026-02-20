---
summary: "Tune adaptive and retention policy values safely with CLI"
read_when:
  - You need to configure adaptive policy behavior
  - You want deterministic set/get commands for automation
  - You need to validate retention values
title: "Tune Policy"
---

# `Tune Policy`

This tutorial configures policy values using deterministic commands.
Use it when you want repeatable settings for teams, scripts, and CI runs.

## Prerequisites

- Berry Shield enabled
- Profile strategy already chosen (or about to be set)

## Step 1: Read full policy state

Use this command to print all policy values before making changes.
```bash
openclaw bshield policy get
```
Expected:
- Rows for profile, adaptive values, and retention values

## Step 2: Set profile via policy path

Use this command to enforce an explicit profile through policy path semantics.
```bash
openclaw bshield policy set profile balanced
```
Expected:
- CLI confirms `profile = balanced`

## Step 3: Set stale timeout

Use this command to define when sessions are considered stale for adaptive behavior.
```bash
openclaw bshield policy set adaptive.staleAfterMinutes 30
```
Expected:
- CLI confirms stale timeout update

## Step 4: Set escalation turns

Use this command to control how many turns remain elevated after critical triggers.
```bash
openclaw bshield policy set adaptive.escalationTurns 3
```
Expected:
- CLI confirms escalation value update

## Step 5: Set heartbeat interval

Use this command to tune optional periodic reinforcement cadence.
```bash
openclaw bshield policy set adaptive.heartbeatEveryTurns 0
```
Expected:
- CLI confirms heartbeat interval update

## Step 6: Configure global escalation behavior

Use this command to keep global escalation disabled unless you explicitly need it.
```bash
openclaw bshield policy set adaptive.allowGlobalEscalation false
```
Expected:
- CLI confirms boolean update

## Step 7: Tune retention limits

Use this command to cap how many persisted audit events are retained.
```bash
openclaw bshield policy set retention.maxEntries 5000
```
Expected:
- CLI confirms retention max entries update

## Step 8: Tune retention TTL

Use this command to define event expiration window in seconds.
```bash
openclaw bshield policy set retention.ttlSeconds 2592000
```
Expected:
- CLI confirms retention TTL update

## Step 9: Verify one critical field

Use this command to verify the exact value of global escalation after updates.
```bash
openclaw bshield policy get adaptive.allowGlobalEscalation
```
Expected:
- Output shows `false` for the selected path

## Related pages

- [tutorial index](README.md)
- [choose profile](choose-profile.md)
- [policy command reference](../operation/cli/policy.md)
- [security posture](../decision/posture.md)

---

## Navigation

- [Back to Tutorials Index](README.md)
- [Back to Wiki Index](../README.md)
