---
name: wiki-factory
description: Technical automation for generating granular Wiki documentation (Diátaxis) from code. Use for (1) Generating technical reference, (2) Architecting architectural explanations, (3) Ensuring No-Hype and factual accuracy.
metadata:
  {
    "openclaw": { "emoji": "🏭", "requires": { "anyBins": ["typedoc"] } },
  }
---

# 🛡️ Wiki Factory Skill

This skill provides a high-level framework for automating and maintaining Berry Shield's documentation. It follows the **Zero Hype** directive and the **Diátaxis** structural framework.

> [!CAUTION]
> **NO-HYPE DIRECTIVE**: All generated content must be factual, technical, and modest. Prohibited: "mastery", "revolutionary", "professional", "perfect".

## 🏛️ Domain Reference

To maintain technical accuracy, read these references before generating content:

- **[Botanical Glossary](references/layers.md)**: Standard names and roles for all security layers (Root, Pulp, Leaf, Stem, Thorn).
- **[Diátaxis Framework](references/diataxis.md)**: Guidance on structural categories (Tutorials, How-to, Reference, Explanation).

## 🎨 Content Templates

Use these templates to ensure visual and structural consistency:

- **[Technical Reference](templates/reference.md)**: For auto-generated API and module docs.
- **[Architectural Explanation](templates/explanation.md)**: For high-level design and rationale docs.

## 🛠️ Operational Workflow

### 1. Generate Technical Reference
Run the factory script to extract AST metadata and generate Markdown files.
```bash
npm run wiki:gen
```
The script is located at `skills/wiki-factory/scripts/doc-sanity.ts`.

### 2. Crafting High-Level Pages
When asked to create Tutorials, How-to Guides, or Explanations:
1. Load the corresponding **template**.
2. Consult the **Botanical Glossary** for naming.
3. Apply the **No-Hype** rule to every sentence.

## ⚠️ Rules
1. **Never use adjectives** that imply quality or superiority (e.g., "amazing", "robust" - use "tested with 1MB payload" instead).
2. **Deterministic Links**: Always use relative links between Wiki pages.
3. **AST Truth**: If code and documentation conflict, the code (AST) is the single source of truth.
