---
summary: "Decision reference index for Berry Shield mode logic, matching behavior, and security posture"
read_when:
  - Reviewing how Berry Shield decides allow/block/redact outcomes
  - Updating mode and policy behavior documentation
title: "Decision Reference"
---

# `Decision reference`

This page is the entry point for Berry Shield decision logic documentation.
If decision behavior changes, update this index and linked pages.

## Security posture snapshot

Berry Shield decision logic is strong at application-layer mitigation, but it is not host isolation.

Known constraints to keep in mind:
- Some protections depend on OpenClaw hook availability/invocation on the deployed runtime version.
- Context injection paths influence model behavior, but are not hard execution control.
- Persistence-time hooks can have timing gaps relative to in-turn model exposure.

See full posture and limits:
- [security posture](posture.md)

## Decision pages

- [modes](modes.md) (audit/enforce behavior and relation to policy profile)
- [patterns](patterns.md) (pattern categories and matching pipeline)
- [security posture](posture.md) (scope boundaries and SDK constraints)

## Decision flow (high-level)

1. Incoming operation is intercepted by a layer.
2. Relevant data is extracted for matching.
3. Pattern/rule matching evaluates risk.
4. Runtime mode and policy context determine outcome.
5. Layer returns allow, block, redact, or audit event path.

## Notes

- Decision docs must be aligned with runtime behavior, not intended behavior.
- Claims about security behavior must be scoped and evidence-based.

---

## Navigation

- [Back to Wiki Index](../README.md)
- [Back to Repository README](../../../README.md)
