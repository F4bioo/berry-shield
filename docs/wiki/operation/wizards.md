# Interactive Wizards

To simplify complex security configurations, Berry Shield implements **Interactive Wizards** for common tasks.

## Rule Creation Wizard (`add`)
The `add` wizard guides the user through creating a new custom redaction pattern:

1.  **Rule ID Choice**: User provides a unique identifier (e.g., `my-custom-token`).
2.  **Regex Definition**: The user inputs the regular expression.
3.  **Confirmation**: A summary is shown before persistence.
4.  **Cancellation**: Users can opt-out at any step, triggering a clean exit and an expert tip.

## Rule Removal Wizard (`remove`)
The `remove` wizard provides a safe way to delete custom patterns:

1.  **Search/Select**: A searchable list of custom rules is presented.
2.  **Confirmation**: Aims to prevent accidental deletion of critical patterns.
3.  **Sync**: The system automatically refreshes the in-memory cache upon removal.

## Design Philosophy
Wizards use `@clack/prompts` to provide a clean, accessible terminal experience with consistent branding and error handling.

---
- [[CLI Reference]](cli.md)
- [[TUI Dashboard]](tui.md)
