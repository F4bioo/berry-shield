import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { mergeConfig, type PluginConfig } from "./types/config";
import { registerBerryRoot } from "./layers/root";
import { registerBerryPulp } from "./layers/pulp";
import { registerBerryThorn } from "./layers/thorn";
import { registerBerryLeaf } from "./layers/leaf";

/**
 * Berry Shield - Security plugin for OpenClaw
 *
 * 5-layer defense system:
 * - Berry.Root: Prompt Guard (injects security policies)
 * - Berry.Pulp: Output Scanner (redacts secrets/PII)
 * - Berry.Thorn: Tool Blocker (blocks dangerous commands)
 * - Berry.Leaf: Input Audit (logs for auditing)
 * - Berry.Stem: Security Gate (tool-based checkpoint)
 */

export default {
    id: "berry-shield",
    name: "Berry Shield",
    version: "1.0.0",
    description: "Security plugin - blocks destructive commands, redacts secrets and PII",

    register(api: OpenClawPluginApi) {
        // Get user config and merge with defaults
        const userConfig = api.getConfig?.() ?? {};
        const config: PluginConfig = mergeConfig(userConfig as Partial<PluginConfig>);

        // Count active layers
        const activeLayers = Object.values(config.layers).filter(Boolean).length;

        // Log startup (minimalist format as per spec)
        api.logger.info(`🍓 Berry Shield v1.0.0 | ${activeLayers} layers active`);

        // Register all layers
        registerBerryRoot(api, config);
        registerBerryPulp(api, config);
        registerBerryThorn(api, config);
        registerBerryLeaf(api, config);

        // TODO: Implement remaining layer
        // - Berry.Stem (registerTool: berry_check)
    },
};
