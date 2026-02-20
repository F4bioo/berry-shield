---
summary: "Decision reference for pattern categories and matching pipeline used by Berry Shield"
read_when:
  - Reviewing how Berry Shield matches risk patterns
  - Updating rule categories or matching behavior docs
title: "patterns"
---

# `patterns`

Berry Shield decisions are driven by pattern matching.  
This page explains the decision contract: what is matched, where rules come from, and how matches become runtime outcomes.

## What this page defines

- Pattern families used by runtime decisions.
- Built-in versus custom rule sources.
- The matching pipeline from candidate extraction to allow/block/redact outcomes.
- Known limits so operators can tune with realistic expectations.

## Pattern categories

### Secret patterns
Detect credential-like material in text payloads (API keys, tokens, private keys, secrets).

Primary effect:
- feeds redaction-related paths (for example output scanning and input auditing)
- contributes to observation or sanitization outcomes depending on mode

### PII patterns
Detect personally identifiable information markers in text payloads.

Primary effect:
- feeds redaction-related paths
- contributes to privacy-preserving output behavior and audit signals

### Sensitive file patterns
Detect sensitive file paths or file references in operation targets.

Primary effect:
- feeds operation-gating paths
- contributes to observation or deny outcomes depending on mode

### Destructive command patterns
Detect destructive command intent before execution (for example unsafe deletion/format/destructive shell patterns).

Primary effect:
- feeds pre-execution safety gates
- contributes to observation or deny outcomes depending on mode

## Rule sources

### Built-in rules
Bundled with Berry Shield and loaded by default.

Operational meaning:
- baseline security coverage exists without custom configuration
- built-in coverage should be treated as starter baseline, not complete environment-specific policy

### Custom rules
User-defined patterns persisted via CLI operations.

Operational meaning:
- used to close environment-specific gaps
- merged into runtime matching pipeline with built-in rules

## Matching pipeline (runtime view)

1. Layer intercepts a candidate event (tool call, tool result, outgoing message, input message).
2. Layer extracts matchable candidate data (command text, path, content payload).
3. Category-specific patterns are evaluated against candidate data.
4. Match result is passed into layer decision logic.
5. Mode (`audit` vs `enforce`) maps match result to observation-only or active mitigation outcome.
6. Runtime emits structured event outcome for reporting.

## Built-in + custom merge behavior

At runtime, Berry composes effective pattern sets by category:
- redaction patterns: built-in secret + built-in PII + custom secret-like additions
- file patterns: built-in sensitive-file + custom sensitive-file additions
- command patterns: built-in destructive-command + custom destructive-command additions

The runtime uses cached compiled sets for synchronous checks.  
Rule reload refreshes cache from persisted custom rules.

## How patterns map to layers

- Operation-gating patterns (sensitive files, destructive commands) are consumed by operation layers.
- Redaction patterns (secrets, PII) are consumed by content-scanning layers.

See layer details:
- [See layer Stem](../layers/stem.md)
- [See layer Thorn](../layers/thorn.md)
- [See layer Pulp](../layers/pulp.md)
- [See layer Leaf](../layers/leaf.md)

## Practical outcomes by mode

When a match is found:
- in `audit`, runtime usually records intent without heavy mitigation
- in `enforce`, runtime may actively deny operations or sanitize content and emit mitigation outcomes

Mode semantics are defined in:
- [modes](modes.md)

## Tuning guidance

Use built-in rules as default baseline, then tune in this order:
1. Measure with `audit` to observe match volume and false-positive surface.
2. Add targeted custom rules for environment-specific secrets/paths/commands.
3. Validate expected outcomes in `enforce` before production rollout.

## Limits and non-goals

- Pattern matching is heuristic, not complete semantic understanding.
- Coverage can vary by platform path conventions and tool argument formats.
- Some bypass forms depend on how candidate text is extracted by each layer.
- Pattern matching does not replace host sandboxing, IAM hardening, or network controls.

## See CLI

For pattern lifecycle operations, see:
- [CLI add command](../operation/cli/add.md)
- [CLI list command](../operation/cli/list.md)
- [CLI test command](../operation/cli/test.md)

## Related pages
- [decision index](README.md)
- [modes](modes.md)
