import { OpenClawPluginCliContext } from "../../types/openclaw-local.js";
import { DEFAULT_CONFIG } from "../../config/defaults.js";
import { CONFIG_PATHS } from "../../constants.js";
import { type ConfigWrapper } from "../../config/wrapper.js";
import { ui } from "../ui/tui.js";
import { theme } from "../ui/theme.js";

export async function toggleCommand(layer: string, context: OpenClawPluginCliContext, wrapper: ConfigWrapper) {
    const { logger } = context;
    const validLayers = Object.keys(DEFAULT_CONFIG.layers);

    if (!validLayers.includes(layer)) {
        ui.header("Operation Failed", "error");
        ui.row("Error", `Invalid layer '${layer}'. Available layers: ${validLayers.join(", ")}`);
        ui.footer();
        process.exit(1);
    }

    try {
        const path = `${CONFIG_PATHS.PLUGIN_CONFIG}.layers.${layer}`;
        const currentValue = await wrapper.get<boolean>(path);

        // If config is missing, assume default
        const effectiveValue = currentValue ?? DEFAULT_CONFIG.layers[layer as keyof typeof DEFAULT_CONFIG.layers];
        const newValue = !effectiveValue;

        await wrapper.set(path, newValue);

        ui.header("Layer Toggle", "success");
        ui.successMsg(`Layer '${layer}' is now ${newValue ? theme.success("ENABLED") : theme.muted("DISABLED")}`);
        ui.footer();

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        ui.header("Operation Failed", "error");
        ui.row("Error", `Failed to toggle layer: ${message}`);
        ui.footer();
        logger.error(`[berry-shield] CLI error: Failed to toggle layer: ${message}`);
        process.exit(1);
    }
}
