/**
 * Berry.Thorn - Tool Blocker Layer
 *
 * Blocks dangerous tool calls before they execute.
 * Uses the `before_tool_call` hook to intercept and block:
 * - Destructive commands (rm, del, format, etc.)
 * - Access to sensitive files (.env, credentials, keys, etc.)
 *
 * NOTE: This hook may not be wired in all OpenClaw versions.
 * Berry.Stem provides a complementary fallback mechanism.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { BerryShieldPluginConfig } from "../types/config.js";
import type { AuditBlockEvent } from "../types/audit-event.js";
import { formatAuditEvent } from "../types/audit-event.js";
import { AUDIT_DECISIONS, SECURITY_LAYERS } from "../constants.js";
import { appendAuditEvent } from "../audit/writer.js";
import { HOOKS } from "../constants.js";
import { formatCardForBlockReason } from "../ui/decision-card/format-text.js";
import { notifyPolicyDenied } from "../policy/runtime-state.js";
import {
    getAllDestructiveCommandPatterns,
    getAllSensitiveFilePatterns,
} from "../patterns/index.js";
import { findMatches } from "../utils/redaction.js";
import { BERRY_LOG_CATEGORY, berryLog } from "../log/berry-log.js";

/**
 * Checks if a command is destructive.
 *
 * @param command - The command string to check
 * @param customPatterns - Additional user-defined patterns
 * @returns True if destructive
 */
function isDestructiveCommand(
    command: string,
): boolean {
    const patterns = getAllDestructiveCommandPatterns();
    return findMatches(command, patterns).length > 0;
}

/**
 * Checks if a file path is sensitive.
 *
 * @param filePath - The file path to check
 * @param customPatterns - Additional user-defined patterns
 * @returns True if sensitive
 */
function isSensitiveFile(filePath: string): boolean {
    // Normalize path separators
    const normalizedPath = filePath.replace(/\\/g, "/");
    const patterns = getAllSensitiveFilePatterns();
    return findMatches(normalizedPath, patterns).length > 0;
}

/**
 * Extracts command string from tool parameters.
 *
 * @param toolName - Name of the tool
 * @param params - Tool parameters
 * @returns Command string or undefined
 */
function extractCommand(
    toolName: string,
    params: Record<string, unknown>
): string | undefined {
    // Common parameter names for commands
    const commandKeys = ["command", "cmd", "script", "bash", "shell", "exec"];

    // Check if this is an execution-type tool
    const execTools = ["exec", "bash", "shell", "run_command", "execute"];
    if (!execTools.some((t) => toolName.toLowerCase().includes(t))) {
        // Also check params for command-like content
        for (const key of commandKeys) {
            if (typeof params[key] === "string") {
                return params[key] as string;
            }
        }
        return undefined;
    }

    // Extract command from params
    for (const key of commandKeys) {
        if (typeof params[key] === "string") {
            return params[key] as string;
        }
    }

    // Check CommandLine for run_command style tools
    if (typeof params["CommandLine"] === "string") {
        return params["CommandLine"] as string;
    }

    return undefined;
}

/**
 * Extracts file path from tool parameters.
 *
 * @param toolName - Name of the tool
 * @param params - Tool parameters
 * @returns File path or undefined
 */
function extractFilePath(
    toolName: string,
    params: Record<string, unknown>
): string | undefined {
    // Common parameter names for file paths
    const pathKeys = [
        "path",
        "file",
        "filePath",
        "file_path",
        "target",
        "AbsolutePath",
        "TargetFile",
    ];

    // Check if this is a file-type tool
    const fileTools = ["read", "write", "view", "edit", "file"];
    if (!fileTools.some((t) => toolName.toLowerCase().includes(t))) {
        return undefined;
    }

    // Extract path from params
    for (const key of pathKeys) {
        if (typeof params[key] === "string") {
            return params[key] as string;
        }
    }

    return undefined;
}

/**
 * Registers the Berry.Thorn layer (Tool Blocker).
 *
 * @param api - OpenClaw plugin API
 * @param config - Plugin configuration
 */
export function registerBerryThorn(
    api: OpenClawPluginApi,
    config: BerryShieldPluginConfig
): void {
    // Skip if layer is disabled
    if (!config.layers.thorn) {
        berryLog(api.logger, BERRY_LOG_CATEGORY.RUNTIME_EVENT, "Berry.Thorn layer disabled");
        return;
    }

    api.on(
        HOOKS.BEFORE_TOOL_CALL,
        (event, ctx) => {
            const { toolName, params } = event;
            const escalationSessionKey = ctx?.sessionKey;

            // Check for destructive commands
            const command = extractCommand(toolName, params);
            if (command && isDestructiveCommand(command)) {
                const reason = `Destructive command detected: ${command.substring(0, 50)}${command.length > 50 ? "..." : ""}`;

                if (config.mode === "audit") {
                    const auditEvent: AuditBlockEvent = {
                        mode: "audit", decision: AUDIT_DECISIONS.WOULD_BLOCK, layer: SECURITY_LAYERS.THORN,
                        reason: "destructive command", target: command.substring(0, 100),
                        ts: new Date().toISOString(),
                    };
                    berryLog(api.logger, BERRY_LOG_CATEGORY.SECURITY_EVENT, `Berry.Thorn: ${formatAuditEvent(auditEvent)}`);
                    appendAuditEvent(auditEvent);
                    return undefined;
                }

                const auditEvent: AuditBlockEvent = {
                    mode: "enforce", decision: AUDIT_DECISIONS.BLOCKED, layer: SECURITY_LAYERS.THORN,
                    reason: "destructive command", target: command.substring(0, 100),
                    ts: new Date().toISOString(),
                };
                appendAuditEvent(auditEvent);
                if (escalationSessionKey) {
                    notifyPolicyDenied(escalationSessionKey, config.policy.adaptive.escalationTurns, false);
                } else if (config.policy.adaptive.allowGlobalEscalation) {
                    berryLog(api.logger, BERRY_LOG_CATEGORY.COMPAT_EVENT, "Berry.Thorn: sessionKey missing, applying configured global adaptive escalation");
                    notifyPolicyDenied(undefined, config.policy.adaptive.escalationTurns, true);
                } else {
                    berryLog(api.logger, BERRY_LOG_CATEGORY.COMPAT_EVENT, "Berry.Thorn: sessionKey missing, skipping adaptive escalation");
                }
                berryLog(api.logger, BERRY_LOG_CATEGORY.SECURITY_EVENT, `Berry.Thorn: BLOCKED - ${reason}`);
                return {
                    block: true,
                    blockReason: formatCardForBlockReason({
                        status: "BLOCKED",
                        layer: "Thorn",
                        operation: "exec",
                        target: command,
                        reason: "Destructive command detected",
                    }),
                };
            }

            // Check if exec command references a sensitive file (e.g., cat .env)
            if (command && isSensitiveFile(command)) {
                const reason = `Command references sensitive file: ${command.substring(0, 50)}${command.length > 50 ? "..." : ""}`;

                if (config.mode === "audit") {
                    const auditEvent: AuditBlockEvent = {
                        mode: "audit", decision: AUDIT_DECISIONS.WOULD_BLOCK, layer: SECURITY_LAYERS.THORN,
                        reason: "sensitive file reference", target: command.substring(0, 100),
                        ts: new Date().toISOString(),
                    };
                    berryLog(api.logger, BERRY_LOG_CATEGORY.SECURITY_EVENT, `Berry.Thorn: ${formatAuditEvent(auditEvent)}`);
                    appendAuditEvent(auditEvent);
                    return undefined;
                }

                const auditEvent: AuditBlockEvent = {
                    mode: "enforce", decision: AUDIT_DECISIONS.BLOCKED, layer: SECURITY_LAYERS.THORN,
                    reason: "sensitive file reference", target: command.substring(0, 100),
                    ts: new Date().toISOString(),
                };
                appendAuditEvent(auditEvent);
                if (escalationSessionKey) {
                    notifyPolicyDenied(escalationSessionKey, config.policy.adaptive.escalationTurns, false);
                } else if (config.policy.adaptive.allowGlobalEscalation) {
                    berryLog(api.logger, BERRY_LOG_CATEGORY.COMPAT_EVENT, "Berry.Thorn: sessionKey missing, applying configured global adaptive escalation");
                    notifyPolicyDenied(undefined, config.policy.adaptive.escalationTurns, true);
                } else {
                    berryLog(api.logger, BERRY_LOG_CATEGORY.COMPAT_EVENT, "Berry.Thorn: sessionKey missing, skipping adaptive escalation");
                }
                berryLog(api.logger, BERRY_LOG_CATEGORY.SECURITY_EVENT, `Berry.Thorn: BLOCKED - ${reason}`);
                return {
                    block: true,
                    blockReason: formatCardForBlockReason({
                        status: "BLOCKED",
                        layer: "Thorn",
                        operation: "exec",
                        target: command,
                        reason: "Command references sensitive file",
                    }),
                };
            }

            // Check for sensitive file access
            const filePath = extractFilePath(toolName, params);
            if (filePath && isSensitiveFile(filePath)) {
                const reason = `Sensitive file detected: ${filePath}`;

                if (config.mode === "audit") {
                    const auditEvent: AuditBlockEvent = {
                        mode: "audit", decision: AUDIT_DECISIONS.WOULD_BLOCK, layer: SECURITY_LAYERS.THORN,
                        reason: "sensitive file access", target: filePath,
                        ts: new Date().toISOString(),
                    };
                    berryLog(api.logger, BERRY_LOG_CATEGORY.SECURITY_EVENT, `Berry.Thorn: ${formatAuditEvent(auditEvent)}`);
                    appendAuditEvent(auditEvent);
                    return undefined;
                }

                const auditEvent: AuditBlockEvent = {
                    mode: "enforce", decision: AUDIT_DECISIONS.BLOCKED, layer: SECURITY_LAYERS.THORN,
                    reason: "sensitive file access", target: filePath,
                    ts: new Date().toISOString(),
                };
                appendAuditEvent(auditEvent);
                if (escalationSessionKey) {
                    notifyPolicyDenied(escalationSessionKey, config.policy.adaptive.escalationTurns, false);
                } else if (config.policy.adaptive.allowGlobalEscalation) {
                    berryLog(api.logger, BERRY_LOG_CATEGORY.COMPAT_EVENT, "Berry.Thorn: sessionKey missing, applying configured global adaptive escalation");
                    notifyPolicyDenied(undefined, config.policy.adaptive.escalationTurns, true);
                } else {
                    berryLog(api.logger, BERRY_LOG_CATEGORY.COMPAT_EVENT, "Berry.Thorn: sessionKey missing, skipping adaptive escalation");
                }
                berryLog(api.logger, BERRY_LOG_CATEGORY.SECURITY_EVENT, `Berry.Thorn: BLOCKED - ${reason}`);
                return {
                    block: true,
                    blockReason: formatCardForBlockReason({
                        status: "BLOCKED",
                        layer: "Thorn",
                        target: filePath,
                        reason: "Sensitive file access",
                    }),
                };
            }

            // Allow the tool call
            return undefined;
        },
        { priority: 200 } // High priority - security runs first
    );

    berryLog(api.logger, BERRY_LOG_CATEGORY.RUNTIME_EVENT, "Berry.Thorn layer registered");
}
