/**
 * CLI command: list
 * 
 * Lists all Berry Shield rules (built-in and custom).
 * Usage: openclaw bshield list
 */

import type { OpenClawPluginApi, OpenClawConfig } from "openclaw/plugin-sdk";
type PluginLogger = OpenClawPluginApi["logger"];

import { loadCustomRules, getRulesFilePath } from "../storage.js";
import {
    SECRET_PATTERNS,
    PII_PATTERNS,
    SENSITIVE_FILE_PATTERNS,
    DESTRUCTIVE_COMMAND_PATTERNS,
} from "../../patterns/index.js";

/**
 * Handler for the list command
 */
export async function listCommand(
    _config: OpenClawConfig,
    logger: PluginLogger
): Promise<void> {
    const custom = loadCustomRules();
    logger.debug?.("[berry-shield] CLI: Listing security rules");

    console.log("\n🍓 Berry Shield Rules\n");

    // Secrets
    const totalSecrets = SECRET_PATTERNS.length + custom.secrets.length;
    console.log(`SECRETS (${totalSecrets} rules)`);

    for (const pattern of SECRET_PATTERNS) {
        console.log(`  [built-in] ${pattern.name}`);
    }
    for (const rule of custom.secrets) {
        console.log(`  [custom]   ${rule.name}`);
    }
    console.log();

    // PII
    console.log(`PII (${PII_PATTERNS.length} rules)`);
    for (const pattern of PII_PATTERNS) {
        console.log(`  [built-in] ${pattern.name}`);
    }
    console.log();

    // Sensitive Files
    const totalFiles = SENSITIVE_FILE_PATTERNS.length + custom.sensitiveFiles.length;
    console.log(`SENSITIVE FILES (${totalFiles} rules)`);
    console.log(`  [built-in] ${SENSITIVE_FILE_PATTERNS.length} patterns`);
    for (const rule of custom.sensitiveFiles) {
        console.log(`  [custom]   ${rule.pattern}`);
    }
    console.log();

    // Destructive Commands
    const totalCmds = DESTRUCTIVE_COMMAND_PATTERNS.length + custom.destructiveCommands.length;
    console.log(`DESTRUCTIVE COMMANDS (${totalCmds} rules)`);
    console.log(`  [built-in] ${DESTRUCTIVE_COMMAND_PATTERNS.length} patterns`);
    for (const rule of custom.destructiveCommands) {
        console.log(`  [custom]   ${rule.pattern}`);
    }
    console.log();

    // Summary
    const customTotal = custom.secrets.length + custom.sensitiveFiles.length + custom.destructiveCommands.length;
    if (customTotal > 0) {
        console.log(`Custom rules file: ${getRulesFilePath()}`);
    }
    console.log();
}
