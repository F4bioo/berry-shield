# Interactive Wizards

To simplify complex security configurations, Berry Shield implements **Interactive Wizards** for common tasks.

## Rule Creation Wizard (`add`)
The `add` wizard launches the smart assistant to create a rule via presets or custom regex:

1.  **Rule Category**: User selects between Secret, File, or Command.
2.  **Pattern Presets**: User can choose a pre-configured template (e.g., Vercel, Supabase, Docker) or define a custom pattern.
3.  **Automatic Pre-fill**: If a preset is selected, data such as Name, Regex, and Placeholder are populated automatically.
4.  **Match Preview (Validation Loop)**: Before saving, the user tests the pattern against real inputs to verify match status in real-time.
5.  **Cancellation**: Users can opt-out at any step, triggering a clean exit and a terminal expert tip.

## Rule Removal Wizard (`remove`)
The `remove` wizard provides a safe way to delete custom patterns:

1.  **Search/Select**: A searchable list of custom rules is presented.
2.  **Confirmation**: Aims to prevent accidental deletion of critical patterns.
3.  **Sync**: The system automatically refreshes the in-memory cache upon removal.

## Design Philosophy
Wizards use `@clack/prompts` to provide a clean, accessible terminal experience with consistent branding and error handling.

---
- [CLI Reference](cli.md)
- [TUI Dashboard](tui.md)
