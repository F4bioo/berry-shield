# Engine & Performance

The core of Berry Shield is designed for efficiency and high-fidelity protection. It manages how strings and objects are scanned, cleaned, and optimized for both security and system resources.

## Core Engine Components

- [[Redaction Engine]](redaction.md): Patterns, Regex, and Gitleaks integration.
- [[Performance Otimizations]](performance.md): Lazy Cloning and RPi 4 memory management.
- [[Unescape Sniper]](redaction.md#unescape-sniper): Handling obfuscated or escaped sensitive data.

## Design Philosophy
Security execution often introduces latency. The Berry Shield engine aims to minimize this impact through **Context-Aware Processing**:
1. **Detection**: Identifying risks using community-driven patterns.
2. **Optimization**: Using selective cloning to preserve memory.
3. **Clarity**: Cleaning JSON and outputs to improve the LLM's context window.

---
- [[Back to Wiki Index]](../README.md)
