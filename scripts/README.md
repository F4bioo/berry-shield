# Maintenance Scripts - Berry Shield

This directory contains utility scripts for project maintenance and security pattern updates.

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
