/**
 * CLI command: add
 *
 * Adds a new custom rule to Berry Shield.
 * Usage: openclaw bshield add <type> --name <name> --pattern <pattern> [--placeholder <text>] [--force]
 */
import { addCustomRule, } from "../storage.js";
/**
 * Print success message with restart hint (Tailscale style)
 */
function printSuccess(type, name, pattern, placeholder) {
    console.log(`
✓ Added ${type} rule: ${name || pattern}
  Pattern: ${pattern}${placeholder ? `\n  Placeholder: ${placeholder}` : ""}

To apply changes, run:

    sudo systemctl restart openclaw

`);
}
/**
 * Print error message and exit
 */
function printError(message) {
    console.error(`\n✗ ${message}\n`);
}
/**
 * Handler for the add command
 */
export async function addCommand(type, options) {
    const { name, pattern, placeholder, force } = options;
    const result = addCustomRule(type, { name, pattern, placeholder, force });
    if (!result.success) {
        printError(result.error || "Unknown error");
        return;
    }
    const rule = result.rule;
    // Determine info to display
    let displayIdentifier = rule.pattern;
    let displayPlaceholder = undefined;
    if ('name' in rule) {
        displayIdentifier = rule.name;
        displayPlaceholder = rule.placeholder;
    }
    printSuccess(type, displayIdentifier, rule.pattern, displayPlaceholder);
}
