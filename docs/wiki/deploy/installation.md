# Installation Guide

Berry Shield is designed as a modular plugin for the **OpenClaw** ecosystem.

## Prerequisites
- **Node.js**: v20 or higher.
- **OpenClaw Core**: Installed and configured.
- **Dependencies**: `npx` capability for running TS-Node scripts.

## Setup Steps

### 1. Integration
Add the plugin path to your `package.json` under the `openclaw` configuration block:
```json
{
  "openclaw": {
    "extensions": [
        "./dist/index.js"
    ]
  }
}
```

### 2. Initialization
Run the initialization command to create the necessary directory structure and default rules:
```bash
openclaw bshield init
```

### 3. Verify
Run the status command to confirm the shield is active and in `enforce` mode:
```bash
openclaw bshield status
```

---
- [[Build Pipeline]](build.md)
- [[Auditing & Sanity]](auditing.md)
