---
summary: "CLI reference for `openclaw bshield report` (show or clear persisted audit events)"
read_when:
  - You need to inspect persisted Berry Shield audit events
  - You need to clear audit history before controlled tests
title: "report"
---

# `openclaw bshield report`

Show persisted audit report data or clear it.

## What it does
- Reads persisted audit events from Berry Shield storage.
- Prints event period, summary counters, and detail rows.
- Clears persisted events when `--clear` is provided.

## When to use
- After tests to confirm `blocked` and `would_block` activity.
- Before tests to reset report state.
- During incident analysis to inspect recent security decisions.

## Syntax

### Show persisted report
Use this to inspect current persisted audit events.
```bash
openclaw bshield report
```
Expected: CLI prints total events, period, summary counters, and detail rows.

### Clear persisted report
Use this to clear persisted audit events before a new test cycle.
```bash
openclaw bshield report --clear
```
Expected: CLI confirms clear operation and reports how many events were removed.

## Options
- `--clear`: clear persisted audit report data instead of printing it.

## Common errors

### Report backend read failure
Use this when report rendering fails unexpectedly.
Expected: CLI prints a report generation error and returns non-zero exit code.

Possible causes:
- Audit storage file is not readable.
- Runtime/config path permission issue.
- Corrupted persisted report payload.

### In-flight write visibility after clear
Use this when events appear shortly after `--clear`.
Expected: clear succeeds, but buffered in-flight events may still be written after the clear operation.

## Related commands
- [index](README.md)
- [status](status.md)
- [mode](mode.md)

---

## Navigation
- [Back to CLI Index](README.md)
- [Back to Wiki Index](../../README.md)
