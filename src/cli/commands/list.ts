/**
 * CLI command: list
 * 
 * Lists all Berry Shield rules (built-in and custom).
 * Usage: openclaw bshield list
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { loadCustomRules } from "../storage.js";
import {
    SECRET_PATTERNS,
    PII_PATTERNS,
    INTERNAL_SENSITIVE_FILE_PATTERNS,
    INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS,
} from "../../patterns/index.js";

type PluginLogger = OpenClawPluginApi["logger"];

/**
 * Validates generic types for checking
 */
interface GenericRule {
    id?: string;
    name?: string;
    pattern?: string;
    source: "built-in" | "custom";
    type: "secret" | "pii" | "file" | "command";
    disabled?: boolean;
}

/**
 * Handler for the list command
 */
import { ui } from "../ui/tui.js";

export async function listCommand(
    logger: PluginLogger
): Promise<void> {
    const custom = await loadCustomRules();
    const disabledBuiltIns = new Set((custom.disabledBuiltInIds ?? []).map((entry) => entry.toLowerCase()));
    logger.debug?.("[berry-shield] CLI: Listing security rules");

    const allRules: GenericRule[] = [];

    // Secrets
    SECRET_PATTERNS.forEach((rule) => allRules.push({
        id: rule.id,
        name: rule.name,
        pattern: rule.pattern.toString(),
        source: "built-in",
        type: "secret",
        disabled: disabledBuiltIns.has(rule.id.toLowerCase()),
    }));
    custom.secrets.forEach(r => allRules.push({ name: r.name, pattern: r.pattern, source: "custom", type: "secret" }));

    // PII
    PII_PATTERNS.forEach((rule) => allRules.push({
        id: rule.id,
        name: rule.name,
        pattern: rule.pattern.toString(),
        source: "built-in",
        type: "pii",
        disabled: disabledBuiltIns.has(rule.id.toLowerCase()),
    }));

    // Files
    INTERNAL_SENSITIVE_FILE_PATTERNS.forEach((rule) => allRules.push({
        id: rule.id,
        pattern: rule.pattern.toString(),
        source: "built-in",
        type: "file",
        disabled: disabledBuiltIns.has(rule.id.toLowerCase()),
    }));
    custom.sensitiveFiles.forEach(r => allRules.push({ pattern: r.pattern, source: "custom", type: "file" }));

    // Commands
    INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS.forEach((rule) => allRules.push({
        id: rule.id,
        pattern: rule.pattern.toString(),
        source: "built-in",
        type: "command",
        disabled: disabledBuiltIns.has(rule.id.toLowerCase()),
    }));
    custom.destructiveCommands.forEach(r => allRules.push({ pattern: r.pattern, source: "custom", type: "command" }));

    // Group items for display
    const groups = {
        "Secrets": allRules.filter(r => r.type === "secret"),
        "PII Redaction": allRules.filter(r => r.type === "pii"),
        "Sensitive Files": allRules.filter(r => r.type === "file"),
        "Destructive Commands": allRules.filter(r => r.type === "command"),
    };

    const visibleGroups = Object.entries(groups).filter(([, rules]) => rules.length > 0);

    ui.scaffold({
        header: (h) => h.header("Security Rules"),
        content: (s) => {
            visibleGroups.forEach(([title, rules], index) => {
                if (index > 0) {
                    s.spacer();
                }

                s.section(`${title} (${rules.length})`);

                const external = rules.filter(r => r.source === "custom");
                const internal = rules.filter(r => r.source === "built-in");

                // Show External (Custom) first
                external.forEach(rule => {
                    const ruleDisplay = rule.name ? `${rule.name}` : `/${rule.pattern}/`;
                    const displayId = ruleDisplay.length > 55 ? ruleDisplay.substring(0, 52) + "..." : ruleDisplay;
                    s.row("EXTERNAL", displayId);
                });

                // Add a small divider if both exist
                if (external.length > 0 && internal.length > 0) {
                    s.divider(20);
                }

                // Show Internal (Built-in)
                internal.forEach(rule => {
                    const baseId = rule.id ?? rule.name ?? `/${rule.pattern}/`;
                    const statusSuffix = rule.disabled ? " [DISABLED]" : "";
                    const displayId = `${baseId}${statusSuffix}`;
                    s.row("INTERNAL", displayId);
                });
            });
        },
    });
}
