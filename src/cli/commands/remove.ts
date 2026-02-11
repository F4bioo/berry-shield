/**
 * CLI command: remove
 * 
 * Removes a custom rule from Berry Shield by name.
 * Usage: openclaw bshield remove <name>
 */

import type { OpenClawPluginApi, OpenClawConfig } from "openclaw/plugin-sdk";
type PluginLogger = OpenClawPluginApi["logger"];

import { removeCustomRule } from "../storage.js";

/**
 * Handler for the remove command
 */
export async function removeCommand(
    name: string,
    _config: OpenClawConfig,
    logger: PluginLogger
): Promise<void> {
    const result = removeCustomRule(name);

    if (!result.removed) {
        console.error(`\n✗ Rule '${name}' not found.\n`);
        logger.error(`[berry-shield] CLI: Rule '${name}' not found`);
        return;
    }

    console.log(`
✓ Removed ${(result.type || "")} rule: ${name}

    🍓 Berry Shield updated! Changes are applied instantly.
`);
    logger.info(`[berry-shield] CLI: Removed ${(result.type || "")} rule: ${name}`);
}
