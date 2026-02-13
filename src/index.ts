import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { mergeConfig } from "./config/utils.js";
import { VERSION } from "./constants.js";
import { type BerryShieldPluginConfig } from "./types/config.js";
import { registerBerryRoot } from "./layers/root.js";
import { registerBerryPulp } from "./layers/pulp.js";
import { registerBerryThorn } from "./layers/thorn.js";
import { registerBerryLeaf } from "./layers/leaf.js";
import { registerBerryStem } from "./layers/stem.js";
import { registerBerryShieldCli } from "./cli/index.js";

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
    version: VERSION,
    description: "Security plugin - blocks destructive commands, redacts secrets and PII",

    register(api: OpenClawPluginApi) {
        // Get user config and merge with defaults
        const userConfig = api.config ?? {};
        const config: BerryShieldPluginConfig = mergeConfig(userConfig as Partial<BerryShieldPluginConfig>);

        // Count active layers
        const activeLayers = Object.values(config.layers).filter(Boolean).length;

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
