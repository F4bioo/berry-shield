---
summary: "Deployment index for installation tracks, build pipeline, and validation gates"
read_when:
  - You need to install Berry Shield in a real environment
  - You need to choose between source-truth and release-truth deployment
  - You need pre-release validation and audit gates
title: "Deploy Reference"
---

# `Deploy reference`

This domain explains how to deploy Berry Shield safely and repeatably.
It covers installation tracks, build/release gates, and validation workflow.

## Deployment tracks

Berry supports two operational tracks:

- Source-truth track: run exactly what is in this repository (build from source).
- Release-truth track: consume published package artifact from the package registry.

Choose source-truth when you need repository-level auditability; choose release-truth when you need immutable package consumption.

## Pages

- [installation](installation.md): installation paths and post-install verification
- [build](build.md): build, typecheck, test, and release gates
- [auditing](auditing.md): wiki sanity and documentation quality gates

## Recommended deployment sequence

1. Choose installation track (source-truth or release-truth).
2. Build and install the plugin artifact.
3. Restart gateway runtime and initialize plugin config.
4. Run tests and wiki sanity gates.
5. Verify runtime mode/status/report.

## Related pages
- [wiki index](../README.md)
- [operation index](../operation/README.md)
- [CLI init](../operation/cli/init.md)
- [CLI status](../operation/cli/status.md)

---

## Navigation
- [Back to Wiki Index](../README.md)
- [Back to Repository README](../../../README.md)
