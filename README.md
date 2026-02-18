# 🍓 Berry Shield

> A modular security plugin for OpenClaw that helps manage data access and command execution.

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](package.json)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-plugin-green.svg)](https://docs.openclaw.ai/tools/plugin)

## Overview

Berry Shield is a **Session Guard** for the OpenClaw ecosystem that provides several layers of observation and control over the Agent's interactions. It focuses on data integrity and conversation safety.

## 🏰 System Overview

Berry Shield is designed with multiple layers. The idea is that if an interaction isn't caught by one layer, it might be caught by another.

---

## 🛡️ The 5 Defense Layers

| Layer | Type | Technical Role |
|-------|------|----------------|
| 🌱 **Berry.Root** | **Policy Injection** | Establishes the security context and instructions for the Agent at the start of every turn. |
| 🌿 **Berry.Stem** | **Security Gate** | The primary tool-based checkpoint (`berry_check`) that the Agent must call before any risky operation. |
| 🌵 **Berry.Thorn** | **Active Blocker** | Implements runtime interception of destructive commands and sensitive file access. |
| 🍇 **Berry.Pulp** | **Data Censor** | Scans and redacts tool outputs and outgoing messages to prevent long-term data leaks. |
| 🍃 **Berry.Leaf** | **Audit Trail** | Provides non-intrusive logging of all incoming interactions for security auditing. |

---

## 🚀 Installation

```bash
# Clone the repository
git clone <repo-url>
cd berry-shield

# Install into OpenClaw
openclaw plugins install ./berry-shield

# Enable the plugin
openclaw plugins enable berry-shield
```

## ⚙️ Configuration

Configure Berry Shield in your `~/.openclaw/config.json`:

```json
{
  "plugins": {
    "berry-shield": {
      "mode": "enforce",
      "layers": {
        "root": true,
        "pulp": true,
        "thorn": true,
        "leaf": true,
        "stem": true
      },
      "policy": {
        "profile": "balanced",
        "adaptive": {
          "staleAfterMinutes": 30,
          "escalationTurns": 3,
          "heartbeatEveryTurns": 0,
          "allowGlobalEscalation": false
        },
        "retention": {
          "maxEntries": 10000,
          "ttlSeconds": 86400
        }
      }
    }
  }
}
```

### Root Policy Injection Modes

Berry.Root supports three profiles:

- `strict`: injects full policy on every turn.
- `balanced` (default): full policy on first turn, then none; re-injects short/full on risk/stale/provider changes.
- `minimal`: stays silent by default; injects only on critical triggers (risk/provider change/heartbeat if configured).

Security fallback behavior:

- If no session identity is available (`sessionId/sessionKey` missing), Berry Shield automatically forces full policy and logs a warning.
- Adaptive escalation is session-scoped. When `sessionKey` is missing in `berry_check`, actions are still blocked but escalation is skipped.

Operational note:

- Policy session state is in-memory. After gateway/plugin restart, session tracking resets and the next turn receives full policy again.

---

## ⚙️ CLI Management

Berry Shield includes a CLI for managing security rules and monitoring status directly from the terminal.

### 📊 Dashboard & Monitoring
Quickly check the health and active layers of the plugin.

```bash
# General status dashboard
openclaw bshield status
```

### Self-Documentation
You can explore all available commands and flags directly from your terminal:

```bash
# General help
openclaw bshield --help
```

```bash
# Detailed help for specific commands
openclaw bshield add --help
```

```bash
# Detailed help for specific commands
openclaw bshield add secret --help
```

### 1. Adding Rules (The `add` Command)

You can add three types of security rules: `secret`, `file`, and `command`.

#### Advanced Redaction (Secrets)
Use the `--placeholder` flag to define exactly how a secret should appear in the logs/output.

```bash
# Add a rule for a custom Internal Token with a specific placeholder
openclaw bshield add secret \
  --name "InternalToken" \
  --pattern "INT_[a-z0-9]{32}" \
  --placeholder "[PROTECTED_INTERNAL_TOKEN]"
```

#### Targeted Blocking (Files & Commands)
Block access to specific files or execution of dangerous commands using patterns.

```bash
# Block specific production config
openclaw bshield add file --pattern "config/production\.json"
```

```bash
# Block all private key extensions
openclaw bshield add file --pattern "\.pem$"
```

```bash
# Block dangerous administrative commands
openclaw bshield add command --pattern "sudo"
```

### 2. Monitoring & Cleanup (`list` & `remove`)

Keep your security policy lean by listing and removing rules as needed.

```bash
# List all active rules (built-in and custom)
openclaw bshield list
```

```bash
# Remove a custom rule by its name
openclaw bshield remove InternalToken
```

### 3. Safety Verification (`test`)

Verify your patterns before deploying them to a live agent session.

```bash
# Test if a specific string triggers redaction
openclaw bshield test "My token is INT_abc1234567890abcdef1234567890ab"
```

### 4. Policy Profiles and Adaptive Settings

Manage policy behavior without editing JSON manually.

```bash
# Set profile directly
openclaw bshield profile strict
openclaw bshield profile balanced
openclaw bshield profile minimal
```

```bash
# Interactive policy wizard
openclaw bshield policy
```

```bash
# Deterministic set/get (automation-friendly)
openclaw bshield policy set adaptive.escalationTurns 5
openclaw bshield policy set adaptive.allowGlobalEscalation false
openclaw bshield policy get
openclaw bshield policy get profile
```

---

## 🔍 Technical Details

### The `berry_check` Tool (The Gate)
The Agent is instructed to always call `berry_check` before executing commands or reading files. This provides an active defense that works even when standard hooks are unavailable.

```typescript
// Agent verification
berry_check({ operation: "exec", target: "rm -rf /" })
// Output: STATUS: DENIED | REASON: Destructive command detected

// Recommended when session identity is available
berry_check({ operation: "exec", target: "rm -rf /", sessionKey: "session-abc" })
```

### Smart Cache
To reduce overhead, the rule set is only reloaded if the configuration file's modification time changes.

---

---

## ⚠️ Technical Limitations & SDK Diary

Berry Shield's effectiveness is tied to the underlying OpenClaw SDK capabilities. We maintain a detailed **[Security Posture & SDK Compatibility Diary](docs/wiki/decision/security-posture.md)** that tracks known bugs and blind spots across OpenClaw versions.

### Key Points for v2026.2.14:
*   **Hook Reliability**: While `before_tool_call` and `message_sending` are functional in the latest stable, some version-specific bugs (like the ignored `systemPrompt`) may exist.
*   **Soft Guardrails**: Prompt-based defenses (`Berry.Root`) are advisory and can be bypassed by clever user instructions.
*   **Timing Gaps**: Redaction happens during persistence, which might create a transient data exposure.

For a version-by-version technical breakdown, please refer to the **[Wiki Diary](docs/wiki/decision/security-posture.md)**.

---

## License
Berry Shield is licensed under the Apache 2.0 License. See the [LICENSE](LICENSE) file for more information.
