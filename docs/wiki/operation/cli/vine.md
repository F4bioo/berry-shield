---
summary: "CLI reference for `openclaw bshield vine` (status, get/set, and allowlist operations)"
read_when:
  - You need deterministic Berry.Vine tuning for tests or operations
  - You want to inspect or update Vine thresholds without editing JSON manually
title: "vine"
---

# `openclaw bshield vine`

Manage Berry.Vine configuration and tool allowlist from CLI.

## What it does
- Prints current Vine configuration (status).
- Reads Vine values (get).
- Writes deterministic Vine paths (set).
- Adds one tool to Vine allowlist (allow).
- Removes one tool from Vine allowlist (deny).
- Opens the interactive confirmation-strategy selector (confirmation).

## When to use
- Before smoke tests that need strict/balanced Vine behavior.
- During incident response for false-positive tuning.
- In scripts where Vine changes must be reproducible.

## Syntax

### Status (default action)
Use this to print the current effective Vine configuration.
```bash
openclaw bshield vine
```
Expected: CLI prints mode, thresholds, retention, and allowlist count.

### Explicit status
Use this when you want explicit command intent.
```bash
openclaw bshield vine status
```
Expected: Same output as default action.

### Read values
Use this to inspect all Vine values or one specific path.
```bash
openclaw bshield vine get [path]
```
Expected: CLI prints all Vine fields or one selected path.

### Update one value
Use this to update one supported Vine path.
```bash
openclaw bshield vine set <path> <value>
```
Expected: CLI confirms updated path and value.

### Allow one tool
Use this to exempt one tool from Vine escalation.
```bash
openclaw bshield vine allow <toolName>
```
Expected: Tool name is appended to `vine.toolAllowlist`.

### Deny one tool
Use this to remove one tool from Vine allowlist.
```bash
openclaw bshield vine deny <toolName>
```
Expected: Tool name is removed from `vine.toolAllowlist`.

## Options
Actions:
- status
- get
- set
- allow
- deny

Supported `set` paths:
- `mode` (`balanced | strict`)
- `thresholds.externalSignalsToEscalate` (integer `>= 1`)
- `thresholds.forcedGuardTurns` (integer `>= 1`)
- `retention.maxEntries` (integer `>= 1`)
- `retention.ttlSeconds` (integer `>= 1`)
- `confirmation.strategy` (`one_to_one | one_to_many`)
- `confirmation.codeTtlSeconds` (integer `>= 1`)
- `confirmation.maxAttempts` (integer `>= 1`)
- `confirmation.windowSeconds` (integer `>= 1`)
- `confirmation.maxActionsPerWindow` (integer `>= 1`)

Confirmation strategy meanings:
- `one_to_one` (`1:1`): one code unlocks one sensitive action.
- `one_to_many` (`1:N`): one code can unlock multiple sensitive actions inside the active confirmation window.

Default:
- `one_to_many` is the default confirmation strategy.

Operational note:
- if host/runtime binding is degraded, Vine still uses the same visible code-based confirmation flow without changing the configured confirmation strategy itself.

## Tuning guide

| Field | Change when | Typical direction | Tradeoff |
| --- | --- | --- | --- |
| `mode` | You need stronger or softer protection posture | `balanced -> strict` for harder blocking | `strict` reduces risk but may increase false positives |
| `thresholds.externalSignalsToEscalate` | Vine escalates too early or too late | Increase to reduce sensitivity, decrease to escalate faster | Lower values improve safety response, higher values reduce noise |
| `thresholds.forcedGuardTurns` | Guard window is too short or too long after escalation | Increase for stronger persistence, decrease for faster recovery | Higher values improve protection continuity but may impact UX |
| `retention.maxEntries` | High session churn or memory pressure appears | Decrease on constrained hosts, increase for larger workloads | Lower values save memory, higher values keep more Vine state |
| `retention.ttlSeconds` | Session risk state expires too fast or remains too long | Increase for longer correlation, decrease for faster cleanup | Longer TTL helps traceability, shorter TTL reduces stale state |

## Allowlist guide

### What allowlist is for
- Allowlist is an exception list for tool names.
- If a tool is allowlisted, Vine does not escalate risk based on that tool output.
- Use this only for tools you trust and control.

### When to use allowlist
- A known-safe internal tool keeps triggering Vine noise.
- You need short-term tuning during controlled tests.
- You validated the tool output path and ownership.

### Risk to understand first
- Allowlisting reduces Vine coverage for that tool.
- If the allowlisted tool starts returning risky external content, Vine may not react as expected.
- Keep the list small and review it often.

### Add one tool
Use this to create one allowlist exception.
Use the allow command shown in Syntax with the trusted tool name.
Expected: selected tool is added to allowlist.

### Check current allowlist state
Use this to confirm count and current Vine posture.
Use the explicit status command shown in Syntax.
Expected: Vine section shows current allowlist count.

### Remove one tool
Use this to restore normal Vine protection for a tool.
Use the deny command shown in Syntax with the same tool name previously allowlisted.
Expected: selected tool is removed from allowlist.

## Examples

### Set strict mode for aggressive blocking
Use this for high-sensitivity validation runs.
```bash
openclaw bshield vine set mode strict
```
Result: CLI confirms `mode = strict`.

### Reduce guard turns after escalation
Use this to lower Vine persistence during tuning.
```bash
openclaw bshield vine set thresholds.forcedGuardTurns 2
```
Result: CLI confirms forced guard turns updated.

### Switch confirmation strategy to one-to-one
Use this when every sensitive action must consume its own confirmation.
```bash
openclaw bshield vine set confirmation.strategy one_to_one
```
Result: CLI confirms `confirmation.strategy = one_to_one`.

### Open interactive confirmation strategy selector
Use this when you prefer the TTY selector with `1:1` and `1:N` labels.
```bash
openclaw bshield vine confirmation
```
Result: CLI opens the interactive selector and updates strategy after confirmation.

### Allowlist one tool
Use this when one trusted tool should not trigger Vine escalation.
```bash
openclaw bshield vine allow web_fetch
```
Result: tool is added to allowlist.

### Remove allowlisted tool
Use this when previously trusted tool should be guarded again.
```bash
openclaw bshield vine deny web_fetch
```
Result: tool is removed from allowlist.

## See more:

- [Vine runtime validation principles](../../layers/vine.md#runtime-validation-principles)

## Common errors

### Invalid action
Use this check when command fails before execution.
```bash
openclaw bshield vine edit mode strict
```
Expected: CLI fails and prints valid actions.

### Invalid path
Use this check when deterministic set path is not allowlisted.
```bash
openclaw bshield vine set thresholds.unknown 1
```
Expected: CLI fails and prints allowed Vine paths.

### Invalid value type
Use this check for numeric/type validation.
```bash
openclaw bshield vine set thresholds.forcedGuardTurns zero
```
Expected: CLI fails with integer validation message.

### Invalid confirmation strategy value
Use this check when a direct confirmation strategy write uses an unsupported value.
```bash
openclaw bshield vine set confirmation.strategy invalid
```
Expected: CLI fails and prints the allowed confirmation strategies.

## Related commands
- [index](README.md)
- [status](status.md)
- [policy](policy.md)
- [mode](mode.md)

---

## Navigation
- [Back to CLI Index](README.md)
- [Back to Wiki Index](../../README.md)
