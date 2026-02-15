# Auditing & Sanity

Berry Shield documentation is protected by an automated **Sanity Guardian** to prevent information decay and ensure a modest, technical tone.

## The Sanity Auditor (`npm run wiki:claim`)
The auditor performs three core technical checks:

### 1. AST-Doc Integrity
Aims to ensure that every symbol (classes, functions, interfaces) mentioned in the manual documentation exists and is exported in the source code.
- **Goal**: Prevent "ghost features" that were deleted or renamed from remaining in the Wiki.

### 2. Semantic Hedging & Tone
Identifies absolute promises and sensationalist language.
- **Hype Density**: Alerts when a document exceeds the threshold for promotional adjectives.
- **Hedging**: Requires words like "aims to" or "designed to" when discussing security mitigations.

### 3. Evidence-Based Validation
Cross-references architectural claims with code footprints.
- **Example**: If a document claims "PII Redaction", the auditor verifies the presence of redaction logic in the `src/` directory.

## Maintenance Workflow
When contributing to the Wiki, the following workflow is recommended:
1.  **Draft**: Write the documentation in `docs/wiki/`.
2.  **Audit**: Run `npm run wiki:claim` to verify technical and editorial purity.
3.  **Refine**: Fix any symbol mismatches or "hype" warnings reported by the guardian.

---
- [Installation Guide](installation.md)
- [Build Pipeline](build.md)
