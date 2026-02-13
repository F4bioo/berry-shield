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
import { initializePatterns } from "./patterns/index.js";

/**
 * Berry Shield - Security architecture for OpenClaw
 *
 * 5-layer security architecture:
 * - Berry.Root: Prompt Guard (injects security policies)
 * - Berry.Pulp: Output Scanner (redacts detected secrets/PII)
 * - Berry.Thorn: Tool Blocker (mitigates flagged commands)
 * - Berry.Leaf: Input Audit (logs for auditing)
 * - Berry.Stem: Security Gate (tool-based checkpoint)
 */

export default {
    id: "berry-shield",
    name: "Berry Shield",
    version: VERSION,
    description: "Security plugin designed to mitigate flagged commands and redact detected secrets/PII",

    async register(api: OpenClawPluginApi) {
        // Initialize security patterns from disk
        await initializePatterns();

        // Get user config (priority to plugin-specific config) and merge with defaults
        const userConfig = api.pluginConfig ?? api.config ?? {};
        const config = mergeConfig(userConfig);

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
