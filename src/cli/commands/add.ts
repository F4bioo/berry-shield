/**
 * CLI command: add
 * 
 * Adds a new custom rule to Berry Shield.
 * Usage: openclaw bshield add <type> --name <name> --pattern <pattern> [--placeholder <text>] [--force]
 */

import {
    addCustomRule,
    type SecretRule,
    type FileRule,
    type CommandRule,
} from "../storage.js";

interface AddOptions {
    name?: string;
    pattern: string;
    placeholder?: string;
    force?: boolean;
}

/**
 * Print success message with restart hint (Tailscale style)
 */
function printSuccess(type: string, name: string, pattern: string, placeholder?: string): void {
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
function printError(message: string): void {
    console.error(`\n✗ ${message}\n`);
}

/**
 * Handler for the add command
 */
export async function addCommand(type: string, options: AddOptions): Promise<void> {
    const { name, pattern, placeholder, force } = options;

    const result = addCustomRule(type, { name, pattern, placeholder, force });

    if (!result.success) {
        printError(result.error || "Unknown error");
        return;
    }

    const rule = result.rule as SecretRule | FileRule | CommandRule;

    // Determine info to display
    let displayIdentifier = rule.pattern;
    let displayPlaceholder: string | undefined = undefined;

    if ('name' in rule) {
        displayIdentifier = rule.name;
        displayPlaceholder = rule.placeholder;
    }

    printSuccess(type, displayIdentifier, rule.pattern, displayPlaceholder);
}
