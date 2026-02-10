/**
 * Berry.Leaf - Input Audit Layer
 *
 * Logs incoming messages for security auditing purposes.
 * Uses the `message_received` hook to observe messages.
 *
 * NOTE: This layer is OBSERVATION ONLY - it cannot modify or block messages.
 * It provides an audit trail for security monitoring and compliance.
 */

import type { OpenClawPluginApi, PluginHookMessageReceivedEvent, PluginHookMessageContext } from "openclaw/plugin-sdk";
import type { PluginConfig } from "../types/config";
import { getAllRedactionPatterns, type SecurityPattern } from "../patterns";

/**
 * Internal audit log entry structure.
 */
interface InternalAuditLogEntry {
    /** Timestamp in ISO format */
    timestamp: string;
    /** Event type */
    event: "message_received";
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
 * Checks if text contains sensitive patterns.
 *
 * @param text - Text to check
 * @param patterns - Patterns to match against
 * @returns Object with detection results
 */
function detectSensitiveContent(
    text: string,
    patterns: SecurityPattern[]
): { containsSecrets: boolean; containsPII: boolean; types: string[] } {
    const detectedTypes: string[] = [];
    let containsSecrets = false;
    let containsPII = false;

    // Secret patterns are indexed 0-13 in the combined array
    // PII patterns are indexed 14+ in the combined array
    const secretPatternNames = [
        "AWS Access Key",
        "AWS Secret Key",
        "Stripe Key",
        "GitHub Token",
        "GitHub PAT",
        "OpenAI Key",
        "Anthropic Key",
        "Slack Token",
        "SendGrid Key",
        "NPM Token",
        "Private Key",
        "JWT",
        "Bearer Token",
        "Generic API Key",
    ];

    for (const pattern of patterns) {
        // Reset regex lastIndex for global patterns
        pattern.pattern.lastIndex = 0;

        if (pattern.pattern.test(text)) {
            detectedTypes.push(pattern.name);

            if (secretPatternNames.includes(pattern.name)) {
                containsSecrets = true;
            } else {
                containsPII = true;
            }
        }
    }

    return { containsSecrets, containsPII, types: detectedTypes };
}

/**
 * Registers the Berry.Leaf layer (Input Audit).
 *
 * @param api - OpenClaw plugin API
 * @param config - Plugin configuration
 */
export function registerBerryLeaf(
    api: OpenClawPluginApi,
    config: PluginConfig
): void {
    // Skip if layer is disabled
    if (!config.layers.leaf) {
        api.logger.debug("[berry-shield] Berry.Leaf layer disabled");
        return;
    }

    const patterns = getAllRedactionPatterns();

    api.on(
        "message_received",
        (event: PluginHookMessageReceivedEvent, ctx: PluginHookMessageContext) => {
            // Normalize event data (OpenClaw passed message might be in 'message' or 'content')
            const message = event.message || event.content || "";
            const { source, senderId, timestamp } = event;
            const sessionKey = event.sessionKey || ctx.sessionKey;

            // Skip if no message content
            if (!message) return;

            // Detect sensitive content in the message
            const detection = detectSensitiveContent(message, patterns);

            // Build audit log entry (JSON structured log)
            const auditEntry: InternalAuditLogEntry = {
                timestamp: (timestamp ? new Date(timestamp) : new Date()).toISOString(),
                event: "message_received",
                sessionKey,
                source,
                senderId,
                messageLength: message.length,
                containsSecrets: detection.containsSecrets,
                containsPII: detection.containsPII,
                sensitiveTypes: detection.types,
            };

            // Log the audit entry
            if (detection.containsSecrets || detection.containsPII) {
                // Warn level for messages with sensitive content
                api.logger.warn(`[berry-shield] Berry.Leaf: AUDIT - sensitive content detected [${detection.types.join(", ")}]`);
                api.logger.debug(`[berry-shield] Berry.Leaf: ${JSON.stringify(auditEntry)}`);
            } else {
                // Debug level for normal messages
                api.logger.debug(`[berry-shield] Berry.Leaf: ${JSON.stringify(auditEntry)}`);
            }

            // NOTE: message_received hook cannot return values to modify/block
            // This is purely for auditing purposes
        },
        { priority: 50 } // Lower priority - audit runs after security checks
    );

    api.logger.debug("[berry-shield] Berry.Leaf layer registered");
}
