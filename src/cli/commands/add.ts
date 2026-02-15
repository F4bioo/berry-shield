/**
 * CLI command: add
 * 
 * Adds a new custom rule to Berry Shield.
 * Usage: openclaw bshield add <type> --name <name> --pattern <pattern> [--placeholder <text>] [--force]
 */

import type { OpenClawPluginApi, OpenClawConfig } from "openclaw/plugin-sdk";
import { addCustomRule, validateRegex, type SecretRule, type FileRule, type CommandRule } from "../storage.js";
import { ui } from "../ui/tui.js";
import { RuleWizardSession } from "../ui/wizard.js";

type PluginLogger = OpenClawPluginApi["logger"];

interface AddOptions {
    name?: string;
    pattern?: string;
    placeholder?: string;
    force?: boolean;
}

/**
 * Detect if a pattern is potentially too broad (Yellow Flag)
 */
function isBroadPattern(pattern: string): boolean {
    if (pattern === ".*" || pattern === ".+") return true;
    if (pattern.length < 3) return true;
    if (pattern.includes(".*") && pattern.length < 8) return true;
    return false;
}

function printSuccess(
    type: string,
    name: string,
    pattern: string,
    placeholder: string | undefined,
    logger: PluginLogger
): void {
    ui.header(`Added ${type.toUpperCase()} Rule`, "success");
    ui.row("Name/ID", name || pattern);
    ui.row("Pattern", pattern);
    if (placeholder) ui.row("Redaction", placeholder);

    ui.footer("Berry Shield updated! Changes are applied instantly.");
    logger.info(`[berry-shield] CLI: Added ${type} rule: ${name || pattern}`);
}

function printError(message: string, logger: PluginLogger): void {
    ui.header("Operation Failed", "error");
    ui.row("Error", message);
    logger.error(`[berry-shield] CLI error: ${message}`);
}

export async function addCommand(
    type: string | undefined,
    options: AddOptions,
    _config: OpenClawConfig,
    logger: PluginLogger
): Promise<void> {

    let finalType = type;
    let finalOptions = options;

    if (!type || !options.pattern) {
        const wizard = new RuleWizardSession();
        const wizardResult = await wizard.execute();

        if (!wizardResult) {
            ui.footer();
            return;
        }
        finalType = wizardResult.type;
        finalOptions = { ...options, ...wizardResult.options };
    }

    if (finalOptions.pattern && isBroadPattern(finalOptions.pattern)) {
        logger.warn(`[berry-shield] Warning: Broad pattern added via CLI: ${finalOptions.pattern}`);
    }

    const { name, pattern, placeholder, force } = finalOptions;
    if (!pattern || !finalType) return;

    const result = await addCustomRule(finalType, { name, pattern, placeholder, force });

    if (!result.success || !result.rule) {
        printError(result.error || "Unknown error", logger);
        return;
    }

    const rule = result.rule;
    let displayIdentifier = rule.pattern;
    let displayPlaceholder: string | undefined = undefined;

    if ('name' in rule) {
        displayIdentifier = rule.name;
        displayPlaceholder = rule.placeholder;
    }

    printSuccess(finalType, displayIdentifier, rule.pattern, displayPlaceholder, logger);
}
