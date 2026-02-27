---
summary: "Security-audit note that maps OpenClaw install-time heuristic warnings to Berry Shield source paths"
read_when:
  - You saw OpenClaw install-time warnings and want a direct code-level explanation
  - You are auditing why host integration patterns are flagged by static heuristics
title: "Security Audit"
---

# `Berry Shield Security Audit`

This project is open source and community-auditable by design.

During `openclaw plugins install`, OpenClaw may show heuristic warnings such as:
```text
WARNING: Plugin "berry-shield" contains dangerous code patterns: Shell command execution detected (child_process) (.../berry-shield/dist/index.js:xxxx); Environment variable access combined with network send — possible credential harvesting (.../berry-shield/dist/index.js:xxxx)
```

For Berry Shield, these warnings are expected from legitimate host-integration behavior:
- `src/config/wrapper.ts:1` uses Node `child_process` invocation to call OpenClaw CLI config commands.
- `src/config/wrapper.ts:58` reads `OPENCLAW_EXECUTABLE` / `OPENCLAW_BIN` to resolve runtime binary path.

**Note:** Line numbers reported in `dist/index.js` can point to bundled code regions and are not always a direct 1:1 map to source declarations.

No hidden trust model is required:
- install if you want,
- audit if you want,
- verify directly in source.

## Positioning

- Berry Shield is explicit about security behavior and limits.
- Install-time warnings are treated as signals to inspect, not as automatic proof of malicious code.
- Documentation must map warnings to concrete code paths whenever possible.

## Why these patterns exist

Berry Shield needs host integration to read/write plugin config through OpenClaw itself.
Without this bridge, CLI and runtime config sync would be unreliable across environments.

```javascript
import { execFile } from "node:child_process";

function getOpenClawCommand() {
  // Host/runtime override for different environments (dev, CI, custom install)
  return process.env.OPENCLAW_EXECUTABLE || process.env.OPENCLAW_BIN || "openclaw";
}

async function setPluginConfig(path, value) {
  // Berry uses OpenClaw CLI as source of truth for persisted config
  // (instead of writing random files directly).
  const command = getOpenClawCommand();
  await execFile(command, ["config", "set", path, JSON.stringify(value), "--json"]);
}
```

Source of truth: [`src/config/wrapper.ts`](src/config/wrapper.ts)

If this integration did not exist, Berry Shield would lose deterministic config behavior and cross-environment compatibility.

---

## Verification

1. Verify installed plugin identity and runtime wiring:

```bash
openclaw plugins info berry-shield
```
Expected output:
```terminaloutput
Berry Shield
id: berry-shield
Security plugin designed to mitigate flagged commands and redact detected secrets/PII

Status: loaded
Source: ~/.openclaw/extensions/berry-shield/dist/index.js
Origin: global
Version: 2026.2.15
Tools: berry_check
CLI commands: bshield

Install: path
Source path: ~/berry-shield
Install path: ~/.openclaw/extensions/berry-shield
Recorded version: 2026.2.15
Installed at: 2026-02-22T18:18:52.793Z
```

## Related pages
- [Installation Guide](docs/wiki/deploy/installation.md)
- [Security Posture](docs/wiki/decision/posture.md)

---

## Navigation
- [Back to Repository README](README.md)
