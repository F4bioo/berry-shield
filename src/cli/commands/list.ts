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
    SENSITIVE_FILE_PATTERNS,
    DESTRUCTIVE_COMMAND_PATTERNS,
} from "../../patterns/index.js";

type PluginLogger = OpenClawPluginApi["logger"];

/**
 * Validates generic types for checking
 */
interface GenericRule {
    name?: string;
    pattern?: string;
    source: "built-in" | "custom";
    type: "secret" | "pii" | "file" | "command";
}

/**
 * Handler for the list command
 */
import { ui } from "../ui/tui.js";

export async function listCommand(
    logger: PluginLogger
): Promise<void> {
    const custom = await loadCustomRules();
    logger.debug?.("[berry-shield] CLI: Listing security rules");

    const allRules: GenericRule[] = [];

    // Secrets
    SECRET_PATTERNS.forEach(r => allRules.push({ name: r.name, pattern: r.pattern.toString(), source: "built-in", type: "secret" }));
    custom.secrets.forEach(r => allRules.push({ name: r.name, pattern: r.pattern, source: "custom", type: "secret" }));

    // PII
    PII_PATTERNS.forEach(r => allRules.push({ name: r.name, pattern: r.pattern.toString(), source: "built-in", type: "pii" }));

    // Files
    SENSITIVE_FILE_PATTERNS.forEach(r => allRules.push({ pattern: r.toString(), source: "built-in", type: "file" }));
    custom.sensitiveFiles.forEach(r => allRules.push({ pattern: r.pattern, source: "custom", type: "file" }));

    // Commands
    DESTRUCTIVE_COMMAND_PATTERNS.forEach(r => allRules.push({ pattern: r.toString(), source: "built-in", type: "command" }));
    custom.destructiveCommands.forEach(r => allRules.push({ pattern: r.pattern, source: "custom", type: "command" }));

    // Group items for display
    const groups = {
        "Secrets": allRules.filter(r => r.type === "secret"),
        "PII Redaction": allRules.filter(r => r.type === "pii"),
        "Sensitive Files": allRules.filter(r => r.type === "file"),
        "Destructive Commands": allRules.filter(r => r.type === "command"),
    };

    Object.entries(groups).forEach(([title, rules]) => {
        if (rules.length === 0) return;

        ui.header(`${title} (${rules.length})`);

        const external = rules.filter(r => r.source === "custom");
        const internal = rules.filter(r => r.source === "built-in");

        // Show External (Custom) first
        external.forEach(rule => {
            const id = rule.name ? `${rule.name}` : `/${rule.pattern}/`;
            const displayId = id.length > 55 ? id.substring(0, 52) + "..." : id;
            ui.row("EXTERNAL", displayId);
        });

        // Add a small divider if both exist
        if (external.length > 0 && internal.length > 0) {
            ui.divider(20);
        }

        // Show Internal (Built-in)
        internal.forEach(rule => {
            const id = rule.name ? `${rule.name}` : `/${rule.pattern}/`;
            const displayId = id.length > 55 ? id.substring(0, 52) + "..." : id;
            ui.row("INTERNAL", displayId);
        });
    });

    ui.footer();
}
