# Maintenance Scripts - Berry Shield

This directory contains utility scripts for project maintenance and security pattern updates.

---

## `update-patterns.ts`

This script drives the security intelligence of Berry Shield by connecting the project to the [Gitleaks](https://github.com/gitleaks/gitleaks) community knowledge base.

### What it does
1.  **Fetches**: Downloads the latest official Gitleaks configuration file (`gitleaks.toml`).
2.  **Processes**: Parses hundreds of secret detection rules.
3.  **Validates**: Tests each RegEx to ensure compatibility with Node.js (filtering out incompatible Go-specific rules).
4.  **Generates**: Creates the `src/patterns/generated.ts` file, which is then imported by the plugin.

### How to use
To update the security definitions:

```bash
# Via npm script (recommended)
npm run update-patterns

```

```bash
# Or directly via ts-node
npx ts-node --esm scripts/update-patterns.ts

```

### License & Credits
The generated rules are derived from the Gitleaks project (MIT License). The script automatically adds the necessary license headers to the generated file.

---

## `update-version.ts`

This script manages the project's **CalVer** (Calendar Versioning) strategy, ensuring automated and consistent releases synchronized across all files.

### Context (CalVer)
It enforces a **`YYYY.M.D`** format based on the current date:
*   **First build of the day**: Clean version (e.g., `2026.2.11`).
*   **Subsequent builds**: Appends an incremental suffix (e.g., `2026.2.11-1`, `2026.2.11-2`).

### What it does
1.  **Calculates**: Determines the next logical version based on the system date and previous version.
2.  **Synchronizes**: Updates all project manifests atomically:
    *   `package.json` & `package-lock.json` (via `npm version`)
    *   `src/index.ts` (Source code constant)
    *   `openclaw.plugin.json` (Plugin manifest)

### How to use
This script is automatically triggered by the release command.
Release has mandatory preflight gates before version bump:
*   **Preflight**: `build`, `typecheck`, tests, and doc sanity.

```bash
# Recommended: Full release cycle (Preflight -> Update)
npm run release

```

```bash
# Standalone: Just update file versions
npm run version:update

```

---

## `doc-sanity.ts`

This script validates the wiki content contracts used by Berry Shield documentation.

### What it does
1.  **Validates links**: Detects broken internal references.
2.  **Validates structure**: Enforces required metadata and section contracts.
3.  **Validates tone**: Applies technical writing constraints (Diataxis + Zero-Hype).

### How to use
```bash
# Validate wiki content contracts/sanity
npm run wiki:claim
```

### Recommended workflow
- Day-to-day editing: run `npm run wiki:claim` before commit.
- Pre-PR / CI parity: run `npm run wiki:claim` and ensure no blocking failures.

> See also:
> * [Wiki Content Reference](../docs/wiki/README.md)

---

## `version-utils.ts`

This module provides shared version parsing and formatting helpers used by `update-version.ts`.

### What it does
1.  **Parses versions**: Interprets CalVer strings and optional build suffixes.
2.  **Formats versions**: Generates normalized version outputs.
3.  **Supports update logic**: Keeps version calculations deterministic and reusable.

### How to use
This file is a support module and is not intended to be executed directly.
It is imported by `scripts/update-version.ts`.

---

## Navigation
- [Back to Repository README](../README.md)
