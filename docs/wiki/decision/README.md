# Decision Mechanism: Deny & Allow

Berry Shield operates on a decision-based security model. It analyzes intercepted actions and determines whether to permit, audit, or mitigate them based on the active configuration.

## Key Decision Concepts

- [Operation Modes (Audit vs Enforce)](modes.md): How decisions impact execution flow.
- [Pattern Matching & Rules](patterns.md): Identifying sensitive or flagged content.

## The Decision Flow
When an action is intercepted by a [Security Layer](../anatomy/README.md), the system follows this logic:

1. **Extraction**: Relevant data (input string, shell command, or file path) is isolated.
2. **Matching**: The data is validated against the internal pattern library.
3. **Mode Check**:
   - If in **Audit** mode: The action is logged and allowed to proceed.
   - If in **Enforce** mode: The action is flagged, and an error is returned to the agent.
4. **Resilience**: The system is intended to fail-closed when a security violation is detected in enforce mode.

---
- [Back to Wiki Index](../README.md)
