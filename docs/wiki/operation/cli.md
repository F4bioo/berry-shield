# CLI Reference

Berry Shield exposes a comprehensive CLI under the `openclaw bshield` namespace.

## Base Commands
All commands follow the pattern:
`openclaw bshield <command> [options]`

| Command | Action | Description |
| :--- | :--- | :--- |
| `status` | View Dashboard | Displays the Lobster TUI with system health and rule counts. |
| `list` | List Rules | Enumerates all active patterns, grouping by Source (Built-in/Custom). |
| `add` | Add Rule | Launches the interactive Wizard to create a new regex pattern. |
| `remove` | Remove Rule | Launches the selection Wizard to delete a custom pattern. |
| `init` | Initialize | Sets up the initial configuration and directory structure. |
| `toggle` | Switch Mode | Toggles between `enforce` (blocking) and `monitor` (logging). |

## Global Flags
- `--help`: Technical usage and GitHub links.
- `--version`: Displays current CalVer (e.g., 2026.02.13).

---
- [[TUI Dashboard]](tui.md)
- [[Interactive Wizards]](wizards.md)
