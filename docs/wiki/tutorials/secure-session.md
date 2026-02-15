# Your First Secure Session

This tutorial guides you through activating and verifying active protection in Berry Shield. Berry Shield is **Safe-by-Default**, ensuring it starts in blocking mode to protect your project immediately.

## Objective
Verify that Berry Shield intercepts and redacts sensitive data before it reaches the AI context.

---

## Step 1: Verify System Status
Berry Shield starts in `enforce` mode with all security layers active. In this mode, violations are **blocked/redacted** immediately.

```bash
openclaw bshield status
```
*Requirement: `Operation Mode: ENFORCE`*

## Step 2: Add a Protection Rule
Add a rule to detect a simulated API key pattern. This allows you to test the shield without using real secrets.

```bash
openclaw bshield add secret --name "MyDevKey" --pattern "DEV-[0-9]{5}-KEY"
```

## Step 3: Verify Active Redaction
Test the protection by attempting to output a string that matches your new rule.

**Scenario:** Input a message containing the simulated key.
> "The key is DEV-55555-KEY"

**Result:** Berry Shield will intercept the output. The AI will receive the redacted version:
`[berry-shield] Berry.Pulp: REDACTED 1 item(s) [MyDevKey] in outgoing message`

The observer or the chat interface will only see the safe placeholder, e.g., `[REDACTED_PII]`.

## Step 4: Real-Time Monitoring
Open the TUI Dashboard to monitor block events as they happen.

```bash
openclaw bshield status --tui
```

---

> [!CAUTION]
> **CRITICAL SECURITY RISK: The "Audit Mode" Trap**
>
> The `audit` mode (`openclaw bshield mode audit`) is extremely dangerous in live sessions with AI agents.
>
> **The Data Leak Vector:**
> In `audit` mode, Berry Shield's security hooks (`before_tool_call`, `after_tool_call`, `message_sending`) **suspended their blocking logic**. Violation messages will appear in your terminal, but the **raw sensitive data will reach the AI context**.
>
> **Internal Tool Exploitation:**
> Even if you don't read files directly, the AI can use internal SDK tools like `gateway config.get` to pull your entire system configuration (including other API keys and tokens) directly into its context.
>
> **The Danger:**
> Once a secret is in the AI's short-term memory, it can be exfiltrated via **Prompt Injection** or simple tool manipulation (e.g., writing the context to a public file or sending it via a notification tool).
>
>- **Policy**: Only use `audit` mode unless you are in a controlled environment with **purged secrets** and dummy data. **Enforce Mode** is the primary state designed to provide technical redaction and protection.

---
- [Back to Wiki Index](../README.md)
