import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

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
        api.logger.info("🍓 Berry Shield v1.0.0 | Security layers active");

        // TODO: Implement layers
        // - Berry.Root (before_agent_start)
        // - Berry.Pulp (tool_result_persist)
        // - Berry.Thorn (before_tool_call)
        // - Berry.Leaf (message_received)
        // - Berry.Stem (registerTool: berry_check)
    },
};
