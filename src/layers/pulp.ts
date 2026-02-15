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
import type { BerryShieldPluginConfig } from "../types/config.js";
import { HOOKS } from "../constants.js";
import { getAllRedactionPatterns } from "../patterns/index.js";
import { walkAndRedact } from "../utils/redaction.js";

/**
 * Registers the Berry.Pulp layer (Output Scanner).
 *
 * @param api - OpenClaw plugin API
 * @param config - Plugin configuration
 */
export function registerBerryPulp(
    api: OpenClawPluginApi,
    config: BerryShieldPluginConfig
): void {
    // Skip if layer is disabled
    if (!config.layers.pulp) {
        api.logger.debug?.("[berry-shield] Berry.Pulp layer disabled");
        return;
    }

    api.on(
        HOOKS.TOOL_RESULT_PERSIST,
        (event) => {
            const patterns = getAllRedactionPatterns();
            const { content, redactionCount, redactedTypes } = walkAndRedact(event.message, patterns);

            if (redactionCount > 0) {
                if (config.mode === "audit") {
                    api.logger.warn(`[berry-shield] AUDIT: would redact ${redactionCount} items in tool result: ${event.toolName}`);
                    // Return unmodified event in audit mode
                    return event;
                }

                api.logger.warn(`[berry-shield] Redacted ${redactionCount} items [${redactedTypes.join(", ")}] from tool result: ${event.toolName}`);

                // Return modified message. 'content' is the redacted version of event.message.
                return { ...event, message: content };
            }

            return event;
        },
        { priority: 200 }
    );

    // [Secondary] Message Sending: Redact direct messages (when supported by channel)
    api.on(
        HOOKS.MESSAGE_SENDING,
        (event) => {
            const patterns = getAllRedactionPatterns();
            const { content, redactionCount, redactedTypes } = walkAndRedact(event.content, patterns);

            if (redactionCount > 0) {
                if (config.mode === "audit") {
                    api.logger.warn(`[berry-shield] Berry.Pulp: AUDIT - would redact ${redactionCount} item(s) [${redactedTypes.join(", ")}] in outgoing message`);
                    return undefined;
                }

                api.logger.warn(`[berry-shield] Berry.Pulp: redacted ${redactionCount} item(s) [${redactedTypes.join(", ")}] in outgoing message`);
                return { content: content };
            }

            return undefined;
        },
        { priority: 200 }
    );

    api.logger.debug?.("[berry-shield] Berry.Pulp layer registered (Output Scanner)");
}
