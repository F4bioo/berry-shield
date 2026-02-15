# TUI Dashboard

The Berry Shield TUI Dashboard is the central cockpit for monitoring security health. It is accessible via the `openclaw bshield status` command.

## Visual Design (Lobster Aesthetic)
The interface uses a custom theme inspired by the **Lobster / Strawberry** palette (#FF5A2D) to ensure high visibility and a premium technical feel.

### Dashboard Layout
```text
◇ Berry Shield [v2026.02.13]
--------------------------------------------------
Status: [enforce]
Health: Optimized
--------------------------------------------------
Rules Summary:
  Built-in: 85 rules (+ Gitleaks)
  Custom:   12 rules
--------------------------------------------------
[Expert Tip]: "Use 'toggle' to switch to monitor mode
during debugging to avoid command blocking."
```

## Status Indicators
- **Mode**: Displayed in lowercase (`enforce` or `monitor`).
- **Health**: Reflects system readiness and pattern cache status.
- **Rule Counters**: Real-time counts of active patterns protecting the environment.

## Footer & Tips
Every view includes a randomized **Expert Tip** that provides architectural context or security advice, ensuring the tool acts as both a shield and a mentor.

---
- [CLI Reference](cli.md)
- [Interactive Wizards](wizards.md)
