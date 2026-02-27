---
summary: "Security posture reference for Berry Shield scope boundaries and SDK dependency constraints"
read_when:
  - Reviewing what Berry Shield does and does not protect
  - Assessing SDK/runtime constraints that affect enforcement confidence
title: "security posture"
---

# `security posture`

Berry Shield is a session-level security layer inside OpenClaw plugin boundaries.

## Scope boundaries

### In scope
- prompt and tool-level policy guidance for agent behavior
- pre-execution checks for risky operations
- output redaction and audit event generation

### Out of scope
- kernel-level sandboxing
- host-level container isolation
- operating-system exploit mitigation

Berry Shield must be understood as application-layer protection, not host isolation.

## Dependency on OpenClaw hooks

Berry Shield behavior depends on hook surfaces provided by OpenClaw runtime.
Changes in hook timing, propagation, or runner behavior can change effective security posture.

## Known host constraints (OpenClaw-side)

- Hook definition is not the same as effective runtime invocation.
  Verify behavior on the deployed OpenClaw build/version, not only by reading hook types.
- `before_agent_start` is instruction-level influence on context, not hard runtime execution control.
- `tool_result_persist` runs at persistence time; this can create timing gaps relative to what the model already saw in the same turn.
- Hook execution semantics (sync-only paths, void vs modifying hooks) are host constraints and can weaken assurance if misunderstood.

## Practical posture guidance

### Preferred baseline
- mode set to enforce for active mitigation behavior
- policy/profile configured intentionally for the deployment context
- status and report reviewed during validation cycles

## See CLI

For posture verification operations, see:
- [CLI status command](../operation/cli/status.md)
- [CLI report command](../operation/cli/report.md)

## Known risk classes

- prompt-level override attempts against weak policy instruction context
- bypass attempts through alternate tool paths when coverage is incomplete
- operational drift when mode/policy differs from expected deployment baseline
- runtime-version drift where expected hook behavior differs from deployed host behavior

## Related pages
- [decision index](README.md)
- [modes](modes.md)

---

## Navigation
- [Back to Decision Index](README.md)
- [Back to Wiki Index](../README.md)
