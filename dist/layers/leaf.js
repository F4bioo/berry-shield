/**
 * Berry.Leaf - Input Audit Layer
 *
 * Logs incoming messages for security auditing purposes.
 * Uses the `message_received` hook to observe messages.
 *
 * NOTE: This layer is OBSERVATION ONLY - it cannot modify or block messages.
 * It provides an audit trail for security monitoring and compliance.
 */
import { getAllRedactionPatterns } from "../patterns";
import { walkAndRedact } from "../utils/redaction";
/**
 * Registers the Berry.Leaf layer (Input Audit).
 *
 * @param api - OpenClaw plugin API
 * @param config - Plugin configuration
 */
export function registerBerryLeaf(api, config) {
    // Skip if layer is disabled
    if (!config.layers.leaf) {
        api.logger.debug?.("[berry-shield] Berry.Leaf layer disabled");
        return;
    }
    const patterns = getAllRedactionPatterns();
    api.on("message_received", (event, context) => {
        // Normalize event data (OpenClaw passed message might be in 'message' or 'content')
        const message = event.content || "";
        const source = event.from;
        const { timestamp } = event;
        const sessionKey = context.conversationId;
        // Skip if no message content
        if (!message)
            return;
        // Redact (detect) sensitive content in the message
        const { redactionCount, redactedTypes } = walkAndRedact(message, patterns);
        // Map types back to categories using the central pattern list
        const matchedPatterns = patterns.filter(p => redactedTypes.includes(p.name));
        const containsSecrets = matchedPatterns.some(p => p.category === "secret");
        const containsPII = matchedPatterns.some(p => p.category === "pii");
        // Build audit log entry (JSON structured log)
        const auditEntry = {
            timestamp: (timestamp ? new Date(timestamp) : new Date()).toISOString(),
            event: "message_received",
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
            api.logger.warn(`[berry-shield] Berry.Leaf: AUDIT - sensitive content detected [${redactedTypes.join(", ")}]`);
            api.logger.debug?.(`[berry-shield] Berry.Leaf: ${JSON.stringify(auditEntry)}`);
        }
        else {
            // Debug level for normal messages
            api.logger.debug?.(`[berry-shield] Berry.Leaf: ${JSON.stringify(auditEntry)}`);
        }
        // NOTE: message_received hook cannot return values to modify/block
        // This is purely for auditing purposes
    }, { priority: 50 } // Lower priority - audit runs after security checks
    );
    api.logger.debug?.("[berry-shield] Berry.Leaf layer registered");
}
