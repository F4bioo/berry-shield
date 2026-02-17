import { OpenClawPluginCliContext } from "../../types/openclaw-local.js";
import { CONFIG_PATHS } from "../../constants.js";
import { type ConfigWrapper } from "../../config/wrapper.js";
import { ui } from "../ui/tui.js";

export async function modeCommand(mode: string, context: OpenClawPluginCliContext, wrapper: ConfigWrapper) {
    const { logger } = context;

    if (mode !== "audit" && mode !== "enforce") {
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg("Invalid mode. Use 'audit' or 'enforce'."),
        });
        process.exit(1);
    }

    try {
        await wrapper.set(`${CONFIG_PATHS.PLUGIN_CONFIG}.mode`, mode);
        ui.scaffold({
            header: (s) => s.header("Security Mode"),
            content: (s) => s.successMsg(`Switched to ${mode.toUpperCase()} mode.`),
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg(`Failed to set mode: ${message}`),
        });
        logger.error(`[berry-shield] CLI error: Failed to set mode: ${message}`);
        process.exit(1);
    }
}
