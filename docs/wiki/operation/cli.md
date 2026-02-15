# CLI Reference

Berry Shield provides a comprehensive command-line interface for Managing security rules, monitoring system status, and configuring protection layers.

## Discovery & Assistance

### Global Help
Displays all available commands and global options.
```bash
openclaw bshield --help
```

### Command-Specific Help
Provides detailed usage, flags, and arguments for a specific command.
```bash
openclaw bshield [command] --help
```

---

## Plugin Lifecycle & Status

### System Initialization
Restores default configuration, assists in maintaining required directory structures, and resets the pattern registry.
```bash
openclaw bshield init
```

### Health Dashboard
Displays the current system status, including active layers, operating mode, and rule summary.
```bash
openclaw bshield status
```
*Usage Example:* Use this to check if your layers are active after a configuration change.

### Layer Management
Dynamically enables or disables a specific security layer (Root, Pulp, Leaf, Stem, Thorn).
```bash
openclaw bshield toggle [layer]
```
*Usage Example:* `openclaw bshield toggle root` — Temporarily disable prompt injection filtering.

---

## Operating Modes

### Mode: Enforce
Designed to block destructive actions and redact sensitive data from outputs.
```bash
openclaw bshield mode enforce
```

### Mode: Audit
Logs security violations for monitoring and auditing purposes without blocking system operations.
```bash
openclaw bshield mode audit
```
*Usage Example:* `openclaw bshield mode audit` — Safely test new rules in a production-like environment.

---

## Rule Management

### Adding Rules (Interactive)
Launches the Smart Assistant wizard with presets and Match Preview.
```bash
openclaw bshield add
```

### Adding Rules (Direct)
Registers a rule via terminal arguments.
```bash
openclaw bshield add [type] --name <name> --pattern <regex>
```
*Usage Example:* `openclaw bshield add secret --name "MyToken" --pattern "sk_live_[0-9a-z]{24}"`

**Options:**
- `-n, --name`: Unique technical identifier for the rule.
- `-p, --pattern`: Valid Regular Expression to match.
- `-r, --placeholder`: Custom text to replace matched data (for secrets).
- `-f, --force`: Overwrites an existing rule with the same name.

### Removing Rules
Deletes a custom rule by its technical identifier.
```bash
openclaw bshield remove <id>
```
*Usage Example:* `openclaw bshield remove "MyToken"`

---

## Inspection & Verification

### Pattern Registry
Lists all active rules on the system, categorized by source (Built-in or Custom).
```bash
openclaw bshield list
```

### Match Testing
Simulates how a specific string is processed by the current rule set.
```bash
openclaw bshield test "sample text"
```
*Usage Example:* `openclaw bshield test "My key is AKIA123..."` — Verify if a specific secret is detected.

---

## Global Options
- `--version`: Displays the current CalVer version.
- `--help`: Technical usage reference.

---
- [Operation Index](README.md)
- [Back to Wiki Index](../README.md)
