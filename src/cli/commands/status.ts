import { OpenClawPluginCliContext } from "../../types/openclaw-local.js";
import { mergeConfig } from "../../config/utils.js";
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

        const customCount = shieldConfig.customRules.secrets.length
            + shieldConfig.customRules.sensitiveFiles.length
            + shieldConfig.customRules.destructiveCommands.length;

        const builtInCount = SECRET_PATTERNS.length + PII_PATTERNS.length +
            SENSITIVE_FILE_PATTERNS.length + DESTRUCTIVE_COMMAND_PATTERNS.length;

        const statusLabel = isEnabled ? theme.success("ENABLED") : theme.muted("DISABLED");
        const mode = (shieldConfig.mode || "audit").toUpperCase();
        const modeLabel = mode === "ENFORCE" ? theme.success("ENFORCE") : theme.warning("AUDIT");
        const ruleDetails = `Built-in (${builtInCount}) - Custom (${customCount})`;

        // Display layers in a consistent order
        const layers = [
            { name: "Root (Prompt Guard)", active: shieldConfig.layers.root },
            { name: "Pulp (Output Scanner)", active: shieldConfig.layers.pulp },
            { name: "Thorn (Tool Blocker)", active: shieldConfig.layers.thorn },
            { name: "Leaf (Input Audit)", active: shieldConfig.layers.leaf },
            { name: "Stem (Security Gate)", active: shieldConfig.layers.stem },
            { name: "Vine (External Guard)", active: shieldConfig.layers.vine },
        ];

        ui.scaffold({
            header: (s) => s.header("Berry Shield"),
            content: (s) => {
                s.table([
                    { label: "Status", value: statusLabel },
                    { label: "Mode", value: modeLabel },
                    { label: "Rules", value: ruleDetails },
                ]);

                s.spacer();
                s.section("Policy");
                s.table([
                    { label: "Profile", value: shieldConfig.policy.profile.toUpperCase() },
                    { label: "Escalation", value: String(shieldConfig.policy.adaptive.escalationTurns) },
                    { label: "Stale (min)", value: String(shieldConfig.policy.adaptive.staleAfterMinutes) },
                    { label: "Heartbeat", value: String(shieldConfig.policy.adaptive.heartbeatEveryTurns) },
                    { label: "Global Escalation", value: shieldConfig.policy.adaptive.allowGlobalEscalation ? theme.warning("ON") : theme.muted("OFF") },
                ]);

                s.spacer();
                s.section("Vine");
                s.table([
                    { label: "Mode", value: shieldConfig.vine.mode.toUpperCase() },
                    { label: "Signals to Escalate", value: String(shieldConfig.vine.thresholds.externalSignalsToEscalate) },
                    { label: "Guard Turns", value: String(shieldConfig.vine.thresholds.forcedGuardTurns) },
                    { label: "Retention (entries)", value: String(shieldConfig.vine.retention.maxEntries) },
                    { label: "Retention (ttl sec)", value: String(shieldConfig.vine.retention.ttlSeconds) },
                    { label: "Allowlist", value: `${shieldConfig.vine.toolAllowlist.length} tool(s)` },
                ]);

                s.spacer();
                s.section("Security Layers");
                s.table(
                    layers.map(layer => ({
                        label: layer.name,
                        value: layer.active ? theme.success("ACTIVE") : theme.muted("OFF"),
                    })),
                );
            },
            bottom: (s) => s.footer("Use 'openclaw bshield add' to create custom rules."),
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg(`Failed to get status: ${message}`),
        });
        logger.error(`[berry-shield] CLI error: Failed to get status: ${message}`);
        process.exit(1);
    }
}
