import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { mergeConfig } from "./config/utils.js";
import { VERSION, BRAND_SYMBOL } from "./constants.js";
import { registerBerryRoot } from "./layers/root.js";
import { registerBerryPulp } from "./layers/pulp.js";
import { registerBerryThorn } from "./layers/thorn.js";
import { registerBerryLeaf } from "./layers/leaf.js";
import { registerBerryStem } from "./layers/stem.js";
import { registerBerryVine } from "./layers/vine.js";
import { registerBerryShieldCli } from "./cli/index.js";
import { initializePatterns } from "./patterns/index.js";
import { initAuditWriter } from "./audit/writer.js";
import { loadCustomRulesSync } from "./cli/storage.js";

/**
 * Berry Shield - Security architecture for OpenClaw
 *
 * 6-layer security architecture:
 * - Berry.Root: Prompt Guard (injects security policies)
 * - Berry.Pulp: Output Scanner (redacts detected secrets/PII)
 * - Berry.Thorn: Tool Blocker (mitigates flagged commands)
 * - Berry.Leaf: Input Audit (logs for auditing)
 * - Berry.Stem: Security Gate (tool-based checkpoint)
 * - Berry.Vine: External Content Guard (prompt-injection hardening)
 */

export default {
    id: "berry-shield",
    name: "Berry Shield",
    version: VERSION,
    description: "Security plugin designed to mitigate flagged commands and redact detected secrets/PII",

    register(api: OpenClawPluginApi) {
        // Get user config (priority to plugin-specific config) and merge with defaults
        const userConfig = api.pluginConfig ?? api.config ?? {};
        const config = mergeConfig(userConfig);
        const localDelta = loadCustomRulesSync();

        // Initialize security patterns from effective config + local baseline disables
        initializePatterns(config.customRules, localDelta.disabledBuiltInIds ?? []);
        initAuditWriter();

        // Register all security layers
        registerBerryRoot(api, config);  // Prompt Guard
        registerBerryPulp(api, config);  // Output Scanner
        registerBerryThorn(api, config); // Tool Blocker
        registerBerryLeaf(api, config);  // Input Audit
        registerBerryStem(api, config);  // Security Gate
        registerBerryVine(api, config);  // External Content Guard

        // Warn when running in audit (Shadow Mode) — data is NOT protected
        if (config.mode === "audit") {
            api.logger.warn(`[berry-shield] ${BRAND_SYMBOL} Running in AUDIT (Shadow Mode) — actions will NOT be blocked and output will NOT be redacted.`);
        }

        // Register CLI commands (bshield)
        registerBerryShieldCli(api);
    },
};
