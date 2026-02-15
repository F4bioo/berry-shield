import { OpenClawPluginCliContext } from "../../types/openclaw-local.js";
import { mergeConfig } from "../../config/utils.js";
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
        // Read raw config from wrapper (openclaw.json)
        const rawPluginConfig = await wrapper.get<unknown>(CONFIG_PATHS.PLUGIN_CONFIG) || {};

        // Merge with defaults using the SAME logic as the plugin runtime
        const shieldConfig = mergeConfig(rawPluginConfig);

        const isEnabled = await wrapper.get<boolean>(
            CONFIG_PATHS.ENABLED
        ) ?? false;

        const customRules = await loadCustomRules();
        const customCount = customRules.secrets.length + customRules.sensitiveFiles.length + customRules.destructiveCommands.length;

        const builtInCount = SECRET_PATTERNS.length + PII_PATTERNS.length +
            SENSITIVE_FILE_PATTERNS.length + DESTRUCTIVE_COMMAND_PATTERNS.length;

        // Visual Dashboard
        ui.header("Berry Shield");

        const statusLabel = isEnabled ? theme.success("ENABLED") : theme.muted("DISABLED");
        const mode = (shieldConfig.mode || "audit").toUpperCase();
        const modeLabel = mode === "ENFORCE" ? theme.success("ENFORCE") : theme.warning("AUDIT");
        const ruleDetails = `Built-in (${builtInCount}) - Custom (${customCount})`;

        ui.table([
            { label: "Status", value: statusLabel },
            { label: "Mode", value: modeLabel },
            { label: "Rules", value: ruleDetails },
        ]);

        ui.header("Security Layers");

        // Display layers in a consistent order
        const layers = [
            { name: "Root (Prompt Guard)", active: shieldConfig.layers.root },
            { name: "Pulp (Output Scanner)", active: shieldConfig.layers.pulp },
            { name: "Thorn (Tool Blocker)", active: shieldConfig.layers.thorn },
            { name: "Leaf (Input Audit)", active: shieldConfig.layers.leaf },
            { name: "Stem (Security Gate)", active: shieldConfig.layers.stem },
        ];

        ui.table(
            layers.map(layer => ({
                label: layer.name,
                value: layer.active ? theme.success("ACTIVE") : theme.muted("OFF"),
            })),
        );

        ui.footer("Use 'openclaw bshield add' to create custom rules.");

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        ui.header("Operation Failed", "error");
        ui.row("Error", `Failed to get status: ${message}`);
        ui.footer();
        logger.error(`[berry-shield] CLI error: Failed to get status: ${message}`);
        process.exit(1);
    }
}
