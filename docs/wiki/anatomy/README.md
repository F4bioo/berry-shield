# Anatomy of Berry Shield

Berry Shield follows a **5-layer security architecture**. This structure is designed to offer a layered approach to LLM security.

## Core Security Layers

- [[Root (Prompt Guard)]](root.md): Entry-point intent filtering.
- [[Pulp (Output Scanner)]](pulp.md): Core redaction layer.
- [[Thorn (Edge Guard)]](thorn.md): Environment and network monitoring.
- [[Leaf (File Guard)]](leaf.md): Surface/File-system monitoring.
- [[Stem (Command Guard)]](stem.md): Conductor for shell execution strings.

## Architectural Philosophy
The system is built on the principle of **Defensive layering**. If a layer is bypassed or misconfigured, subsequent layers are intended to provide specialized monitoring based on the context of the operation (Input, Output, Files, Shell, or Env).

---
- [[Back to Wiki Index]](../README.md)
