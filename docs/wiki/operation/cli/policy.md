---
summary: "CLI reference for `openclaw bshield policy` (interactive wizard, deterministic get/set)"
read_when:
  - You need to edit policy settings beyond profile-only changes
  - You want deterministic policy operations for scripts and agents
title: "policy"
---

# `openclaw bshield policy`

Manage Berry Shield policy values through an interactive wizard or deterministic get/set actions.

## What it does
- Launches interactive policy wizard when called without action.
- Supports deterministic set for one allowed path.
- Supports deterministic get for full policy or one allowed path.
- Validates value types and ranges before write.

## When to use
- Interactive manual tuning of adaptive/retention values.
- Reproducible policy changes in scripts or CI.
- Debugging current policy values quickly.

## Syntax
### Launch policy wizard
Use this to edit policy values interactively with prompts and confirmation.
```bash
openclaw bshield policy
```
Expected: Wizard prompts for profile, adaptive values, and retention values.

### Set one policy value
Use this to update one specific policy path deterministically.
```bash
openclaw bshield policy set <path> <value>
```
Expected: CLI confirms the updated path and value.

### Read policy values
Use this to print policy values, either full tree or one path.
```bash
openclaw bshield policy get [path]
```
Expected: CLI prints policy rows for all values or for the selected path.

## Options
Supported actions:
- set
- get

Supported paths:
- `profile`
- `adaptive.staleAfterMinutes`
- `adaptive.escalationTurns`
- `adaptive.heartbeatEveryTurns`
- `adaptive.allowGlobalEscalation`
- `retention.maxEntries`
- `retention.ttlSeconds`

Validation rules:
- `profile`: `strict | balanced | minimal`
- `adaptive.allowGlobalEscalation`: `true | false`
- `adaptive.staleAfterMinutes`: integer `>= 1`
- `adaptive.escalationTurns`: integer `>= 1`
- `adaptive.heartbeatEveryTurns`: integer `>= 0`
- `retention.maxEntries`: integer `>= 1`
- `retention.ttlSeconds`: integer `>= 1`

## Tuning guide

| Field | Change when | Typical direction | Tradeoff |
| --- | --- | --- | --- |
| `profile` | You need broader or quieter policy injection behavior | `balanced -> strict` for stronger visibility, `balanced -> minimal` for lower noise | Stronger profiles improve policy visibility but can increase prompt overhead |
| `adaptive.allowGlobalEscalation` | Session identity is missing and escalation still must apply | `false -> true` only in controlled single-session contexts | Useful fallback for missing identity, risky in multi-session environments |
| `adaptive.escalationTurns` | Full-policy escalation feels too short or too long after denied events | Increase for stronger persistence, decrease for faster recovery | Higher values improve guard persistence but increase context load |
| `adaptive.heartbeatEveryTurns` | Long sessions need periodic reminder, or reminder noise is too high | Increase interval to reduce reminders, set `0` to disable | More heartbeat improves continuity, less heartbeat reduces token usage |
| `adaptive.staleAfterMinutes` | Session is considered stale too early or too late | Increase for longer continuity, decrease for faster stale detection | Longer windows reduce resets, shorter windows refresh posture sooner |
| `retention.maxEntries` | High session churn or memory pressure appears | Decrease on constrained hosts, increase for larger workloads | Lower values save memory, higher values keep more adaptive history |
| `retention.ttlSeconds` | Adaptive state expires too fast or remains too long | Increase for longer correlation, decrease for faster cleanup | Longer TTL helps continuity, shorter TTL reduces stale state risk |

## Examples

### Open wizard for manual policy updates
Use this when a human operator is tuning multiple values.
```bash
openclaw bshield policy
```
Result: Interactive flow collects values and asks for save confirmation.

### Set profile through deterministic path
Use this in scripts where profile change must be explicit.
```bash
openclaw bshield policy set profile balanced
```
Result: CLI confirms `profile = balanced`.

### Set stale timeout deterministically
Use this for adaptive timeout tuning.
```bash
openclaw bshield policy set adaptive.staleAfterMinutes 30
```
Result: CLI confirms `adaptive.staleAfterMinutes = 30`.

### Read full policy
Use this to inspect all policy values in one command.
```bash
openclaw bshield policy get
```
Result: CLI prints profile, adaptive values, and retention values.

### Read one policy path
Use this for focused checks in scripts.
```bash
openclaw bshield policy get adaptive.allowGlobalEscalation
```
Result: CLI prints only the selected path value.

## Common errors

### Invalid action
Use this to verify action validation behavior.
```bash
openclaw bshield policy edit profile strict
```
Expected: CLI fails with message indicating valid actions are get and set.

### Invalid path
Use this to verify path allowlist enforcement.
```bash
openclaw bshield policy set adaptive.unknownField 1
```
Expected: CLI fails with usage/error message listing allowed paths.

### Invalid typed value
Use this to verify numeric/boolean/profile validation.
```bash
openclaw bshield policy set adaptive.staleAfterMinutes zero
```
Expected: CLI fails with an integer validation message.

## Interactive wizard flow

### Wizard entry
Use this to edit policy values interactively in one guided flow.
```bash
openclaw bshield policy
```
Expected: Wizard prompts for profile, adaptive fields, and retention fields.

### Step 1: Profile selection
The first prompt offers:
- strict
- balanced
- minimal
- cancel

If cancel is selected, the wizard exits without changes.

### Step 2: Adaptive numeric inputs
The wizard requests these values:
- adaptive.staleAfterMinutes (integer >= 1)
- adaptive.escalationTurns (integer >= 1)
- adaptive.heartbeatEveryTurns (integer >= 0)

Each field is validated inline and rejects invalid values until corrected or canceled.

### Step 3: Adaptive boolean input
The wizard asks for:
- adaptive.allowGlobalEscalation (confirm prompt)

Cancel exits without writing policy changes.

### Step 4: Retention numeric inputs
The wizard requests:
- retention.maxEntries (integer >= 1)
- retention.ttlSeconds (integer >= 1)

Each field has inline numeric validation.

### Step 5: Review screen
Before persistence, the wizard prints a policy review table with:
- selected profile
- adaptive values
- retention values

### Step 6: Save confirmation
Final prompt: save policy changes.

If confirmed, each policy path is written to config.
If canceled or declined, no policy values are written.

### Wizard cancellation behavior
Use this to validate safe exit before persistence.
```bash
openclaw bshield policy
```
Result: Any cancel branch exits the flow and preserves previous policy values.

## Related commands
- [index](README.md)
- [profile](profile.md)
- [status](status.md)
- [mode](mode.md)
- [vine](vine.md)

---

## Navigation

- [Back to CLI Index](README.md)
- [Back to Wiki Index](../../README.md)
