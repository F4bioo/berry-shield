---
summary: "CLI reference for `openclaw bshield report` (show or clear persisted audit events)"
read_when:
  - You need to inspect audit event summaries and recent details
  - You need to reset audit report baseline before tests
title: "report"
---

# `openclaw bshield report`

Show a global summary of persisted audit events or clear persisted audit log data.

## What it does
- Reads persisted audit events from Berry Shield audit storage.
- Builds summary counts by decision type.
- Shows recent event details for operational inspection.
- Clears persisted audit log when clear flag is provided.

## When to use
- After security test runs to confirm blocked/would_block activity.
- Before test runs to reset baseline.
- During post-incident or policy tuning analysis.

## Syntax
### Show report
Use this command to inspect current persisted audit events.
```bash
openclaw bshield report
```
Expected: CLI shows event count, period, summary counts, and recent details.

### Clear report data
Use this command to clear persisted audit events.
```bash
openclaw bshield report --clear
```
Expected: CLI confirms how many events were cleared.

## Options
Flags:
- `--clear`: clear persisted audit log data instead of printing report.

## Examples

### Print current report
Use this to inspect current security event volume and decision distribution.
```bash
openclaw bshield report
```
Result: Report output includes total events, summary counters, and recent details.

### Clear report before a test cycle
Use this to start from a clean event baseline.
```bash
openclaw bshield report --clear
```
Result: Persisted report data is cleared and clear count is displayed.

### Confirm baseline after clear
Use this to verify report state after clearing.
```bash
openclaw bshield report
```
Result: CLI shows no audit events found until new events are generated.

## Common errors

### Report generation failure
Use this when report command returns operation failure unexpectedly.
```bash
openclaw bshield report
```
Expected: On failure, CLI prints report generation error and returns non-zero exit code.

### Clear operation race expectation
Use this when new events appear shortly after clear due to in-flight writes.
```bash
openclaw bshield report --clear
```
Expected: CLI clears persisted data, but very recent buffered writes can still appear later.

## Related commands
- [index](README.md)
- [status](status.md)
- [mode](mode.md)
- [policy](policy.md)

---

## Navigation

- [Back to CLI Index](README.md)
- [Back to Wiki Index](../../README.md)
