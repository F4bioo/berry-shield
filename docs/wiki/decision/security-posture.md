# Security Posture & SDK Compatibility Diary

## Architectural Scope: "Session Guard"

Berry Shield is designed as a **Session Guard**. Its primary mission is to protect the integrity of the AI conversation, prevent sensitive data leakage (PII/Secrets), and block unauthorized tool execution within the AI's logical context.

> [!IMPORTANT]
> Berry Shield is **not** an Operating System Sandbox. It does not provide kernel-level isolation, Docker-like containerization, or protection against OS-level exploits. It operates strictly within the boundaries of the OpenClaw Plugin SDK.

---

## SDK Compatibility Diary

This section tracks the technical health of the OpenClaw SDK hooks and their impact on Berry Shield's effectiveness.

### OpenClaw: v2026.2.14

| OpenClaw Version | Hook / Feature | Status | Impact on security | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| `2026.2.14` | `before_tool_call` | Functional | **Hard Guard**: Tool execution can be blocked/modified before execution. | `.backstage/openclaw/src/agents/pi-tools.before-tool-call.ts` |
| `2026.2.14` | `message_sending` | Functional | **Redaction/Cancel**: Outbound messages can be intercepted before delivery. | `.backstage/openclaw/src/infra/outbound/deliver.ts` |
| `2026.2.14` | `tool_result_persist` | Sync Only | **Timing Gap**: LLM may see raw data before persistence-time transforms are committed. | `.backstage/openclaw/src/plugins/hooks.ts` + `.backstage/openclaw/src/agents/session-tool-result-guard-wrapper.ts` |
| `2026.2.14` | `before_agent_start` (`systemPrompt`) | Buggy | **Instruction Override Fail**: returned `systemPrompt` is merged in hook runner but not applied in embedded run path. | `.backstage/openclaw/src/plugins/hooks.ts` + `.backstage/openclaw/src/agents/pi-embedded-runner/run/attempt.ts` |
| `2026.2.14` | `prependContext` | Vulnerable | **Soft Guard**: prepended to user prompt content, so prompt-level overrides remain possible. | `.backstage/openclaw/src/agents/pi-embedded-runner/run/attempt.ts` |

#### Technical Deep-Dive

**1. The Ignored Master Bug (`before_agent_start`)**
In `src/agents/pi-embedded-runner/run/attempt.ts`, the core executor calls the hook but fails to utilize the `systemPrompt` property in the result.
- **Consequence**: Plugins cannot replace the global system prompt. Berry Shield is forced to use `prependContext`, which is a weaker injection method.

**2. The User Prefix Weakness (`prependContext`)**
The `prependContext` is prepended to the user prompt used in the current agent run (`params.prompt`).
- **Risk**: Since modern LLMs tend to prioritize instructions at the end of a message, a clever "System Prompt Override" attack by the user can negate the instructions provided by Berry Shield.

**3. The Persistence Timing Gap**
The `tool_result_persist` hook runs synchronously, but the LLM receives the tool output buffer almost simultaneously. 
- **Risk**: There is a non-zero probability that the model starts generating a response based on raw data before the redaction logic has committed the mask to the session history.

---

## Security Recommendation

Due to current SDK limitations, we recommend a **Defense in Depth** strategy:

1.  **Strict Enforce Mode**: Always use `mode: enforce` to ensure blocking hooks are active.
2.  **Berry.Stem (Gate Tools)**: Prioritize using the `berry_check` tool logic within your own custom tools. Tool checks are currently the most reliable "Physical Barrier".
3.  **Audit Logs**: Regularly review the `berry-shield.log` to detect attempted bypasses.
