import { OpenClawPluginCliContext } from "../../types/openclaw-local.js";
import { BerryShieldPluginConfig } from "../../types/config.js";
import { DEFAULT_CONFIG } from "../../config/defaults.js";
import { loadCustomRules } from "../storage.js";
import {
    SECRET_PATTERNS,
    PII_PATTERNS,
    SENSITIVE_FILE_PATTERNS,
    DESTRUCTIVE_COMMAND_PATTERNS,
} from "../../patterns/index.js";
import { CONFIG_PATHS } from "../../constants.js";
import { type ConfigWrapper } from "../../config/wrapper.js";
import { ui } from "../ui/tui.js";
import { theme } from "../ui/theme.js";

export async function statusCommand(context: OpenClawPluginCliContext, wrapper: ConfigWrapper) {
    const { logger } = context;

    try {
        const shieldConfig = await wrapper.get<BerryShieldPluginConfig>(
            CONFIG_PATHS.PLUGIN_CONFIG
        ) || DEFAULT_CONFIG;

        const isEnabled = await wrapper.get<boolean>(
            CONFIG_PATHS.ENABLED
        );

        const customRules = await loadCustomRules();
        const customCount = customRules.secrets.length + customRules.sensitiveFiles.length + customRules.destructiveCommands.length;

        // Calculate totals (Built-in + Custom)
        const builtInCount = SECRET_PATTERNS.length + PII_PATTERNS.length +
            SENSITIVE_FILE_PATTERNS.length + DESTRUCTIVE_COMMAND_PATTERNS.length;
        const totalCount = builtInCount + customCount;

        // Visual Dashboard
        ui.header("Berry Shield");

        const statusLabel = isEnabled ? theme.success("enabled") : theme.muted("disabled");
        const modeLabel = (shieldConfig.mode || "audit").toLowerCase();
        const ruleDetails = `Built-in (${builtInCount}) - Custom (${customCount})`;

        ui.row("Status", statusLabel);
        ui.row("Mode", modeLabel);
        ui.row("Rules", ruleDetails);

        ui.header("Security Layers");
        Object.entries(shieldConfig.layers || {}).forEach(([layer, active]) => {
            ui.row(layer, active ? "active" : theme.muted("off"));
        });

        ui.footer("Use 'openclaw bshield add' to create custom rules.");

    } catch (error: any) {
        ui.error(`Failed to get status: ${error.message}`);
        logger.error(`[berry-shield] CLI error: ${error.message}`);
        process.exit(1);
    }
}
