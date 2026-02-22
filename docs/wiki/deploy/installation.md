---
summary: "Installation guide for Berry Shield using source-truth and release-truth tracks"
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
- Git available in environment.

## Official host reference

For official OpenClaw plugin installation behavior, see:
- https://docs.openclaw.ai/tools/plugin


### Quick navigation

> Choose one install track, then complete Section 3.

1. Source-truth installation: [Section 1](#section-1-source-truth-installation)
2. Release-truth installation: [Section 2](#section-2-release-truth-installation)

---

## Section 1: Source-truth installation

Use this flow when you want to install `Berry Shield` directly from the repository source code.

### Step 1: Clone repository from GitHub

```bash
git clone https://github.com/F4bioo/berry-shield.git
```
Expected: repository files are copied to a local `berry-shield` folder.

### Step 2: Enter repository root

```bash
cd berry-shield
```
Expected: terminal is at the Berry Shield project root.

### Step 3: Install dependencies

**Note:** If dependencies are already installed and current, skip to Step 4.

```bash
npm install
```
Expected: dependencies are installed without lockfile or platform errors.

### Step 4: Build plugin artifact

```bash
npm run build
```
Expected: `dist/index.js` is generated successfully.

### Step 5: Install plugin from local source path

Run from the root of the local `berry-shield` project folder.
```bash
openclaw plugins install .
```
Expected: OpenClaw installs the plugin into the extensions directory.

### Step 6: Restart Gateway runtime

Restart the OpenClaw Gateway process used by your environment.
Expected: plugin registry reloads and Berry CLI becomes available.

**Next:** [complete Section 3](#section-3-common-post-install-actions-applies-to-both-tracks).

---

## Section 2: Release-truth installation

Use this flow when you want to install Berry Shield from the published package in the registry.

### Step 1: Install from registry

```bash
openclaw plugins install @f4bioo/berry-shield
```
Expected: plugin package is installed to OpenClaw extensions directory.

### Step 2: Restart Gateway runtime

Restart the OpenClaw Gateway process used by your environment.
Expected: plugin registry reloads and Berry CLI becomes available.

**Next:** [complete Section 3](#section-3-common-post-install-actions-applies-to-both-tracks).

---

## Section 3: Common post-install actions (applies to both tracks)

### Step 1: Initialize plugin defaults

Run this command in the same environment where OpenClaw resolves Berry CLI commands and plugin config paths.
```bash
openclaw bshield init
```
Expected: Berry config is created/updated and plugin enabled state is prepared.

### Step 2: Verify runtime status

Run this command immediately after initialization to confirm active runtime settings.
```bash
openclaw bshield status
```
Expected output:
```terminaloutput
 ◇ Berry Shield ─────────────────────────────────────────────────────────────

   Status       ENABLED
   Mode         ENFORCE
   Rules        Built-in (143) - Custom (0)

   ◇ Policy
   Profile           BALANCED
   Escalation        3
   Stale (min)       30
   Heartbeat         0
   Global Escalation OFF

   ◇ Vine
   Mode                BALANCED
   Signals to Escalate 1
   Guard Turns         3
   Retention (entries) 10000
   Retention (ttl sec) 86400
   Allowlist           0 tool(s)

   ◇ Security Layers
   Root (Prompt Guard)   ACTIVE
   Pulp (Output Scanner) ACTIVE
   Thorn (Tool Blocker)  ACTIVE
   Leaf (Input Audit)    ACTIVE
   Stem (Security Gate)  ACTIVE
   Vine (External Guard) ACTIVE

   🍓 Berry Shield 2026.2.15 - Tip: Use 'openclaw bshield add' to create custom rules.
```

### Validation checklist

1. Confirm plugin status is enabled.
2. Confirm desired mode (`enforce` or `audit`) is set.
3. Run one safe gate test and one deny-path test.
4. Confirm report command can read events.

### CLI customization shortcut

Use this command to discover mode, layer, policy, and rules commands.

```bash
openclaw bshield --help
```
Usage Example: run this before changing defaults to review available command paths.

Expected output:
```terminaloutput
Usage: openclaw bshield [options] [command]

Berry Shield - Custom security rules management

Options:
  -h, --help  display help for command

Commands:
  add         Add a new security rule (interactive wizard if no args)
  help        display help for command
  init        Initialize Berry Shield configuration
  mode        Set operation mode (audit | enforce)
  policy      Manage policy settings (wizard, get, set)
  profile     Set policy profile (strict | balanced | minimal)
  report      Show global audit report from persisted events
  reset       Reset defaults (builtins or full scope)
  rules       Manage baseline and custom rules
  status      Show current status and configuration
  test        Test if input matches any security pattern
  toggle      Toggle a security layer on/off
  vine        Manage Berry.Vine settings and tool allowlist

For more info, visit: https://github.com/F4bioo/berry-shield


   🍓 Berry Shield 2026.2.15 - Tip: Redaction replaces sensitive data with markers to ensure privacy.
```

See more:
- [Berry Shield CLI reference](../operation/cli/README.md)

---

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
