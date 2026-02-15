import { OpenClawPluginCliContext } from "../../types/openclaw-local.js";
import { CONFIG_PATHS } from "../../constants.js";
import { type ConfigWrapper } from "../../config/wrapper.js";
import { ui } from "../ui/tui.js";

export async function modeCommand(mode: string, context: OpenClawPluginCliContext, wrapper: ConfigWrapper) {
    const { logger } = context;

    if (mode !== "audit" && mode !== "enforce") {
        ui.header("Operation Failed", "error");
        ui.row("Error", "Invalid mode. Use 'audit' or 'enforce'.");
        ui.footer();
        process.exit(1);
    }

    try {
        await wrapper.set(`${CONFIG_PATHS.PLUGIN_CONFIG}.mode`, mode);
        ui.header("Security Mode", "success");
        ui.successMsg(`Switched to ${mode.toUpperCase()} mode.`);
        ui.footer();
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        ui.header("Operation Failed", "error");
        ui.row("Error", `Failed to set mode: ${message}`);
        ui.footer();
        logger.error(`[berry-shield] CLI error: Failed to set mode: ${message}`);
        process.exit(1);
    }
}
