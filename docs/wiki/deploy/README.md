---
summary: "Deployment index for installation tracks, local build flow, and GitHub CI/CD release flow"
read_when:
  - You need to install Berry Shield in a real environment
  - You need to choose between source-truth and release-truth deployment
  - You need pre-release validation and audit gates
  - You need the official GitHub release workflow (prepare-release/publish)
title: "Deploy Reference"
---

# `Deploy reference`

This domain explains how to deploy Berry Shield safely and repeatably.
It covers installation tracks, local build gates, GitHub release workflow, and validation flow.

## Deployment tracks

Berry supports two operational tracks:

- Source-truth track: run exactly what is in this repository (build from source).
- Release-truth track: consume published package artifact from the package registry.

Choose source-truth when you need repository-level auditability; choose release-truth when you need immutable package consumption.

## Pages

- [installation](installation.md): installation paths and post-install verification
- [build](build.md): local development build and preflight gates
- [github-ci-cd](github-ci-cd.md): official GitHub Actions release workflow (`normal` and `reconcile`)
- [auditing](auditing.md): wiki sanity and documentation quality gates

## Recommended sequence (local -> CI/CD)

1. Choose installation track (source-truth or release-truth).
2. Validate local quality gates using [build](build.md).
3. Create release branch and PR via [github-ci-cd](github-ci-cd.md) (`prepare-release`).
4. Merge release PR into `master`.
5. Run publish workflow in [github-ci-cd](github-ci-cd.md) (`normal` or `reconcile`).
6. Verify runtime mode/status/report.

## Related pages
- [wiki index](../README.md)
- [operation index](../operation/README.md)
- [CLI init](../operation/cli/init.md)
- [CLI status](../operation/cli/status.md)

---

## Navigation
- [Back to Wiki Index](../README.md)
- [Back to Repository README](../../../README.md)
