import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { mergeConfig, type PluginConfig } from "./types/config";
import { registerBerryRoot } from "./layers/root";
import { registerBerryPulp } from "./layers/pulp";
import { registerBerryThorn } from "./layers/thorn";
import { registerBerryLeaf } from "./layers/leaf";
import { registerBerryStem } from "./layers/stem";
import { registerBerryShieldCli } from "./cli";

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
        const userConfig = api.config ?? {};
        const config: PluginConfig = mergeConfig(userConfig as Partial<PluginConfig>);

        // Count active layers
        const activeLayers = Object.values(config.layers).filter(Boolean).length;

        // Log startup (minimalist format as per spec)
        api.logger.info(`🍓 Berry Shield v1.0.0 | ${activeLayers} layers active`);

        // Register all 5 security layers
        registerBerryRoot(api, config);  // Prompt Guard
        registerBerryPulp(api, config);  // Output Scanner
        registerBerryThorn(api, config); // Tool Blocker
        registerBerryLeaf(api, config);  // Input Audit
        registerBerryStem(api, config);  // Security Gate

        // Register CLI commands (bshield)
        registerBerryShieldCli(api);
    },
};
