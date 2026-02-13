# Build Pipeline

The Berry Shield build system is optimized for speed and safety, utilizing `esbuild` for zero-dependency bundling.

## Compilation Commands

### Standard Build
Compiles TypeScript into a single ESM bundle.
```bash
npm run build
```
- **Output**: `dist/index.js`
- **Target**: Node.js v20

### Type Checking
Aims to ensure total type safety across the project without emitting files.
```bash
npm run typecheck
```

## Release Workflow (`npm run release`)
The release script automates the complete technical audit:
1.  **Version Update**: Increments the CalVer string in `src/constants.ts`.
2.  **Build**: Generates the production bundle.
3.  **Type Check**: Validates the complete type graph.
4.  **Test**: Runs the Vitest suite against the production contract.

---
- [[Installation Guide]](installation.md)
- [[Auditing & Sanity]](auditing.md)
