# CLI TUI Design Guide

This guide defines the internal UI conventions for Berry Shield CLI screens.

## Principles

- Keep output consistent across commands.
- Prefer `ui` helpers over raw `console.log`.
- Use explicit visual hierarchy: header, rows/messages, footer.
- Keep cancellation behavior predictable in interactive flows.
- Do not print ad-hoc emojis in CLI output.

## Theme and Symbols (Single Source of Truth)

All visual tokens must come from:

- `src/cli/ui/theme.ts` (`theme` color and text helpers)
- `src/cli/ui/theme.ts` (`symbols` glyph tokens)
- `src/cli/ui/tui.ts` (`ui` layout primitives)

### Rule: no direct emojis in command output

Do not hardcode emojis or custom glyphs inside commands.
If a new visual marker is needed:

1. Add it to `symbols` in `src/cli/ui/theme.ts`.
2. Reuse it via `ui` helpers or command output.

This keeps output deterministic and prevents visual drift across commands.

### What belongs in `theme`

Use `theme` for styling text, not for business logic:

- `theme.accent(...)` / `theme.accentBold(...)` for section emphasis
- `theme.muted(...)` for secondary labels
- `theme.success(...)`, `theme.warning(...)`, `theme.error(...)` for semantic state
- `theme.dim(...)` for non-primary hints
- `theme.version(...)`, `theme.tipText(...)` for footer formatting

### Color Palette Reference

`theme.ts` defines `BERRY_PALETTE` as the only CLI color source.

- `accent` (`#FF5A2D`): section titles and high-visibility labels
- `accentBright` (`#FF7A3D`): version and highlighted footer details
- `muted` (`#8B7F77`): secondary labels and low-priority metadata
- `success` (`#2FBF71`): positive outcomes and enabled state
- `warning` (`#FFB000`): caution, risky actions, broad-pattern warnings
- `error` (`#E23D2D`): failures, blocked operations, invalid input
- `border` (`#3C414B`): separators and layout structure lines
- `marker` (`#7DD3A5`): neutral header marker

Usage rule:
- Commands must never hardcode ANSI color sequences.
- New color behavior must be added to `theme.ts` first, then consumed via `theme.*`.

### What belongs in `symbols`

Use `symbols` for semantic markers only:

- `symbols.marker` for neutral headers
- `symbols.success` for positive state
- `symbols.warning` for caution
- `symbols.error` for failures
- `symbols.brand` for brand token in footer

Do not create one-off symbols inside commands.

## Standard Layout

For command screens, follow this order:

1. `ui.header(...)`
2. `ui.row(...)` and/or `ui.successMsg(...)` / `ui.failureMsg(...)`
3. `ui.footer(...)`

Use a custom footer message only when it adds immediate next-step guidance.
Otherwise call `ui.footer()` and let the random tip be shown.

## Row vs Table vs Divider vs Spacer

Use the right primitive for each output shape:

- `ui.row(label, value)`:
  - one-off key/value lines
  - short sections with few items
- `ui.table(rows)`:
  - multi-line key/value blocks
  - any section where vertical alignment matters
- `ui.divider(width?)`:
  - lightweight separator inside an already open section
  - avoid using it as a replacement for headers
- `ui.spacer(lines?)`:
  - vertical breathing room between message groups
  - default is `1`, use `2+` only for intentional visual separation

Examples:

```ts
ui.header("Rule Removed", "success");
ui.row("Type", "SECRET");
ui.row("Name", "my-rule");
ui.footer();
```

```ts
ui.header("Security Layers");
ui.table([
  { label: "Root (Prompt Guard)", value: theme.success("ACTIVE") },
  { label: "Pulp (Output Scanner)", value: theme.success("ACTIVE") },
  { label: "Thorn (Tool Blocker)", value: theme.muted("OFF") },
]);
ui.footer();
```

```ts
ui.header("Pattern Test", "success");
ui.row("Result", "2 match(es) found");
ui.divider(24);
ui.row("BUILT-IN", "GitHub Token");
ui.row("Redaction", "[GITHUB_TOKEN_REDACTED]");
ui.footer();
```

```ts
ui.header("Security Mode", "success");
ui.successMsg("Switched to AUDIT mode.");
ui.warningMsg("The gateway must be restarted for changes to apply.");
ui.spacer();
ui.row("Recommended", "sudo systemctl restart openclaw");
ui.footer();
```

## Help Screens

For CLI command help output, attach footer tip text via Commander help hooks.

Use this pattern:

```ts
command
  .helpOption(false)
  .helpOption("-h, --help", "display help for command")
  .addHelpText("after", `\n${ui.formatFooter()}`);
```

Notes:
- Keep `-h, --help` exactly once.
- Keep footer behavior consistent across root and subcommands.

## Success Template

Use for successful operations that change state.

```ts
ui.header("Rule Removed", "success");
ui.row("Type", "SECRET");
ui.row("Name", "my-rule");
ui.footer("Berry Shield updated! Changes are applied instantly.");
```

## Failure Template

Use `ui.failureMsg(...)` for direct failure messaging.
Use `ui.header(..., "error")` + rows only when you need structured failure details.

Simple failure:

```ts
ui.failureMsg("Invalid mode. Use 'audit' or 'enforce'.");
```

Structured failure:

```ts
ui.header("Operation Failed", "error");
ui.row("Error", "Rule 'x' not found.");
ui.footer();
```

## Wizard and Select Menus

Rules for `select`-based interactions:

- Keep primary actions first.
- Keep `Cancel` as the last option.
- Keep labels concise and hints informative.
- Keep wording consistent across steps (`Save`, `Edit`, `Cancel`).

Example:

```ts
options: [
  { value: "custom", label: "Custom Pattern", hint: "Create your own regex" },
  { value: "presetA", label: "Preset A", hint: "preset-regex" },
  { value: "cancel", label: theme.dim("Cancel"), hint: "Exit without saving" },
];
```

## Do and Don't

Do:
- Use `ui.header`, `ui.row`, `ui.footer`, `ui.successMsg`, `ui.warningMsg`, `ui.failureMsg`.
- Keep command outputs predictable and scan-friendly.
- Keep command wording and capitalization consistent.
- Route new visual tokens through `theme.ts`.

Don't:
- Mix raw `console.log` with TUI layout in command screens.
- Place `Cancel` at the top of large action lists.
- Add ad-hoc output styles that bypass `theme` and `ui`.
- Print direct emojis or custom glyphs in command files.

## Triple Check Before Merge

Use this checklist for every CLI output change:

1. **Structure check**
- Does the screen follow `header -> content -> footer`?

2. **Token check**
- Are colors/symbols coming only from `theme.ts` and `symbols`?
- Are there any direct emojis or raw ANSI escapes in command code?

3. **Consistency check**
- Is `Cancel` the last option in interactive lists?
- Are wording and state labels consistent with existing commands?
