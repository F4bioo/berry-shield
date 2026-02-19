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
Release now has mandatory gates both before and after version bump:
*   **Preflight**: `build`, `typecheck`, tests, and doc sanity.
*   **Postflight**: same validations re-run after bump to ensure final artifact integrity.

```bash
# Recommended: Full release cycle (Preflight -> Update -> Postflight)
npm run release

```

```bash
# Standalone: Just update file versions
npm run version:update

```

---

## Wiki Automation

This directory contains the "Wiki Factory" tools, used to maintain the project's technical documentation following the Diataxis framework and the Zero-Hype directive.

### Tools
1.  **`doc-factory.ts`**: Automatically extracts metadata and documentation from the source code.
2.  **`doc-sanity.ts`**: Validates the integrity of the Wiki (broken links, structure, and technical accuracy).

### How to use
```bash
# Generate technical documentation
npm run wiki:gen

# Validate wiki integrity
npm run wiki:claim
```

> See also:
> * [Wiki Content Reference](../docs/wiki/README.md)

---

