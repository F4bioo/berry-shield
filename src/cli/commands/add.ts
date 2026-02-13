/**
 * CLI command: add
 * 
 * Adds a new custom rule to Berry Shield.
 * Usage: openclaw bshield add <type> --name <name> --pattern <pattern> [--placeholder <text>] [--force]
 */

import type { OpenClawPluginApi, OpenClawConfig } from "openclaw/plugin-sdk";
import { intro, text, select, confirm, isCancel, cancel } from '@clack/prompts';
import {
    addCustomRule,
    validateRegex,
    type SecretRule,
    type FileRule,
    type CommandRule,
} from "../storage.js";
import { theme, symbols } from "../ui/theme.js";
import { ui } from "../ui/tui.js";

type PluginLogger = OpenClawPluginApi["logger"];

interface AddOptions {
    name?: string;
    pattern?: string;
    placeholder?: string;
    force?: boolean;
}

/**
 * Check if a regex pattern is "too broad" (Yellow Flag)
 */
function isBroadPattern(pattern: string): boolean {
    if (pattern === ".*" || pattern === ".+") return true;
    if (pattern.length < 3) return true;
    if (pattern.includes(".*") && pattern.length < 8) return true;
    return false;
}

/**
 * Interactive Wizard for adding rules
 */
async function runWizard(_initialType: string | undefined): Promise<{ type: string; options: AddOptions } | null> {
    intro(theme.accentBold(`${symbols.brand} Berry Shield Rule Wizard\n`));

    const selectedType = await select({
        message: 'What type of rule do you want to add?',
        options: [
            { value: 'secret', label: 'Secret (API keys, tokens)', hint: 'Redacts patterns from output' },
            { value: 'file', label: 'Sensitive File', hint: 'Prevents reading specific files' },
            { value: 'command', label: 'Destructive Command', hint: 'Blocks dangerous commands' },
            { value: 'cancel', label: theme.dim('Cancel'), hint: 'Exit the wizard' },
        ],
    });

    if (isCancel(selectedType) || selectedType === 'cancel') {
        cancel('Operation cancelled.');
        return null;
    }

    const type = selectedType as string;

    let name: string | undefined;
    if (type === 'secret') {
        const nameInput = await text({
            message: 'Rule Name (e.g. "openai-key")',
            placeholder: 'my-secret-key',
            validate(value) {
                if (!value || value.length === 0) return 'Name is required for secrets';
            },
        });
        if (isCancel(nameInput)) { cancel('Operation cancelled.'); return null; }
        name = nameInput;
    }

    const patternInput = await text({
        message: 'Regex Pattern',
        placeholder: type === 'secret' ? 'sk-[a-zA-Z0-9]{48}' : 'config/secrets.json',
        validate(value) {
            if (!value || value.length === 0) return 'Pattern is required';
            const validation = validateRegex(value);
            if (!validation.valid) return `Invalid regex: ${validation.error}`;
        },
    });

    if (isCancel(patternInput)) { cancel('Operation cancelled.'); return null; }
    const pattern = patternInput;

    if (isBroadPattern(pattern)) {
        const confirmBroad = await confirm({
            message: '⚠️ Warning: This pattern seems very broad. Continue?',
            initialValue: false,
        });
        if (isCancel(confirmBroad) || !confirmBroad) { cancel('Operation cancelled.'); return null; }
    }

    let placeholder: string | undefined;
    if (type === 'secret') {
        const placeholderInput = await text({
            message: 'Custom Placeholder (optional)',
            placeholder: '[REDACTED_SECRET]',
            initialValue: '',
        });
        if (isCancel(placeholderInput)) { cancel('Operation cancelled.'); return null; }
        placeholder = placeholderInput || undefined;
    }

    return { type, options: { name, pattern, placeholder } };
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
        const wizardResult = await runWizard(type);
        if (!wizardResult) {
            ui.footer(); // Still show tip on cancel
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
