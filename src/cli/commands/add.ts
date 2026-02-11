/**
 * CLI command: add
 * 
 * Adds a new custom rule to Berry Shield.
 * Usage: openclaw bshield add <type> --name <name> --pattern <pattern> [--placeholder <text>] [--force]
 */

import type { OpenClawPluginApi, OpenClawConfig } from "openclaw/plugin-sdk";
type PluginLogger = OpenClawPluginApi["logger"];

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
 * Print success message with restart hint
 */
function printSuccess(
    type: string,
    name: string,
    pattern: string,
    placeholder: string | undefined,
    logger: PluginLogger
): void {
    const msg = `
✓ Added ${type} rule: ${name || pattern}
  Pattern: ${pattern}${placeholder ? `\n  Placeholder: ${placeholder}` : ""}

    🍓 Berry Shield updated! Changes are applied instantly.
`;
    console.log(msg);
    logger.info(`[berry-shield] CLI: Added ${type} rule: ${name || pattern}`);
}

/**
 * Print error message and exit
 */
function printError(message: string, logger: PluginLogger): void {
    console.error(`\n✗ ${message}\n`);
    logger.error(`[berry-shield] CLI error: ${message}`);
}

/**
 * Handler for the add command
 */
export async function addCommand(
    type: string,
    options: AddOptions,
    _config: OpenClawConfig,
    logger: PluginLogger
): Promise<void> {
    const { name, pattern, placeholder, force } = options;

    const result = addCustomRule(type, { name, pattern, placeholder, force });

    if (!result.success) {
        printError(result.error || "Unknown error", logger);
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

    printSuccess(type, displayIdentifier, rule.pattern, displayPlaceholder, logger);
}
