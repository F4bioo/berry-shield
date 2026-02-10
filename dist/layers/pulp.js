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
import { redactSensitiveData } from "../utils/redaction";
/**
 * Registers the Berry.Pulp layer (Output Scanner).
 *
 * @param api - OpenClaw plugin API
 * @param config - Plugin configuration
 */
export function registerBerryPulp(api, config) {
    // Skip if layer is disabled
    if (!config.layers.pulp) {
        api.logger.debug("[berry-shield] Berry.Pulp layer disabled");
        return;
    }
    api.on("tool_result_persist", (event) => {
        const { content, redactionCount, redactedTypes } = redactSensitiveData(event.result);
        if (redactionCount > 0) {
            if (config.mode === "audit") {
                api.logger.warn(`[berry-shield] AUDIT: would redact ${redactionCount} items in tool result: ${event.toolName}`);
                return event;
            }
            api.logger.warn(`[berry-shield] Redacted ${redactionCount} items [${redactedTypes.join(", ")}] from tool result: ${event.toolName}`);
            return { ...event, result: content };
        }
        return event;
    }, { priority: 200 });
    // [Secondary] Message Sending: Redact direct messages (when supported by channel)
    api.on("message_sending", (event) => {
        const { content, redactionCount, redactedTypes } = redactSensitiveData(event.content);
        if (redactionCount > 0 && typeof content === "string") {
            if (config.mode === "audit") {
                api.logger.warn(`[berry-shield] Berry.Pulp: AUDIT - would redact ${redactionCount} item(s) [${redactedTypes.join(", ")}] in outgoing message`);
                return undefined;
            }
            api.logger.warn(`[berry-shield] Berry.Pulp: redacted ${redactionCount} item(s) [${redactedTypes.join(", ")}] in outgoing message`);
            return { content };
        }
        return undefined;
    }, { priority: 200 });
    api.logger.info("[berry-shield] Berry.Pulp layer registered (Output Scanner)");
}
