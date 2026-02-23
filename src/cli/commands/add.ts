/**
 * CLI command: add
 * 
 * Adds a new custom rule to Berry Shield.
 * Usage: openclaw bshield add <type> --name <name> --pattern <pattern> [--placeholder <text>] [--force]
 */

import type { OpenClawPluginApi, OpenClawConfig } from "openclaw/plugin-sdk";
import {
    isBroadPattern
} from "../storage.js";
import { addCustomRuleToConfig } from "../custom-rules-config.js";
import { type ConfigWrapper } from "../../config/wrapper.js";
import { ui } from "../ui/tui.js";
import { RuleWizardSession } from "../ui/wizard.js";

type PluginLogger = OpenClawPluginApi["logger"];

interface AddOptions {
    name?: string;
    pattern?: string;
    placeholder?: string;
    force?: boolean;
}


function printSuccess(
    type: string,
    name: string,
    pattern: string,
    placeholder: string | undefined,
    logger: PluginLogger
): void {
    ui.scaffold({
        header: (s) => s.header(`Added ${type.toUpperCase()} Rule`),
        content: (s) => {
            s.successMsg("Rule added successfully.");
            s.row("ID", `${type}:${name}`);
            s.row("Pattern", pattern);
            if (placeholder) s.row("Redaction", placeholder);
        },
        bottom: (s) => s.footer("Berry Shield updated! Changes are applied instantly."),
    });
    logger.info(`[berry-shield] CLI: Added ${type} rule: ${type}:${name}`);
}

function printError(message: string, logger: PluginLogger): void {
    ui.scaffold({
        header: (s) => s.header("Operation Failed"),
        content: (s) => s.failureMsg(message),
    });
    logger.error(`[berry-shield] CLI error: ${message}`);
}

export async function addCommand(
    type: string | undefined,
    options: AddOptions,
    _config: OpenClawConfig,
    logger: PluginLogger,
    wrapper: ConfigWrapper
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

    const normalizedType = finalType === "secret" || finalType === "file" || finalType === "command"
        ? finalType
        : undefined;
    if (!normalizedType) {
        printError("Invalid type. Use: secret, file, command", logger);
        return;
    }

    const result = await addCustomRuleToConfig(wrapper, normalizedType, { name, pattern, placeholder, force });

    if (!result.success || !result.rule) {
        printError(result.error || "Unknown error", logger);
        return;
    }

    const rule = result.rule;
    let displayIdentifier = "";
    let displayPlaceholder: string | undefined = undefined;

    if ('name' in rule) {
        displayIdentifier = rule.name;
        if ('placeholder' in rule) {
            displayPlaceholder = rule.placeholder;
        }
    }

    printSuccess(finalType, displayIdentifier, rule.pattern, displayPlaceholder, logger);
}
