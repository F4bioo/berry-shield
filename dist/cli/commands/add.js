/**
 * CLI command: add
 *
 * Adds a new custom rule to Berry Shield.
 * Usage: openclaw bshield add <type> --name <name> --pattern <pattern> [--placeholder <text>] [--force]
 */
import { addCustomRule, } from "../storage.js";
/**
 * Print success message with restart hint
 */
function printSuccess(type, name, pattern, placeholder, logger) {
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
function printError(message, logger) {
    console.error(`\n✗ ${message}\n`);
    logger.error(`[berry-shield] CLI error: ${message}`);
}
/**
 * Handler for the add command
 */
export async function addCommand(type, options, _config, logger) {
    const { name, pattern, placeholder, force } = options;
    const result = addCustomRule(type, { name, pattern, placeholder, force });
    if (!result.success) {
        printError(result.error || "Unknown error", logger);
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
    printSuccess(type, displayIdentifier, rule.pattern, displayPlaceholder, logger);
}
