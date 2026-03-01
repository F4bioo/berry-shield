---
summary: "GitHub Actions release workflow reference for prepare-release and publish (normal/reconcile)"
read_when:
  - You are preparing an official Berry Shield release
  - You need to run publish workflow in normal or reconcile mode
  - You need deterministic recovery for partial release failures
title: "github-ci-cd"
---

# `GitHub CI/CD Release Flow`

This page documents the official release workflow executed in GitHub Actions.
It is self-contained and intended for operators with no prior project context.

## Preconditions

- You are on the repository default operational branches:
  - `develop` for `prepare-release`
  - `master` for `publish`
- `NPM_TOKEN` is configured in repository secrets.
- `RELEASE_PR_TOKEN` is configured in repository secrets.
- Repository permissions allow workflow-created branches, tags, PRs, and releases.

## Workflow 1: Prepare Release (`develop`)

### Trigger

```bash
GitHub Actions -> Prepare Release -> Run workflow (branch: develop)
```
Expected: workflow runs on `develop` and does not skip.

### What it does

1. Runs `npm ci`.
2. Bumps CalVer using `npm run version:update`.
3. Runs local technical gates (`typecheck`, tests, build).
4. Reads version and generates changelog notes.
5. Creates branch `release/v{version}`.
6. Commits only version bump files.
7. Pushes release branch.
8. Opens PR `release/v{version} -> master`.

### Expected output

- A new release branch exists on remote.
- A release PR to `master` exists with changelog in body.

## Workflow 2: Publish (`master`)

### Trigger

```bash
GitHub Actions -> Publish -> Run workflow (branch: master)
```
Expected: workflow runs on `master` and does not skip.

### Inputs

- `mode` (required): `normal` or `reconcile`
- `version` (optional): if empty, workflow reads `package.json` version.
- `confirm_publish` (required when publish is needed): set to `PUBLISH_NOW` to allow npm publish steps.

## Publish Modes

### `mode=normal`

Use when state is clean (`npm=no`, `tag=no`, `release=no`).

Flow:
1. Build + verify `dist/index.js`.
2. Validate common contract source (`.github/common-contract.json`).
3. Detect current state.
4. If npm publish is required, validate `confirm_publish=PUBLISH_NOW`.
5. Pack artifact (`.tgz`) and generate `SHA256SUMS`.
6. Create git tag `v{version}`.
7. Create GitHub Release as `draft` with `.tgz` + `SHA256SUMS`.
8. Publish npm using the same `.tgz`.
9. Promote release from draft to published.

### `mode=reconcile`

Use when release state is partial and metadata must be completed safely.

Rules:
- Never republish an already published npm version.
- Never recreate existing tag.
- Only complete missing metadata and/or promote draft release.

## Canonical State Model

- `npm_published`: `yes` / `no`
- `tag_exists`: `yes` / `no`
- `release_state`: `no` / `draft` / `published`

Valid transitions:
1. `no,no,no` + `normal` -> full release.
2. `no,yes,no` + `reconcile` -> create draft, publish npm, promote.
3. `no,yes,draft` + `reconcile` -> publish npm, promote.
4. `yes,yes,draft` + `reconcile` -> promote only.
5. `yes,yes,published` + any mode -> no-op success.

Invalid state:
- `npm=yes, tag=no` -> manual intervention required; workflow aborts.

## Recovery Guide

### Symptom: publish failed in partial state

1. Inspect workflow logs and detected state (`npm/tag/release`).
2. Confirm npm version:

```bash
npm view @f4bioo/berry-shield version
```
Expected: returns target version if npm was already published.

3. Re-run `Publish` with `mode=reconcile` and same target version.
4. Do not run `npm publish` manually for an already published version.

### Symptom: mode mismatch

- Error: `Invalid state for mode=normal...`
- Action: rerun with `mode=reconcile`.

## Workflow 3: develop-sync (Automatic, Conditional)

### Trigger

- Runs on `pull_request.closed` when base is `master`.
- Continues only when:
  - PR was merged,
  - head branch matches `release/v...`.

### What it does

1. Detects whether `develop` is already aligned.
2. If alignment is needed, creates `sync/master-to-develop-v{version}` from `master`.
3. Opens PR `sync/master-to-develop-v{version} -> develop`.
4. Uses versioned template body from `.github/templates/pr-body-sync.md` with:
   - `SYNC_VERSION`
   - `SYNC_SOURCE_BRANCH`
   - `SYNC_SOURCE_SHA`
5. No-op when `develop` already contains `master`.

## Release Assets Contract

Every successful publish must end with GitHub Release assets:
- `<package>-<version>.tgz` (from `npm pack`)
- `SHA256SUMS` (hash file for the same `.tgz`)

This keeps artifact parity between npm and GitHub Release.

## Operational DoD (Required Evidence per release cycle)

1. `prepare-release` completed successfully.
2. Release branch `release/v{version}` exists and PR `release/v{version} -> master` exists.
3. Release PR checks are green and merged into `master`.
4. `publish` completed successfully in `normal` or `reconcile` mode.
5. Sync PR `master -> develop` is auto-created only when branch alignment is required.

## Related pages
- [deploy index](README.md)
- [installation](installation.md)
- [build (local dev)](build.md)
- [auditing](auditing.md)

---

## Navigation
- [Back to Deploy Index](README.md)
- [Back to Wiki Index](../README.md)
