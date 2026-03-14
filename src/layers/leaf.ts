/**
 * Berry.Leaf - Input Audit Layer
 *
 * Logs incoming messages for security auditing purposes.
 * Uses the `message_received` hook to observe messages.
 *
 * NOTE: This layer is OBSERVATION ONLY - it cannot modify or block messages.
 * It provides an audit trail for security monitoring and compliance.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { BerryShieldPluginConfig } from "../types/config.js";
import { HOOKS } from "../constants.js";
import { getAllRedactionPatterns } from "../patterns/index.js";
import { walkAndRedact } from "../utils/redaction.js";
import { BERRY_LOG_CATEGORY, berryLog } from "../log/berry-log.js";

/**
 * Internal audit log entry structure.
 */
interface InternalAuditLogEntry {
    /** Timestamp in ISO format */
    timestamp: string;
    /** Event type */
    event: typeof HOOKS.MESSAGE_RECEIVED;
    /** Session key */
    sessionKey: string | undefined;
    /** Message source */
    source: string | undefined;
    /** Sender ID */
    senderId: string | undefined;
    /** Message length (not the content for privacy) */
    messageLength: number;
    /** Whether potential secrets were detected */
    containsSecrets: boolean;
    /** Whether potential PII was detected */
    containsPII: boolean;
    /** Types of sensitive data detected */
    sensitiveTypes: string[];
}

/**
 * Registers the Berry.Leaf layer (Input Audit).
 *
 * @param api - OpenClaw plugin API
 * @param config - Plugin configuration
 */
export function registerBerryLeaf(
    api: OpenClawPluginApi,
    config: BerryShieldPluginConfig
): void {
    // Skip if layer is disabled
    if (!config.layers.leaf) {
        berryLog(api.logger, BERRY_LOG_CATEGORY.RUNTIME_EVENT, "Berry.Leaf layer disabled");
        return;
    }

    const patterns = getAllRedactionPatterns();

    api.on(
        HOOKS.MESSAGE_RECEIVED,
        (event, context) => {
            // Normalize event data (OpenClaw passed message might be in 'message' or 'content')
            const message = event.content || "";
            const source = event.from;
            const { timestamp } = event;
            const sessionKey = context.conversationId;

            // Skip if no message content
            if (!message) return;

            // Redact (detect) sensitive content in the message
            const { redactedTypes } = walkAndRedact(message, patterns);

            // Map types back to categories using the central pattern list
            const matchedPatterns = patterns.filter(p => redactedTypes.includes(p.name));
            const containsSecrets = matchedPatterns.some(p => p.category === "secret");
            const containsPII = matchedPatterns.some(p => p.category === "pii");

            // Build audit log entry (JSON structured log)
            const auditEntry: InternalAuditLogEntry = {
                timestamp: (timestamp ? new Date(timestamp) : new Date()).toISOString(),
                event: HOOKS.MESSAGE_RECEIVED,
                sessionKey,
                source,
                senderId: source,
                messageLength: message.length,
                containsSecrets,
                containsPII,
                sensitiveTypes: redactedTypes,
            };

            // Log the audit entry
            if (containsSecrets || containsPII) {
                // Warn level for messages with sensitive content
                berryLog(api.logger, BERRY_LOG_CATEGORY.SECURITY_EVENT, `Berry.Leaf sensitive content detected [${redactedTypes.join(", ")}]`);
                berryLog(api.logger, BERRY_LOG_CATEGORY.LAYER_TRACE, `Berry.Leaf ${JSON.stringify(auditEntry)}`);
            } else {
                // Debug level for normal messages
                berryLog(api.logger, BERRY_LOG_CATEGORY.LAYER_TRACE, `Berry.Leaf ${JSON.stringify(auditEntry)}`);
            }

            // NOTE: message_received hook cannot return values to modify/block
            // This is purely for auditing purposes
        },
        { priority: 50 } // Lower priority - audit runs after security checks
    );

    berryLog(api.logger, BERRY_LOG_CATEGORY.RUNTIME_EVENT, "Berry.Leaf layer registered (Input Audit)");
}
