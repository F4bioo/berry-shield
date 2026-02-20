---
summary: "Build and release pipeline reference aligned to package scripts and quality gates"
read_when:
  - You are preparing a deployable artifact
  - You need to run pre-release quality gates
  - You are validating script-driven release flow
title: "build"
---

# `Build pipeline`

Berry build and release flow is script-driven from package.json.
This page reflects current executable gates exactly as implemented.

## Core build commands

### Build artifact

```bash
npm run build
```
Expected: `dist/index.js` is generated from `src/index.ts`.

### Type checking

```bash
npm run typecheck
```
Result: TypeScript graph is validated without emitting files.

### Test suite

```bash
npm run test
```
Result: Vitest suite executes and reports pass/fail status.

## Release gates

### Preflight gate

```bash
npm run release:preflight
```
Result: Runs build, typecheck, `vitest` on `__tests__`, and wiki sanity gate.

### Full release flow

```bash
npm run release
```
Result: Executes preflight, updates version, then runs postflight validation again.

## What release currently validates

- Build success.
- Type safety.
- Test suite status.
- Wiki sanity gate status (`npm run wiki:claim`).

## Practical use guidance

- For normal development deploy checks, run build + typecheck + test.
- For release candidate verification, run release:preflight.
- For full versioned release process, run release.

## Related pages

- [deploy index](README.md)
- [installation](installation.md)
- [auditing](auditing.md)

---

## Navigation

- [Back to Deploy Index](README.md)
- [Back to Wiki Index](../README.md)
