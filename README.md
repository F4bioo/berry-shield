# 🍓 Berry Shield

> Security plugin for OpenClaw - blocks destructive commands, redacts secrets and PII

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](package.json)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-plugin-green.svg)](https://docs.openclaw.ai/tools/plugin)

## Overview

Berry Shield is a comprehensive security plugin that implements a **5-layer defense system** to protect your OpenClaw sessions from accidental data leaks and destructive operations.

## 🏰 Architecture

| Layer | Name | Function |
|-------|------|----------|
| 🌱 | **Berry.Root** | Prompt Guard - injects security policies into agent context |
| 🍇 | **Berry.Pulp** | Output Scanner - redacts secrets/PII from tool outputs |
| 🌵 | **Berry.Thorn** | Tool Blocker - blocks dangerous tool calls before execution |
| 🍃 | **Berry.Leaf** | Input Audit - logs messages for security auditing |
| 🌿 | **Berry.Stem** | Security Gate - tool-based checkpoint the agent must call |

```
┌─────────────────────────────────────────────────────────────┐
│                    AGENT FLOW                               │
├─────────────────────────────────────────────────────────────┤
│  User        Berry.Root      Berry.Stem      Tool           │
│  Message  →  (inject     →   (checkpoint) →  Execution      │
│              policies)       (agent calls    (exec, read)   │
│                              before ops)                    │
├─────────────────────────────────────────────────────────────┤
│              Berry.Leaf                      Berry.Thorn    │
│              (logs input)                    (blocks tools) │
├─────────────────────────────────────────────────────────────┤
│                         Berry.Pulp                          │
│                    (redacts outputs)                        │
└─────────────────────────────────────────────────────────────┘
```

## Installation

```bash
# Copy plugin to OpenClaw extensions directory
openclaw plugins install ./berry-shield

# Or link for development
openclaw plugins install -l ./berry-shield

# Enable the plugin
openclaw plugins enable berry-shield
```

## Configuration

Configure via `~/.openclaw/config.json`:

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
      "sensitiveFilePaths": [],
      "destructiveCommands": []
    }
  }
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `"enforce"` \| `"audit"` | `"enforce"` | Enforce blocks/redacts, audit only logs |
| `layers.root` | boolean | `true` | Enable Berry.Root (prompt guard) |
| `layers.pulp` | boolean | `true` | Enable Berry.Pulp (output scanner) |
| `layers.thorn` | boolean | `true` | Enable Berry.Thorn (tool blocker) |
| `layers.leaf` | boolean | `true` | Enable Berry.Leaf (input audit) |
| `layers.stem` | boolean | `true` | Enable Berry.Stem (security gate) |
| `sensitiveFilePaths` | string[] | `[]` | Additional file path patterns (regex) |
| `destructiveCommands` | string[] | `[]` | Additional command patterns (regex) |

### Custom Patterns Example

```json
{
  "plugins": {
    "berry-shield": {
      "sensitiveFilePaths": [
        "\\.my-secrets$",
        "internal/config\\.json$"
      ],
      "destructiveCommands": [
        "DROP\\s+TABLE",
        "TRUNCATE\\s+TABLE"
      ]
    }
  }
}
```

## What Gets Protected

### Secrets Detection

- AWS Keys (Access Key ID, Secret Access Key)
- API Keys (OpenAI, Anthropic, Stripe, GitHub, Slack, SendGrid, NPM)
- Private Keys (RSA, SSH, PGP certificates)
- Tokens (JWT, Bearer, OAuth)
- Generic credentials and connection strings

### PII Detection

- Email addresses
- Phone numbers (US and international)
- Social Security Numbers (SSN)
- Credit card numbers
- Brazilian CPF/CNPJ
- IBAN numbers

### Sensitive Files

- `.env`, `.env.local`, `.env.production`
- `credentials.json`, `secrets.yaml`
- `.pem`, `.key`, `.p12`, `.pfx`
- `id_rsa`, `known_hosts`
- `.aws/credentials`, `.kube/config`
- `/etc/shadow`, `/etc/passwd`

### Destructive Commands

- `rm`, `rmdir`, `unlink`, `del`
- `format`, `mkfs`
- `dd if=`

## The `berry_check` Tool

Berry.Stem registers a tool the agent is instructed to call before dangerous operations:

```typescript
// Agent calls this before exec or read
berry_check({ operation: "exec", target: "rm -rf /" })
// Returns: STATUS: DENIED, REASON: Destructive command detected

berry_check({ operation: "read", target: ".env" })
// Returns: STATUS: DENIED, REASON: Sensitive file detected

berry_check({ operation: "read", target: "README.md" })
// Returns: STATUS: ALLOWED
```

## Logs

Logs are written to the OpenClaw log file:

```
/tmp/openclaw/openclaw-YYYY-MM-DD.log
```

Security events are logged in JSON format for easy parsing:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "event": "message_received",
  "sessionKey": "abc123",
  "containsSecrets": true,
  "sensitiveTypes": ["AWS Access Key"]
}
```

## Operational Modes

### Enforce Mode (default)

- Blocks destructive commands
- Blocks sensitive file access
- Redacts secrets/PII from outputs
- Logs all security events

### Audit Mode

- Logs all detections without blocking
- Useful for testing patterns before enforcement
- No modifications to tool outputs

## Development

```bash
# Clone the repository
git clone <repo-url>
cd berry-shield

# Install dependencies (development only)
npm install

# Link for development
openclaw plugins install -l ./
```

## Project Structure

```
berry-shield/
├── src/
│   ├── index.ts              # Plugin entry point
│   ├── layers/
│   │   ├── root.ts           # Prompt Guard
│   │   ├── pulp.ts           # Output Scanner
│   │   ├── thorn.ts          # Tool Blocker
│   │   ├── leaf.ts           # Input Audit
│   │   └── stem.ts           # Security Gate
│   ├── patterns/
│   │   └── index.ts          # Regex patterns
│   ├── types/
│   │   └── config.ts         # Configuration types
│   └── utils/
│       └── redaction.ts      # Redaction utilities
├── package.json
├── openclaw.plugin.json
└── tsconfig.json
```

## Known Limitations

1. **Timing Gap in Berry.Pulp**: The LLM may see tool output BEFORE the `tool_result_persist` hook runs. Berry.Root policies help mitigate this.

2. **Hook Availability**: `before_tool_call` may not be wired in all OpenClaw versions. Berry.Stem provides a fallback mechanism.

3. **Pattern Matching**: Regex-based detection may have false positives/negatives. Custom patterns can be added via configuration.

## License

MIT
