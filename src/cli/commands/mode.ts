import { OpenClawPluginCliContext } from "../../types/openclaw-local.js";
import { CONFIG_PATHS } from "../../constants.js";
import { type ConfigWrapper } from "../../config/wrapper.js";
import { ui } from "../ui/tui.js";

export async function modeCommand(mode: string, context: OpenClawPluginCliContext, wrapper: ConfigWrapper) {
    const { logger } = context;

    if (mode !== "audit" && mode !== "enforce") {
        ui.error("Invalid mode. Use 'audit' or 'enforce'.");
        process.exit(1);
    }

    try {
        await wrapper.set(`${CONFIG_PATHS.PLUGIN_CONFIG}.mode`, mode);
        ui.header("Security Mode", "success");
        ui.successMsg(`Switched to ${mode.toUpperCase()} mode.\n`);
        ui.footer();
    } catch (error: any) {
        ui.error(`Failed to set mode: ${error.message}`);
        process.exit(1);
    }
}
