# Berry Shield Wiki

Technical documentation for Berry Shield, the security architecture for OpenClaw. This Wiki follows the **Diátaxis** framework.

## [Anatomy & Concepts](anatomy/README.md)
*Technical explanation of the system architecture.*
- [The 5 Security Layers](anatomy/README.md)
- [Security Philosophy](anatomy/README.md#architectural-philosophy)

## [Decision & Modes](decision/README.md)
*How Berry Shield makes security decisions.*
- [Audit vs Enforce](decision/modes.md)
- [Pattern Matching Library](decision/patterns.md)
- [Security Posture & SDK Diary](decision/security-posture.md)

## [Engine & Performance](engine/README.md)
*The core redaction and optimization logic.*
- [Redaction Engine](engine/redaction.md)
- [Match Engine & ReDoS](engine/match-engine.md)
- [Lazy Cloning & RPi 4](engine/performance.md)

## [Operation & Wizards](operation/README.md)
*Using the CLI and Interactive Assistants.*
- [Interactive Wizards](operation/wizards.md)
- [CLI Reference](operation/cli.md)

## [Deployment & Installation](deploy/README.md)
*How to build, install, and audit Berry Shield.*
- [Installation Guide](deploy/installation.md)
- [Build Pipeline](deploy/build.md)

## [Technical Reference](reference/README.md)
*Information-oriented documentation generated from source code.*
- [API Documentation](reference/README.md)
- [Orion Map Index](reference/ORION_MAP.md)

---

## How-to Guides
*Practical step-by-step guides for specific security tasks.*
- [Configuring Rules](operation/configuring-rules.md)
- [Managing Patterns](operation/managing-patterns.md)

## Tutorials
*Learning-oriented guides for new users.*
- [Your First Secure Session](tutorials/secure-session.md)

---

> [!WARNING]
> This Wiki is a work in progress. Some sections may be incomplete or incorrect.
