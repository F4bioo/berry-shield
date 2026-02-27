/**
 * CLI command: remove
 * 
 * Removes a custom rule from Berry Shield by name.
 * Usage: openclaw bshield remove <name>
 */

import type { OpenClawPluginApi, OpenClawConfig } from "openclaw/plugin-sdk";
import { removeCustomRuleFromConfig } from "../custom-rules-config.js";
import { ui } from "../ui/tui.js";
import { type ConfigWrapper } from "../../config/wrapper.js";

type PluginLogger = OpenClawPluginApi["logger"];

/**
 * Handler for the remove command
 */
export async function removeCommand(
    name: string,
    _config: OpenClawConfig,
    logger: PluginLogger,
    wrapper: ConfigWrapper
): Promise<void> {
    const result = await removeCustomRuleFromConfig(wrapper, name);

    if (!result.removed) {
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg(`Rule '${name}' not found.`),
        });
        logger.error(`[berry-shield] CLI: Rule '${name}' not found`);
        return;
    }

    ui.scaffold({
        header: (s) => s.header("Rule Removed"),
        content: (s) => {
            s.successMsg("Rule removed successfully.");
            s.row("Type", (result.type || "unknown").toUpperCase());
            s.row("Name", name);
        },
        bottom: (s) => s.footer("Berry Shield updated! Changes are applied instantly."),
    });
    logger.info(`[berry-shield] CLI: Removed ${(result.type || "")} rule: ${name}`);
}
