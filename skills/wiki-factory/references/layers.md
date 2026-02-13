# 🌿 Berry Shield Botanical Glossary

Each security layer in Berry Shield is named after a part of a plant. Use these factual definitions when documenting the system architecture.

## 1. Root (The Anchor)
- **Role**: Input Intent Filter (Prompt Guard).
- **Function**: Analyzes incoming prompts/requests for harmful intent (e.g., prompt injection, jailbreak attempts).
- **Placement**: Entry point of the gateway.

## 2. Pulp (The Core)
- **Role**: Output Redaction Engine.
- **Function**: Scans the processed output for PII, secrets, and sensitive tokens. Applies `walkAndRedact` with circular reference protection.
- **Key Tech**: Lazy Cloning, Unescape Sniper.

## 3. Leaf (The Surface)
- **Role**: File System Guard.
- **Function**: Restricts reading or writing to sensitive project files (e.g., `.env`, `.git`, `node_modules`).
- **Placement**: Around any file-system tool call.

## 4. Stem (The Conductor)
- **Role**: Command Execution Filter.
- **Function**: Validates shell commands before execution. Blocks destructive patterns (e.g., `rm -rf /`, `curl | bash`).
- **Placement**: Wrapped around terminal/bash tools.

## 5. Thorn (The Edge)
- **Role**: Environment & Network Guard.
- **Function**: Monitors and blocks unauthorized network requests or access to sensitive environment variables.
- **Placement**: At the system's boundary.
