# 🍓 Berry Shield - Security plugin for OpenClaw

<p align="center">
    <img src="https://raw.githubusercontent.com/F4bioo/berry-shield/master/docs/assets/demo/berry-shield-banner.png" alt="Berry Shield" width="720">
</p>

<p align="center">
  <a href="https://github.com/F4bioo/berry-shield/actions/workflows/ci.yml?branch=master"><img src="https://img.shields.io/github/actions/workflow/status/F4bioo/berry-shield/ci.yml?branch=master&style=flat-square&logo=githubactions&logoColor=white&labelColor=18181A&color=2FBF71" alt="CI status"></a>
  <a href="https://github.com/F4bioo/berry-shield/releases"><img src="https://img.shields.io/github/v/release/F4bioo/berry-shield?include_prereleases&style=flat-square&logo=github&logoColor=white&labelColor=18181A&color=FF5A2D&v=1" alt="GitHub release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=flat-square&logo=apache&logoColor=white&labelColor=18181A&color=2980b9" alt="Apache 2.0 License"></a>
</p>

## 🧐 Why this exists

Berry Shield was created from a practical problem: during routine setup checks, the agent could expose sensitive data directly in chat (API keys, tokens,
SSH material, and other secrets).

Typical examples included:
- reading config files that contained credentials (`openclaw.json`, `.env`, cloud credentials)
- returning sensitive command/file output without sanitization
- exposing private paths or secret-bearing content in normal troubleshooting flows

Design principles:
- Agents can read or execute sensitive operations by mistake.
- Prompt-only guardrails are not enough in real runtimes.
- Security controls must be visible, configurable, and testable from CLI.

The goal of `Berry Shield` is to reduce that risk in day-to-day usage by adding guardrails for access checks, runtime blocking, and output redaction.

---

## What it is / What it is not

### ✓ What it is

- `Berry Shield` is an `OpenClaw` plugin that adds layered guardrails, audit, and redaction for agent workflows.
- Enforces a pre-flight security gate with `berry_check` before risky operations.
- Intercepts tool calls and blocks destructive or sensitive access patterns.
- Scans and redacts sensitive output before persistence and outbound delivery.
- Supports `enforce` and `audit` modes for rollout and validation.
- Provides CLI management for status, mode, policy, layers, rules, and report.

### ✗ What it is not

- Not a sandbox, VM, container isolation, or kernel boundary.
- Not a replacement for host hardening, least privilege, or secrets management.
- Not a guarantee against fully compromised hosts or malicious dependencies.

---

## 🧭 When to use / When not to use

### Use Berry Shield when

- Your agent has command/file capabilities and you need to reduce accidental leakage.
- You operate on chat surfaces where unsafe output can be exposed quickly.
- You need auditability for security decisions (`allowed`, `blocked`, `redacted`, `would_*`).

### Do not use Berry Shield as

- The only security boundary in untrusted multi-tenant environments.
- A compliance silver bullet without operational governance.

---

## ⚡ 90-second demo

Baseline runtime state before the demo (plugin enabled, `enforce` mode, all core layers active):

<img src="https://raw.githubusercontent.com/F4bioo/berry-shield/master/docs/assets/demo/berry-shield-status.jpeg" alt="Berry Shield Status" width="720" />

---

### 1) Enforce: external-risk action is blocked [Watch demo: Vine Layer](https://github.com/user-attachments/assets/024aca2b-21d1-4d1b-b6f4-aad8a3bd54fb)

<video src='https://github.com/user-attachments/assets/024aca2b-21d1-4d1b-b6f4-aad8a3bd54fb' alt="Berry.Vine Enforce" controls width="720"></video>

> In chat/runtime: ingest external content with web_fetch, then preflight an exec write

<img src="https://raw.githubusercontent.com/F4bioo/berry-shield/master/docs/assets/demo/Berry.Vine-ENFORCE.png" alt="Berry.Vine Enforce" width="720"/>

Expected: denied in `enforce` after external untrusted ingestion.

---

### 2) Audit: same flow is allowed but logged as would_block [Watch demo: Vine Layer](https://github.com/user-attachments/assets/8fbff8e0-003c-4463-a6ae-319c3d909599)

<video src='https://github.com/user-attachments/assets/8fbff8e0-003c-4463-a6ae-319c3d909599' alt="Berry.Vine Audit" controls width="720"></video>

> Same write-like operation under audit mode

<img src="https://raw.githubusercontent.com/F4bioo/berry-shield/master/docs/assets/demo/Berry.Vine-AUDIT.png" alt="Berry.Vine Audit" width="720"/>

Expected: allowed execution plus `would_block` evidence in report/audit logs.

---

### 3) Sensitive file read is blocked (Stem)

Expected: denied read when attempting to access protected files.

<img src="https://raw.githubusercontent.com/F4bioo/berry-shield/master/docs/assets/demo/berry-shield-Berry.Stem-layer.jpeg" alt="Berry.Stem Block" width="520" />

Runtime evidence:

```text
2026-02-27T15:53:59.195Z [gateway] [berry-shield] Berry.Stem: DENIED read - sensitive file: /home/zyn/.openclaw/openclaw.json
```

---

### 4) Redaction: sensitive output is sanitized (Pulp)

```bash
openclaw config get channels.telegram
```

Expected: sensitive fields are masked in tool output, e.g. `botToken` becomes `[BOTTOKEN_REDACTED]`.

Why this matters: even read-only tools can still return sensitive values during normal operations.
Operator intent ("do not expose secrets") is useful, but not sufficient by itself; protection must happen in the output path.

Implementation basis:
- Berry.Pulp scans tool outputs at `tool_result_persist` and redacts matched secrets/PII before transcript persistence.
- Berry.Pulp also scans `message_sending` to redact sensitive data in outgoing assistant messages when supported by runtime hooks.
- In `audit`, events are logged as `would_redact`; in `enforce`, values are actively redacted.

Evidence (real redacted output):

```json
{
  "enabled": true,
  "dmPolicy": "pairing",
  "botToken": "[BOTTOKEN_REDACTED]",
  "groupPolicy": "allowlist",
  "streaming": "partial"
}
```

<img src="https://raw.githubusercontent.com/F4bioo/berry-shield/master/docs/assets/demo/berry-shield-Berry.Pulp-layer.jpeg" alt="Berry.Pulp Redaction" width="520" />

---

# ⚡ Quickstart

Install from npm package:

```bash
openclaw plugins install @f4bioo/berry-shield
```

---

## 🛡️ Security Audit & Installation Notice

> [!WARNING]
> **Expected heuristic warnings:**
> During `openclaw plugins install`, OpenClaw may flag patterns such as `child_process` usage and environment-based runtime resolution.
> In Berry Shield, these patterns are used for legitimate host integration (OpenClaw CLI/config bridge), not hidden execution paths.
>
> This is a heuristic warning, not a malware verdict.
> For a code-level mapping of each warning, see [Security Audit](SECURITY_AUDIT.md).

**Note:** Berry Shield is plug-and-play after install. No extra setup is required for baseline protection.

---

See more:
- [Berry Shield Installation guide](docs/wiki/deploy/installation.md)

---

**Note:** If you want to customize mode, layers, or policy, use:

```bash
openclaw bshield --help
```
 
See more:
- [Berry Shield CLI reference](docs/wiki/operation/cli/README.md)

---

## 🧠 Mental model (single flow)

Berry Shield is designed with multiple layers. The idea is that if an interaction isn't caught by one layer, it might be caught by another.

<img src="https://raw.githubusercontent.com/F4bioo/berry-shield/master/docs/assets/demo/mental-model-single-flow.jpeg" alt="Mental Model Single Flow" />

## 🧬 Layers in plain language

| Layer | Purpose | Practical effect |
| :--- | :--- | :--- |
| **Leaf** 🍃 | **Input audit** | Logs sensitive signals in incoming content for observability. |
| **Root** 🌱 | **Prompt guard** | Injects security policy/reminders into agent context by profile strategy. |
| **Stem** 🪵 | **Security gate** | `berry_check` tool decides if intended operation is allowed or denied. |
| **Thorn** 🌵 | **Runtime blocker** | Intercepts tool calls and blocks risky command/file patterns in enforce mode. |
| **Vine** 🌿 | **External guard** | Marks external-content risk and can block sensitive actions under active risk. |
| **Pulp** 🍇 | **Output scanner** | Redacts sensitive data in tool results and outgoing messages in enforce mode. |

See more:
- [Berry Shield layers](docs/wiki/layers/README.md)

---

## ⚙️ Modes and profiles

### Modes (`mode`)

| Mode | Behavior |
| :--- | :--- |
| `enforce` | **Active Defense**: Blocks/Redacts when patterns match. |
| `audit` | **Silent Observation**: Logs what *would* have happened (`would_block`, `would_redact`). |

### Profiles (`policy.profile`)

| Profile | Injection behavior |
| :--- | :--- |
| `strict` | **Full policy** injection every turn. |
| `balanced` | **Adaptive**: Full on first turn, then `short`/`none` depending on risk/staleness. |
| `minimal` | **Silent**: Minimal injection by default; escalates only on critical triggers. |


See more:
- [Berry Shield modes and profiles](docs/wiki/decision/modes.md)

---

## 🚧 Technical Limitations & SDK Diary

Berry Shield's effectiveness is tied to the underlying OpenClaw SDK capabilities. We maintain a detailed diary that tracks known bugs and blind spots across OpenClaw versions.

### Key Points for v2026.3.13:
*   **Hook Reliability**: In our v2026.3.13 checkpoint, `before_tool_call` and `message_sending` were observed as functional, but hook behavior remains runtime/version-dependent.
*   **Soft Guardrails**: Prompt-based defenses (`Berry.Root`) are advisory and can be bypassed by clever user instructions.
*   **Timing Gaps**: Redaction happens during persistence, which might create a transient data exposure.
*   **Host Hook Behavior**: If the host explicitly disables prompt-injection style prepend behavior for plugin hooks, `Berry.Root` guidance and Vine reminder text from `before_agent_start` can be partially degraded. This should be treated as host-configurable behavior, not as evidence that Berry Shield runtime protection is broken.

See more: 
-  [Security posture and known limits](docs/wiki/decision/posture.md)
-  [Installation guide host note](docs/wiki/deploy/installation.md#host-hook-note)

---

## 📚 Docs map

- Wiki overview: [docs/wiki/README.md](docs/wiki/README.md)
- Install and deploy: [docs/wiki/deploy/installation.md](docs/wiki/deploy/installation.md)
- CLI commands: [docs/wiki/operation/cli/README.md](docs/wiki/operation/cli/README.md)
- Layer internals: [docs/wiki/layers/README.md](docs/wiki/layers/README.md)
- Mode/profile decisions: [docs/wiki/decision/modes.md](docs/wiki/decision/modes.md)
- Pattern strategy: [docs/wiki/decision/patterns.md](docs/wiki/decision/patterns.md)
- Tutorials: [docs/wiki/tutorials/README.md](docs/wiki/tutorials/README.md)

---

## ⚖️ License

Apache-2.0. See [LICENSE](LICENSE).

For contributor workflow and internal quality process, see [CONTRIBUTING.md](CONTRIBUTING.md).
