import { OpenClawPluginCliContext } from "../../types/openclaw-local.js";
import { DEFAULT_CONFIG } from "../../config/defaults.js";
import { BerryShieldPluginConfig } from "../../types/config.js";
import { CONFIG_PATHS, BRAND_SYMBOL } from "../../constants.js";
import { type ConfigWrapper } from "../../config/wrapper.js";
import { ui } from "../ui/tui.js";

export async function initCommand(context: OpenClawPluginCliContext, wrapper: ConfigWrapper) {
    const { logger } = context;

    logger.info(`${BRAND_SYMBOL} Initializing Berry Shield configuration...`);

    try {
        // 1. Check if plugin entry exists and get current config
        const currentConfig = await wrapper.get<BerryShieldPluginConfig | undefined>(
            CONFIG_PATHS.PLUGIN_CONFIG
        );

        if (currentConfig) {
            ui.scaffold({
                header: (s) => s.header("Berry Shield Initialization"),
                content: (s) => s.successMsg("Configuration already exists."),
            });
            return;
        }

        // 2. Inject default configuration using the wrapper
        // We set the whole config object at once
        await wrapper.set(CONFIG_PATHS.PLUGIN_CONFIG, DEFAULT_CONFIG);

        // 3. Ensure plugin is enabled
        await wrapper.set(CONFIG_PATHS.ENABLED, true);

        ui.scaffold({
            header: (s) => s.header("Berry Shield Initialization"),
            content: (s) => s.successMsg("Initialized successfully with default settings."),
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg(`Failed to initialize: ${message}`),
        });
        logger.error(`[berry-shield] CLI error: Failed to initialize: ${message}`);
        process.exit(1);
    }
}
