---
summary: "Run your first end-to-end Berry Shield validation session"
read_when:
  - You need a safe first-run checklist
  - You want to validate enforce and audit behavior
  - You want to verify report output after real checks
title: "Your First Secure Session"
---

# `Your First Secure Session`

This tutorial walks through a minimal but complete validation cycle.
You will verify mode, generate controlled security events, and confirm reporting.

## Prerequisites

- Berry Shield installed and enabled in OpenClaw
- Shell access to run `openclaw bshield ...`
- A running OpenClaw session where `berry_check` is available

## Step 1: Confirm status

Check current mode and active layers.

```bash
openclaw bshield status
```

Expected:
- Status is `ENABLED`
- Security layers are `ACTIVE`

## Step 2: Start from a clean report

Clear persisted audit events before testing.

```bash
openclaw bshield report --clear
```

Expected:
- Clear confirmation message with removed event count

## Step 3: Validate enforce blocking

Set enforce mode explicitly so subsequent checks use active blocking behavior.

```bash
openclaw bshield mode enforce
```

Then, in your OpenClaw chat session, request a safe denial test:

Example prompt:
`Run berry_check with operation=read and target=/etc/shadow. Do not read file contents.`

Expected:
- `berry_check` returns `STATUS: DENIED`
- No sensitive content is read

## Step 4: Confirm enforce report entries

Run the report immediately after the denied test to confirm event persistence.

```bash
openclaw bshield report
```

Expected:
- The enforce decision count increases in Summary
- Details include `stem | sensitive file access` for the tested target

## Step 5: Validate audit shadow behavior

Switch to audit mode to observe shadow decisions without enforce-time blocking.

```bash
openclaw bshield mode audit
```

Repeat the same `berry_check` request in chat (`/etc/shadow`).

Expected:
- Tool result is not hard-blocked by audit posture
- Event is logged as `would_block`

## Step 6: Confirm audit report entries

Run report again after the audit test to verify shadow logging behavior.

```bash
openclaw bshield report
```

Expected:
- `would_block` count increases
- Details show shadow decisions instead of enforce decisions

## Troubleshooting

- If mode changes do not appear immediately, re-check with `openclaw bshield status`.
- If report looks empty right after activity, wait a moment and run report again.
- If an event is missing, verify you exercised a path covered by current rules.

## Related pages

- [tutorial index](README.md)
- [decision modes](../decision/modes.md)
- [CLI mode command](../operation/cli/mode.md)
- [CLI report command](../operation/cli/report.md)

---

## Navigation

- [Back to Tutorials Index](README.md)
- [Back to Wiki Index](../README.md)
