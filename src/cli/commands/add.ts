/**
 * CLI command: add
 * 
 * Adds a new custom rule to Berry Shield.
 * Usage: openclaw bshield add <type> --name <name> --pattern <pattern> [--placeholder <text>] [--force]
 */

import {
    loadCustomRules,
    saveCustomRules,
    validateRegex,
    secretRuleExists,
    generatePlaceholder,
    getRulesFilePath,
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

    // Validate type
    const validTypes = ["secret", "file", "command"];
    if (!validTypes.includes(type)) {
        printError(`Unknown type: ${type}. Valid types: ${validTypes.join(", ")}`);
        return;
    }

    // Secrets require a name
    if (type === "secret" && !name) {
        printError("Secret rules require --name");
        return;
    }

    // Validate the regex pattern
    const validation = validateRegex(pattern);
    if (!validation.valid) {
        printError(`Invalid regex pattern: ${validation.error}`);
        return;
    }

    const rules = loadCustomRules();
    const now = new Date().toISOString();

    if (type === "secret") {
        // Check for existing rule with same name
        if (secretRuleExists(rules, name!) && !force) {
            printError(`Rule '${name}' already exists. Use --force to override.`);
            return;
        }

        // Remove existing if using --force
        if (secretRuleExists(rules, name!)) {
            rules.secrets = rules.secrets.filter(
                s => s.name.toLowerCase() !== name!.toLowerCase()
            );
        }

        const finalPlaceholder = placeholder || generatePlaceholder(name!);

        rules.secrets.push({
            name: name!,
            pattern,
            placeholder: finalPlaceholder,
            addedAt: now,
        });

        saveCustomRules(rules);
        printSuccess(type, name!, pattern, finalPlaceholder);

    } else if (type === "file") {
        // Check for duplicate pattern
        const exists = rules.sensitiveFiles.some(f => f.pattern === pattern);
        if (exists && !force) {
            printError(`File pattern already exists. Use --force to add anyway.`);
            return;
        }

        rules.sensitiveFiles.push({
            pattern,
            addedAt: now,
        });

        saveCustomRules(rules);
        printSuccess(type, pattern, pattern);

    } else if (type === "command") {
        // Check for duplicate pattern
        const exists = rules.destructiveCommands.some(c => c.pattern === pattern);
        if (exists && !force) {
            printError(`Command pattern already exists. Use --force to add anyway.`);
            return;
        }

        rules.destructiveCommands.push({
            pattern,
            addedAt: now,
        });

        saveCustomRules(rules);
        printSuccess(type, pattern, pattern);
    }
}
