# Operation Modes: Audit vs Enforce

Berry Shield provides two primary modes of operation to manage security and development workflows.

## 1. Audit Mode (Passive Monitoring)
In Audit mode, the system monitors activity without restricting actions.
- **Behavior**: If a pattern is matched, a warning is logged (visible in the Dashboard), but the execution continues.
- **Use Case**: Initial setup, monitoring false positives, or when running in a trusted environment where observation is preferred over restriction.

## 2. Enforce Mode (Active Protection)
In Enforce mode, the system aims to activeley prevent violations.
- **Behavior**: When a flagged pattern is matched, the action is intended to be blocked. The agent receives a security error, aiming to prevent the operation from reaching the OS or being output to the user.
- **Use Case**: Production environments, security-critical workspaces, or whenever factual safety requirements are mandated.

## Technical Comparison

| Feature | Audit Mode | Enforce Mode |
| :--- | :--- | :--- |
| **Logic Interception** | Full | Full |
| **Mitigation/Blocking** | No | Yes |
| **Logging** | Yes | Yes |

## Switching Modes
Modes can be toggled via configuration or the CLI:
```bash
openclaw bshield mode
```

---
- [[Back to Reference]](../reference/README.md)
