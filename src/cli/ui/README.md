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

1. `ui.scaffold({ ... })`
2. `header` (optional): only top-level screen title
3. `content` (required): `section/row/table/divider/spacer/success/warning/failure`
4. `bottom` (optional): `footer` (falls back to default footer when omitted)

Use a custom footer message only when it adds immediate next-step guidance.
Otherwise omit `bottom` and let scaffold call default footer.

## Scaffold Slot Contract

`scaffold` uses typed slots by design:

- `header(h)`: only `h.header(...)`
- `content(c)`: only content primitives (`section/row/table/divider/spacer/successMsg/warningMsg/failureMsg`)
- `bottom(f)`: only `f.footer(...)`

This prevents accidental misuse like calling `header` or `footer` inside `content`.

## Section vs Row vs Table vs Divider vs Spacer

Use the right primitive for each output shape:

- `ui.section(title)`:
  - subtitle inside scaffold content
  - use for internal group headers (`Summary`, `Details`, `Security Layers`)
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
ui.scaffold({
  header: (h) => h.header("Rule Removed"),
  content: (c) => {
    c.successMsg("Rule removed successfully.");
    c.row("Type", "SECRET");
    c.row("Name", "my-rule");
  },
});
```

```ts
ui.scaffold({
  header: (h) => h.header("Berry Shield"),
  content: (c) => {
    c.section("Security Layers");
    c.table([
      { label: "Root (Prompt Guard)", value: theme.success("ACTIVE") },
      { label: "Pulp (Output Scanner)", value: theme.success("ACTIVE") },
      { label: "Thorn (Tool Blocker)", value: theme.muted("OFF") },
    ]);
  },
});
```

```ts
ui.scaffold({
  header: (h) => h.header("Pattern Test"),
  content: (c) => {
    c.successMsg("2 match(es) found");
    c.divider(24);
    c.row("BUILT-IN", "GitHub Token");
    c.row("Redaction", "[GITHUB_TOKEN_REDACTED]");
  },
});
```

```ts
ui.scaffold({
  header: (h) => h.header("Security Mode"),
  content: (c) => {
    c.successMsg("Switched to AUDIT mode.");
    c.warningMsg("The gateway must be restarted for changes to apply.");
    c.spacer();
    c.row("Recommended", "sudo systemctl restart openclaw");
  },
});
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
ui.scaffold({
  header: (h) => h.header("Rule Removed"),
  content: (c) => {
    c.successMsg("Rule removed successfully.");
    c.row("Type", "SECRET");
    c.row("Name", "my-rule");
  },
  bottom: (f) => f.footer("Berry Shield updated! Changes are applied instantly."),
});
```

## Failure Template

Use `ui.failureMsg(...)` for direct failure messaging.
Keep `header` neutral; signal state in content.

Simple failure:

```ts
ui.scaffold({
  header: (h) => h.header("Operation Failed"),
  content: (c) => c.failureMsg("Invalid mode. Use 'audit' or 'enforce'."),
});
```

Structured failure:

```ts
ui.scaffold({
  header: (h) => h.header("Operation Failed"),
  content: (c) => {
    c.failureMsg("Rule 'x' not found.");
    c.row("Hint", "Use 'openclaw bshield list' to inspect rules.");
  },
});
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
- Use `ui.scaffold` and slot helpers (`header`, `section`, `row`, `table`, `successMsg`, `warningMsg`, `failureMsg`, `footer`).
- Keep command outputs predictable and scan-friendly.
- Keep command wording and capitalization consistent.
- Route new visual tokens through `theme.ts`.
- Keep top-level title in `header`; keep internal grouping in `section`.

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
