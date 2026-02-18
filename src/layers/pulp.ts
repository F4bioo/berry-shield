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
import type { AuditRedactEvent } from "../types/audit-event.js";
import { formatAuditEvent } from "../types/audit-event.js";
import { AUDIT_DECISIONS, SECURITY_LAYERS, HOOKS } from "../constants.js";
import { appendAuditEvent } from "../audit/writer.js";
import { getAllRedactionPatterns } from "../patterns/index.js";
import { walkAndRedact } from "../utils/redaction.js";

const POLICY_BLOCK_PATTERN = /<berry_shield_policy>[\s\S]*?<\/berry_shield_policy>/gi;

function stripPolicyBlocks(input: string): { content: string; removed: boolean } {
    const stripped = input.replace(POLICY_BLOCK_PATTERN, "").trim();
    return { content: stripped, removed: stripped !== input };
}

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
                    const auditEvent: AuditRedactEvent = {
                        mode: "audit", decision: AUDIT_DECISIONS.WOULD_REDACT, layer: SECURITY_LAYERS.PULP,
                        hook: HOOKS.TOOL_RESULT_PERSIST, toolName: event.toolName ?? "unknown",
                        count: redactionCount, types: redactedTypes,
                        ts: new Date().toISOString(),
                    };
                    api.logger.warn(`[berry-shield] Berry.Pulp: ${formatAuditEvent(auditEvent)}`);
                    appendAuditEvent(auditEvent);
                    return event;
                }

                const auditEvent: AuditRedactEvent = {
                    mode: "enforce", decision: AUDIT_DECISIONS.REDACTED, layer: SECURITY_LAYERS.PULP,
                    hook: HOOKS.TOOL_RESULT_PERSIST, toolName: event.toolName ?? "unknown",
                    count: redactionCount, types: redactedTypes,
                    ts: new Date().toISOString(),
                };
                appendAuditEvent(auditEvent);
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
            const stripped = stripPolicyBlocks(event.content);
            if (stripped.removed) {
                api.logger.warn("[berry-shield] Berry.Pulp: stripped leaked <berry_shield_policy> block from outgoing message");
            }

            const patterns = getAllRedactionPatterns();
            const { content, redactionCount, redactedTypes } = walkAndRedact(stripped.content, patterns);

            if (redactionCount > 0) {
                if (config.mode === "audit") {
                    const auditEvent: AuditRedactEvent = {
                        mode: "audit", decision: AUDIT_DECISIONS.WOULD_REDACT, layer: SECURITY_LAYERS.PULP,
                        hook: HOOKS.MESSAGE_SENDING, toolName: "message",
                        count: redactionCount, types: redactedTypes,
                        ts: new Date().toISOString(),
                    };
                    api.logger.warn(`[berry-shield] Berry.Pulp: ${formatAuditEvent(auditEvent)}`);
                    appendAuditEvent(auditEvent);
                    if (stripped.removed) {
                        return { content: stripped.content };
                    }
                    return undefined;
                }

                const auditEvent: AuditRedactEvent = {
                    mode: "enforce", decision: AUDIT_DECISIONS.REDACTED, layer: SECURITY_LAYERS.PULP,
                    hook: HOOKS.MESSAGE_SENDING, toolName: "message",
                    count: redactionCount, types: redactedTypes,
                    ts: new Date().toISOString(),
                };
                appendAuditEvent(auditEvent);
                api.logger.warn(`[berry-shield] Berry.Pulp: redacted ${redactionCount} item(s) [${redactedTypes.join(", ")}] in outgoing message`);
                return { content: content };
            }

            if (stripped.removed) {
                return { content: stripped.content };
            }

            return undefined;
        },
        { priority: 200 }
    );

    api.logger.debug?.("[berry-shield] Berry.Pulp layer registered (Output Scanner)");
}
