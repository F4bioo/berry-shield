---
summary: "GitHub Actions release workflow reference for prepare-release and publish-release"
read_when:
  - You are preparing an official Berry Shield release
  - You need to run publish-release safely with target version
  - You need deterministic recovery for partial release failures
title: "github-ci-cd"
---

# `GitHub CI/CD Release Flow`

This page documents the official release workflow executed in GitHub Actions.
It is self-contained and intended for operators with no prior project context.

## Preconditions

- Repository flow is trunk-based (`master` only).
- `NPM_TOKEN` is configured in repository secrets.
- `RELEASE_PR_TOKEN` is configured in repository secrets.
- Repository permissions allow workflow-created branches, tags, PRs, and releases.

## Workflow 1: Prepare Release (`master`)

### Trigger

```bash
GitHub Actions -> Prepare Release -> Run workflow (branch: master)
```
Expected: workflow runs on `master` and does not skip.

### What it does

1. Evaluates CalVer date vs current date.
2. Decides whether to bump, reuse, or no-op based on workflow inputs.
3. Creates or updates PR `release/v{version} -> master`.
4. Writes `Release-Mode` in PR body (`release_now` or `bump_only`).
5. On merge of release PR, if `release_now`:
   - creates tag `v{version}`
   - creates draft release
   - attaches `.tgz` and `SHA256SUMS`.
6. If there is no required bump and `create_release_after_merge=false`, workflow ends as `NO_OP/IDLE` (no branch, no PR, no release).

### Expected output

- A release branch exists or an existing release PR is updated.
- A release PR to `master` exists with `Release-Mode` marker in body.
- Or `NO_OP/IDLE` is reported explicitly when no release action is required.

## Release Notes Behavior (Draft Creation)

When draft release notes are generated:
- only PR titles with public types are included (`feat`, `fix`, `perf`, `security`);
- bot-authored PRs are excluded;
- first release falls back to `firstReleaseNotes` from `.github/common-contract.json`.

## Workflow 2: Publish Release (`master`)

### Trigger

```bash
GitHub Actions -> Publish Release -> Run workflow (branch: master)
```
Expected: workflow runs on `master` and does not skip.

### Inputs

- `target_version` (required): `vYYYY.M.D` or `YYYY.M.D` (supports `-N`)
- `confirm_publish` (required): must be `PUBLISH_NOW`

## Publish flow

1. Resolves draft release by exact `target_version` (fail-closed).
2. Downloads draft assets.
3. Validates `SHA256SUMS`.
4. Verifies npm target version does not already exist.
5. Publishes the exact downloaded `.tgz`.
6. Promotes release draft to published.

## Release Assets Contract

Every successful publish must end with GitHub Release assets:
- `<package>-<version>.tgz` (from `npm pack`)
- `SHA256SUMS` (hash file for the same `.tgz`)

This keeps artifact parity between npm and GitHub Release.

## Operational DoD (Required Evidence per release cycle)

1. `prepare-release` completed successfully.
2. Release branch `release/v{version}` exists and PR `release/v{version} -> master` exists.
3. Release PR checks are green and merged into `master`.
4. `publish-release` completed successfully with `target_version`.
5. Release moved from draft to published with the same assets used in npm publish.

## Related pages
- [deploy index](README.md)
- [installation](installation.md)
- [build (local dev)](build.md)
- [auditing](auditing.md)

---

## Navigation
- [Back to Deploy Index](README.md)
- [Back to Wiki Index](../README.md)
