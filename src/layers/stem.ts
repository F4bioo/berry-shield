/**
 * Berry.Stem - Security Gate Layer
 *
 * Provides a tool (`berry_check`) that the agent MUST call before
 * executing commands or reading files. This is the MAIN INNOVATION
 * of Berry Shield.
 *
 * Why Berry.Stem is important:
 * - Works in ALL OpenClaw versions (uses tool API, not hooks)
 * - Harder for LLM to ignore a tool result than an instruction
 * - Covers the gap when `before_tool_call` hook is not wired
 *
 * The agent is instructed by Berry.Root to always call this tool
 * before exec/read operations.
 */

import type { AuditBlockEvent } from "../types/audit-event.js";
import { formatAuditEvent } from "../types/audit-event.js";
import { AUDIT_DECISIONS, SECURITY_LAYERS } from "../constants.js";
import { appendAuditEvent } from "../audit/writer.js";
import { notifyPolicyDenied } from "../policy/runtime-state.js";

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { BerryShieldPluginConfig } from "../types/config.js";
import { BRAND_SYMBOL } from "../constants.js";
import {
    getAllDestructiveCommandPatterns,
    getAllSensitiveFilePatterns,
} from "../patterns/index.js";

/**
 * Operation types for berry_check.
 */
type OperationType = "exec" | "read" | "write";

/**
 * Parameters for berry_check tool.
 */
interface BerryCheckParams {
    /** Type of operation to check */
    operation: OperationType;
    /** File path or command to check */
    target: string;
    /** Optional session key for adaptive escalation binding */
    sessionKey?: string;
}

/**
 * Type guard for BerryCheckParams.
 */
function isBerryCheckParams(params: unknown): params is BerryCheckParams {
    if (typeof params !== "object" || params === null) {
        return false;
    }
    const maybe = params as { operation?: unknown; target?: unknown };
    return (
        (maybe.operation === "exec" || maybe.operation === "read" || maybe.operation === "write") &&
        typeof maybe.target === "string" &&
        (typeof (params as { sessionKey?: unknown }).sessionKey === "string"
            || (params as { sessionKey?: unknown }).sessionKey === undefined)
    );
}

function maybeEscalateFromStem(
    api: OpenClawPluginApi,
    sessionKey: string | undefined,
    escalationTurns: number,
    allowGlobalEscalation: boolean
): void {
    if (sessionKey) {
        notifyPolicyDenied(sessionKey, escalationTurns, false);
        return;
    }
    if (allowGlobalEscalation) {
        api.logger.warn("[berry-shield] Berry.Stem: sessionKey missing, applying configured global adaptive escalation");
        notifyPolicyDenied(undefined, escalationTurns, true);
        return;
    }
    api.logger.warn("[berry-shield] Berry.Stem: sessionKey missing, skipping adaptive escalation");
}

/**
 * Checks if a command is destructive.
 *
 * @param command - The command string to check
 * @param customPatterns - Additional user-defined patterns
 * @returns True if destructive
 */
function isDestructiveCommand(
    command: string,
    customPatterns: string[]
): boolean {
    // Check built-in + custom patterns from dynamic loader
    for (const pattern of getAllDestructiveCommandPatterns()) {
        if (pattern.test(command)) {
            return true;
        }
    }

    // Check custom patterns
    for (const patternStr of customPatterns) {
        try {
            const pattern = new RegExp(patternStr, "i");
            if (pattern.test(command)) {
                return true;
            }
        } catch {
            // Invalid regex, skip
        }
    }

    return false;
}

/**
 * Checks if a file path is sensitive.
 *
 * @param filePath - The file path to check
 * @param customPatterns - Additional user-defined patterns
 * @returns True if sensitive
 */
function isSensitiveFile(filePath: string, customPatterns: string[]): boolean {
    // Normalize path separators
    const normalizedPath = filePath.replace(/\\/g, "/");

    // Check built-in + custom patterns from dynamic loader
    for (const pattern of getAllSensitiveFilePatterns()) {
        if (pattern.test(normalizedPath)) {
            return true;
        }
    }

    // Check custom patterns
    for (const patternStr of customPatterns) {
        try {
            const pattern = new RegExp(patternStr, "i");
            if (pattern.test(normalizedPath)) {
                return true;
            }
        } catch {
            // Invalid regex, skip
        }
    }

    return false;
}

/**
 * Formats an ALLOWED response.
 *
 * @param operation - The operation type
 * @param target - The target path/command
 * @returns Formatted response string
 */
function formatAllowed(operation: OperationType, target: string): string {
    return `${BRAND_SYMBOL} Berry Shield

STATUS: ALLOWED
OPERATION: ${operation}
TARGET: ${target}

You may proceed with this operation.`;
}

/**
 * Formats a DENIED response for sensitive files.
 *
 * @param filePath - The sensitive file path
 * @returns Formatted response string
 */
function formatDeniedSensitiveFile(filePath: string): string {
    return `${BRAND_SYMBOL} Berry Shield

STATUS: DENIED
REASON: Sensitive file detected
FILE: ${filePath}

This file may contain secrets or credentials.
ACTION: Do NOT read this file. Inform the user it is blocked by security policy.`;
}

/**
 * Formats a DENIED response for destructive commands.
 *
 * @param command - The destructive command
 * @returns Formatted response string
 */
function formatDeniedDestructiveCommand(command: string): string {
    // Truncate long commands for display
    const displayCommand =
        command.length > 50 ? `${command.substring(0, 50)}...` : command;

    return `${BRAND_SYMBOL} Berry Shield

STATUS: DENIED
REASON: Destructive command detected
COMMAND: ${displayCommand}

This command could cause irreversible damage.
ACTION: Do NOT execute this command. Suggest a safer alternative to the user.`;
}

/**
 * Registers the Berry.Stem layer (Security Gate).
 *
 * @param api - OpenClaw plugin API
 * @param config - Plugin configuration
 */
export function registerBerryStem(
    api: OpenClawPluginApi,
    config: BerryShieldPluginConfig
): void {
    // Skip if layer is disabled
    if (!config.layers.stem) {
        api.logger.debug?.("[berry-shield] Berry.Stem layer disabled");
        return;
    }

    api.registerTool({
        name: "berry_check",
        label: "Security Gate (Exec/Read Check)",
        description:
            "Security gate - call BEFORE exec or file read to verify permission",
        parameters: {
            type: "object",
            properties: {
                operation: {
                    type: "string",
                    enum: ["exec", "read", "write"],
                    description: "Type of operation to check",
                },
                target: {
                    type: "string",
                    description: "File path or command to check",
                },
                sessionKey: {
                    type: "string",
                    description: "Optional session key used for adaptive policy escalation binding",
                },
            },
            required: ["operation", "target"],
        },

        async execute(
            _id: string,
            rawParams: Record<string, unknown>
        ) {
            if (!isBerryCheckParams(rawParams)) {
                throw new Error("Invalid parameters for berry_check");
            }
            const { operation, target, sessionKey } = rawParams;

            // Check for destructive commands on exec operations
            if (operation === "exec") {
                if (isDestructiveCommand(target, config.destructiveCommands)) {
                    api.logger.warn(`[berry-shield] Berry.Stem: DENIED exec - destructive command: ${target.substring(0, 50)}`);

                    if (config.mode === "audit") {
                        const event: AuditBlockEvent = {
                            mode: "audit", decision: AUDIT_DECISIONS.WOULD_BLOCK, layer: SECURITY_LAYERS.STEM,
                            reason: "destructive command", target: target.substring(0, 100),
                            ts: new Date().toISOString(),
                        };
                        api.logger.warn(`[berry-shield] Berry.Stem: ${formatAuditEvent(event)}`);
                        appendAuditEvent(event);
                    } else {
                        const event: AuditBlockEvent = {
                            mode: "enforce", decision: AUDIT_DECISIONS.BLOCKED, layer: SECURITY_LAYERS.STEM,
                            reason: "destructive command", target: target.substring(0, 100),
                            ts: new Date().toISOString(),
                        };
                        appendAuditEvent(event);
                        maybeEscalateFromStem(
                            api,
                            sessionKey,
                            config.policy.adaptive.escalationTurns,
                            config.policy.adaptive.allowGlobalEscalation
                        );
                        return {
                            content: [
                                { type: "text", text: formatDeniedDestructiveCommand(target) },
                            ],
                            details: { status: "denied", reason: "destructive command" },
                        };
                    }
                }

                // Also check if exec command references a sensitive file (e.g., cat .env)
                if (isSensitiveFile(target, config.sensitiveFilePaths)) {
                    if (config.mode === "audit") {
                        const event: AuditBlockEvent = {
                            mode: "audit", decision: AUDIT_DECISIONS.WOULD_BLOCK, layer: SECURITY_LAYERS.STEM,
                            reason: "sensitive file reference", target: target.substring(0, 100),
                            ts: new Date().toISOString(),
                        };
                        api.logger.warn(`[berry-shield] Berry.Stem: ${formatAuditEvent(event)}`);
                        appendAuditEvent(event);
                    } else {
                        api.logger.warn(`[berry-shield] Berry.Stem: DENIED exec - command references sensitive file: ${target.substring(0, 50)}`);
                        const event: AuditBlockEvent = {
                            mode: "enforce", decision: AUDIT_DECISIONS.BLOCKED, layer: SECURITY_LAYERS.STEM,
                            reason: "sensitive file reference", target: target.substring(0, 100),
                            ts: new Date().toISOString(),
                        };
                        appendAuditEvent(event);
                        maybeEscalateFromStem(
                            api,
                            sessionKey,
                            config.policy.adaptive.escalationTurns,
                            config.policy.adaptive.allowGlobalEscalation
                        );
                        return {
                            content: [
                                { type: "text", text: formatDeniedSensitiveFile(target) },
                            ],
                            details: { status: "denied", reason: "sensitive file reference" },
                        };
                    }
                }
            }

            // Check for sensitive files on read/write operations
            if (operation === "read" || operation === "write") {
                if (isSensitiveFile(target, config.sensitiveFilePaths)) {
                    if (config.mode === "audit") {
                        const event: AuditBlockEvent = {
                            mode: "audit", decision: AUDIT_DECISIONS.WOULD_BLOCK, layer: SECURITY_LAYERS.STEM,
                            reason: "sensitive file access", target,
                            ts: new Date().toISOString(),
                        };
                        api.logger.warn(`[berry-shield] Berry.Stem: ${formatAuditEvent(event)}`);
                        appendAuditEvent(event);
                    } else {
                        api.logger.warn(`[berry-shield] Berry.Stem: DENIED ${operation} - sensitive file: ${target}`);
                        const event: AuditBlockEvent = {
                            mode: "enforce", decision: AUDIT_DECISIONS.BLOCKED, layer: SECURITY_LAYERS.STEM,
                            reason: "sensitive file access", target,
                            ts: new Date().toISOString(),
                        };
                        appendAuditEvent(event);
                        maybeEscalateFromStem(
                            api,
                            sessionKey,
                            config.policy.adaptive.escalationTurns,
                            config.policy.adaptive.allowGlobalEscalation
                        );
                        return {
                            content: [
                                { type: "text", text: formatDeniedSensitiveFile(target) },
                            ],
                            details: { status: "denied", reason: "sensitive file access" },
                        };
                    }
                }
            }

            // Operation is allowed
            api.logger.debug?.(`[berry-shield] Berry.Stem: ALLOWED ${operation} on ${target}`);

            return {
                content: [{ type: "text", text: formatAllowed(operation, target) }],
                details: { status: "allowed" },
            };
        },
    });

    api.logger.debug?.("[berry-shield] Berry.Stem layer registered");
}
