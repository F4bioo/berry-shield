/**
 * Berry.Pulp - Output Scanner Layer
 *
 * Censors secrets and PII in tool outputs before they are
 * persisted to the session transcript.
 *
 * Uses the `tool_result_persist` hook which runs SYNCHRONOUSLY
 * when a tool result is about to be saved.
 *
 * LIMITATION: The LLM may see the output BEFORE this hook runs (timing gap).
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { PluginConfig } from "../types/config";
import { redactSensitiveData } from "../utils/redaction";

/**
 * Tool result event structure.
 */
interface ToolResultEvent {
    /** Tool name that produced the result */
    toolName: string;
    /** The result payload to be persisted */
    result: unknown;
}

/**
 * Registers the Berry.Pulp layer (Output Scanner).
 *
 * @param api - OpenClaw plugin API
 * @param config - Plugin configuration
 */
export function registerBerryPulp(
    api: OpenClawPluginApi,
    config: PluginConfig
): void {
    // Skip if layer is disabled
    if (!config.layers.pulp) {
        api.logger.debug("[berry-shield] Berry.Pulp layer disabled");
        return;
    }

    api.on(
        "tool_result_persist",
        (event: ToolResultEvent) => {
            // In audit mode, just log without modifying
            if (config.mode === "audit") {
                const { redactionCount, redactedTypes } = redactSensitiveData(event.result);
                if (redactionCount > 0) {
                    api.logger.info(
                        `[berry-shield] Berry.Pulp: AUDIT - would redact ${redactionCount} item(s) [${redactedTypes.join(", ")}] in ${event.toolName}`
                    );
                }
                return undefined; // Keep original
            }

            // In enforce mode, redact and return modified result
            const { content, redactionCount, redactedTypes } = redactSensitiveData(event.result);

            if (redactionCount > 0) {
                api.logger.info(
                    `[berry-shield] Berry.Pulp: redacted ${redactionCount} item(s) [${redactedTypes.join(", ")}] in ${event.toolName}`
                );
                // Return the modified result to replace the original
                return { ...event, result: content };
            }

            // No redactions needed, keep original
            return undefined;
        },
        { priority: 200 } // High priority - security runs first
    );

    api.logger.debug("[berry-shield] Berry.Pulp layer registered");
}
