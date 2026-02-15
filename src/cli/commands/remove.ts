/**
 * CLI command: remove
 * 
 * Removes a custom rule from Berry Shield by name.
 * Usage: openclaw bshield remove <name>
 */

import type { OpenClawPluginApi, OpenClawConfig } from "openclaw/plugin-sdk";
import { removeCustomRule } from "../storage.js";
import { ui } from "../ui/tui.js";

type PluginLogger = OpenClawPluginApi["logger"];

/**
 * Handler for the remove command
 */
export async function removeCommand(
    name: string,
    _config: OpenClawConfig,
    logger: PluginLogger
): Promise<void> {
    const result = await removeCustomRule(name);

    if (!result.removed) {
        ui.header("Operation Failed", "error");
        ui.row("Error", `Rule '${name}' not found.`);
        ui.footer();
        logger.error(`[berry-shield] CLI: Rule '${name}' not found`);
        return;
    }

    ui.header("Rule Removed", "success");
    ui.row("Type", (result.type || "unknown").toUpperCase());
    ui.row("Name", name);

    ui.footer("Berry Shield updated! Changes are applied instantly.");
    logger.info(`[berry-shield] CLI: Removed ${(result.type || "")} rule: ${name}`);
}
