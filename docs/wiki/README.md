---
summary: "Main wiki entrypoint with reading paths and full domain map"
read_when:
  - You need a complete overview of Berry Shield documentation
  - You are onboarding and need a recommended reading path
  - You are looking for where each topic is documented
title: "Berry Shield Wiki"
---

# `Berry Shield Wiki`

Berry Shield documentation for OpenClaw operators, contributors, and maintainers.
This wiki follows a Diataxis-style split: tutorials, operations, decisions, internals, deployment, and generated reference.

## Read This First

Berry Shield is an application-layer security plugin.
It can enforce guardrails, block risky operations, and sanitize output paths.
It is not host isolation or operating-system hardening.

Known host/runtime constraints are documented in:
- [Security Posture](decision/posture.md)

## Start Here (By Goal)

- First-time setup and validation:
  - [Your First Secure Session](tutorials/secure-session.md)
- Choose behavior strategy before rollout:
  - [Choose Your Profile](tutorials/choose-profile.md)
  - [Tune Policy](tutorials/tune-policy.md)
- Roll out to real workloads safely:
  - [Audit-to-Enforce Rollout](tutorials/audit-to-enforce-rollout.md)
- Investigate events and close coverage gaps:
  - [Incident Triage with Report](tutorials/incident-triage-report.md)

## Wiki Map

### Tutorials (Learning-oriented)
Guided, step-by-step workflows for operators and new users.

- [Tutorial Index](tutorials/README.md)
- [Your First Secure Session](tutorials/secure-session.md)
- [Choose Your Profile](tutorials/choose-profile.md)
- [Tune Policy](tutorials/tune-policy.md)
- [Build Custom Rules](tutorials/build-custom-rules.md)
- [Audit-to-Enforce Rollout](tutorials/audit-to-enforce-rollout.md)
- [Incident Triage with Report](tutorials/incident-triage-report.md)

### Operation (How-to)
How to run Berry Shield through supported interaction surfaces.

- [Operation Index](operation/README.md)
- [CLI Reference](operation/cli/README.md)
- [Web Reference](operation/web/README.md)

### Decision (Explanation)
Why behavior is designed this way: mode semantics, pattern strategy, and explicit limits.

- [Decision Index](decision/README.md)
- [Modes](decision/modes.md)
- [Patterns](decision/patterns.md)
- [Security Posture](decision/posture.md)

### Layers (Architecture)
Cross-layer model and responsibilities for Root, Leaf, Stem, Thorn, and Pulp.

- [Layers Index](layers/README.md)
- [Root](layers/root.md)
- [Leaf](layers/leaf.md)
- [Stem](layers/stem.md)
- [Thorn](layers/thorn.md)
- [Pulp](layers/pulp.md)

### Engine (Internals)
Detection/transformation internals and runtime cost model.

- [Engine Index](engine/README.md)
- [Redaction](engine/redaction.md)
- [Match Engine](engine/match-engine.md)
- [Performance](engine/performance.md)

### Deploy (Build and release operations)
Installation tracks, build gates, and doc quality gates.

- [Deploy Index](deploy/README.md)
- [Installation](deploy/installation.md)
- [Build](deploy/build.md)
- [Auditing](deploy/auditing.md)

### Reference (Generated API docs)
Code-derived reference pages for low-level symbols and module internals.

- [Reference Index](reference/README.md)
- [Orion Map](reference/ORION_MAP.md)

## Suggested Reading Paths

- Operator path:
  - `tutorials/secure-session.md` -> `operation/cli/README.md` -> `decision/modes.md`
- Security-review path:
  - `decision/posture.md` -> `layers/README.md` -> `engine/redaction.md`
- Contributor path:
  - `layers/README.md` -> `engine/README.md` -> `reference/README.md`

---

> [!WARNING]
> This wiki is actively maintained. If runtime behavior changes, update docs in the same change set.

