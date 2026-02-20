---
summary: "Installation guide for Berry Shield using source-truth or future release-truth tracks"
read_when:
  - You are deploying Berry Shield for local or production-like usage
  - You need a source-built deployment path
  - You need to verify plugin activation after installation
title: "installation"
---

# `Installation guide`

Berry Shield is an OpenClaw plugin.
This guide defines two installation tracks and when each one should be used.

## Prerequisites

- Node.js 20 or newer.
- OpenClaw runtime available in environment.
- Repository clone available for source-truth deployments.

## Official host reference

For OpenClaw plugin host behavior (manifest, discovery, install flows), see:
- https://docs.openclaw.ai/tools/plugin

## Track A: source-truth deployment (available now)

Use this track when you want runtime behavior to match repository source exactly.

### Build plugin artifact

```bash
npm run build
```
Expected: `dist/index.js` is generated successfully.

### Install plugin from local source path

Run this command from the Berry repository root after build.
```bash
openclaw plugins install .
```
Result: OpenClaw installs plugin package into state extensions directory (typically `~/.openclaw/extensions/<pluginId>`).

### Restart Gateway runtime

After install, restart the OpenClaw Gateway process used by your environment.
Result: Plugin registry reloads and Berry CLI/layers become available in runtime.

### Initialize plugin config and defaults

Run this command in the same environment where OpenClaw resolves Berry CLI commands and plugin config paths.
```bash
openclaw bshield init
```
Result: Berry config is created/updated and plugin enabled state is prepared.

### Verify runtime status

After initialization, verify runtime state immediately to confirm mode, policy, and layer activation are visible.
```bash
openclaw bshield status
```
Result: Status shows enabled state, mode, policy values, and active layers.

## Track B: release-truth deployment (future path)

Use this track when Berry is published as a package artifact and you want immutable release consumption.

Current state:
- Repository currently supports source-truth deployment directly.
- Use release-truth only after official npm package publication.

Install with:
```bash
openclaw plugins install @f4bioo/berry-shield
```
Expected: Plugin package is installed to OpenClaw extensions directory and can be enabled/loaded after gateway restart.

## Post-install validation checklist

1. Confirm plugin status is enabled.
2. Confirm desired mode (`enforce` or `audit`) is set.
3. Run one safe gate test and one deny-path test.
4. Confirm report command can read events.

## Related pages

- [deploy index](README.md)
- [build](build.md)
- [CLI init](../operation/cli/init.md)
- [CLI status](../operation/cli/status.md)
- [CLI report](../operation/cli/report.md)

---

## Navigation

- [Back to Deploy Index](README.md)
- [Back to Wiki Index](../README.md)
