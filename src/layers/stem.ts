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
import { AUDIT_DECISIONS, HOOKS, SECURITY_LAYERS } from "../constants.js";
import { appendAuditEvent } from "../audit/writer.js";
import { notifyPolicyDenied } from "../policy/runtime-state.js";
import { getSharedVineStateManager } from "../vine/runtime-state.js";
import { getSharedVineConfirmStateManager } from "../vine/confirm-state.js";

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { BerryShieldPluginConfig } from "../types/config.js";
import { BRAND_SYMBOL, VINE_CONFIRMATION } from "../constants.js";
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
    /** Optional challenge id for confirm-required flows (internal/advanced use). */
    confirmId?: string;
    /** Optional challenge code for confirm-required flows */
    confirmCode?: string | number;
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
            || (params as { sessionKey?: unknown }).sessionKey === undefined) &&
        (typeof (params as { confirmId?: unknown }).confirmId === "string"
            || (params as { confirmId?: unknown }).confirmId === undefined) &&
        ((typeof (params as { confirmCode?: unknown }).confirmCode === "string"
            || typeof (params as { confirmCode?: unknown }).confirmCode === "number")
            || (params as { confirmCode?: unknown }).confirmCode === undefined)
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

function formatConfirmRequiredVine(input: {
    operation: OperationType;
    target: string;
    confirmCode: string;
    ttlSeconds: number;
    maxAttempts: number;
    attemptsRemaining?: number;
    invalidCode?: boolean;
}): string {
    const retryHint = input.invalidCode
        ? `\nLast code was invalid.${typeof input.attemptsRemaining === "number" ? ` Attempts remaining: ${input.attemptsRemaining}.` : ""}`
        : "";
    return `${BRAND_SYMBOL} Berry Shield

STATUS: CONFIRM_REQUIRED
OPERATION: ${input.operation}
TARGET: ${input.target}
REASON: External untrusted content risk (Vine)
CONFIRM_CODE: ${input.confirmCode}
TTL_SECONDS: ${input.ttlSeconds}
MAX_ATTEMPTS: ${input.maxAttempts}
${typeof input.attemptsRemaining === "number" ? `ATTEMPTS_REMAINING: ${input.attemptsRemaining}` : ""}

Your session is marked as external-untrusted.
Provide confirmCode in berry_check to proceed once.${retryHint}`;
}

function formatDeniedConfirmation(reason: string): string {
    return `${BRAND_SYMBOL} Berry Shield

STATUS: DENIED
REASON: ${reason}

The confirmation challenge is no longer valid.
Start a new confirmation flow by calling berry_check again.`;
}

function emitVineConfirmEvent(
    config: BerryShieldPluginConfig,
    decision: typeof AUDIT_DECISIONS.CONFIRM_REQUIRED
        | typeof AUDIT_DECISIONS.WOULD_CONFIRM_REQUIRED
        | typeof AUDIT_DECISIONS.ALLOWED_BY_CONFIRM,
    target: string,
    reason: string
): void {
    const event: AuditBlockEvent = {
        mode: config.mode,
        decision,
        layer: SECURITY_LAYERS.VINE,
        reason,
        target: target.slice(0, 120),
        ts: new Date().toISOString(),
    };
    appendAuditEvent(event);
}

function maybeApplyVineConfirmRequired(
    api: OpenClawPluginApi,
    config: BerryShieldPluginConfig,
    operation: OperationType,
    target: string,
    sessionKey?: string,
    confirmation?: { confirmId?: string; confirmCode?: string | number; humanTrusted?: boolean }
): {
    requiresConfirmation: boolean;
    challenge?: {
        confirmId: string;
        confirmCode: string;
        ttlSeconds: number;
        maxAttempts: number;
    };
    attemptsRemaining?: number;
    invalidCode?: boolean;
    deniedReason?: string;
    confirmationAccepted?: boolean;
} {
    if (!config.layers.vine || !sessionKey || (operation !== "exec" && operation !== "write")) {
        return { requiresConfirmation: false };
    }
    const vineState = getSharedVineStateManager(config.vine.retention);
    const hasGuardRisk = vineState.shouldGuardSensitiveAction(sessionKey);
    const hasUnknownSignal = vineState.hasUnknownSignal(sessionKey);
    const requiresConfirmation = config.vine.mode === "strict"
        ? (hasGuardRisk || hasUnknownSignal)
        : hasGuardRisk;

    if (!requiresConfirmation) {
        return { requiresConfirmation: false };
    }

    if (config.mode === "audit") {
        const event: AuditBlockEvent = {
            mode: "audit",
            decision: AUDIT_DECISIONS.WOULD_CONFIRM_REQUIRED,
            layer: SECURITY_LAYERS.VINE,
            reason: "external-untrusted instruction risk (confirm required)",
            target: target.slice(0, 120),
            ts: new Date().toISOString(),
        };
        api.logger.warn(`[berry-shield] Berry.Vine: ${formatAuditEvent(event)}`);
        appendAuditEvent(event);
        return { requiresConfirmation: false };
    }

    const confirmState = getSharedVineConfirmStateManager(config.vine.retention);
    if (confirmation?.confirmCode !== undefined) {
        if (!confirmation.humanTrusted) {
            return {
                requiresConfirmation: false,
                deniedReason: "Confirmation requires a trusted user turn in this session",
            };
        }
        const resolvedChallengeId = confirmation.confirmId
            ?? confirmState.resolveLatestChallengeForBinding({
                sessionKey,
                operation: operation === "write" ? "write" : "exec",
                target,
            })?.confirmId;
        if (!resolvedChallengeId) {
            return {
                requiresConfirmation: false,
                deniedReason: "No active confirmation challenge for this operation",
            };
        }
        const verification = confirmState.verifyAndConsume({
            sessionKey,
            operation: operation === "write" ? "write" : "exec",
            target,
            confirmId: resolvedChallengeId,
            confirmCode: confirmation.confirmCode,
        });
        if (verification.kind === "allowed") {
            return { requiresConfirmation: false, confirmationAccepted: true };
        }
        if (verification.kind === "invalid_code") {
            return {
                requiresConfirmation: true,
                challenge: {
                    confirmId: resolvedChallengeId,
                    confirmCode: "",
                    ttlSeconds: VINE_CONFIRMATION.TTL_SECONDS,
                    maxAttempts: VINE_CONFIRMATION.MAX_ATTEMPTS,
                },
                attemptsRemaining: verification.attemptsRemaining,
                invalidCode: true,
            };
        }
        if (verification.kind === "max_attempts_exceeded") {
            return {
                requiresConfirmation: false,
                deniedReason: "Max confirmation attempts exceeded",
            };
        }
        if (verification.kind === "mismatch") {
            return {
                requiresConfirmation: false,
                deniedReason: "Confirmation challenge does not match this operation",
            };
        }
    }

    const challenge = confirmState.issueChallenge({
        sessionKey,
        operation: operation === "write" ? "write" : "exec",
        target,
    });
    emitVineConfirmEvent(
        config,
        AUDIT_DECISIONS.CONFIRM_REQUIRED,
        target,
        "external-untrusted instruction risk"
    );
    return { requiresConfirmation: true, challenge };
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

    const trustedUserConfirmUntil = new Map<string, number>();
    const trustedConfirmWindowMs = 120_000;

    function hasTrustedHumanTurn(sessionKey: string | undefined): boolean {
        if (!sessionKey) return false;
        const expiresAt = trustedUserConfirmUntil.get(sessionKey);
        if (!expiresAt) return false;
        if (expiresAt < Date.now()) {
            trustedUserConfirmUntil.delete(sessionKey);
            return false;
        }
        return true;
    }

    api.on(
        HOOKS.BEFORE_AGENT_START,
        (_event, ctx) => {
            if (!ctx.sessionKey) return;
            if (ctx.trigger === "user") {
                trustedUserConfirmUntil.set(ctx.sessionKey, Date.now() + trustedConfirmWindowMs);
            }
        },
        { priority: 210 }
    );

    api.on(
        HOOKS.SESSION_END,
        (event) => {
            if (event.sessionKey) {
                trustedUserConfirmUntil.delete(event.sessionKey);
            }
        },
        { priority: 210 }
    );

    api.on(
        HOOKS.BEFORE_TOOL_CALL,
        (event, ctx) => {
            if (event.toolName !== "berry_check") {
                return undefined;
            }

            const existing = event.params.sessionKey;
            if (typeof existing === "string" && existing.trim().length > 0) {
                return undefined;
            }

            const runtimeSessionKey = typeof ctx.sessionKey === "string"
                ? ctx.sessionKey.trim()
                : "";
            if (!runtimeSessionKey) {
                return undefined;
            }

            return {
                params: {
                    ...event.params,
                    sessionKey: runtimeSessionKey,
                },
            };
        },
        { priority: 220 }
    );

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
                confirmId: {
                    type: "string",
                    description: "Optional one-shot confirmation challenge id for Vine-sensitive operations",
                },
                confirmCode: {
                    anyOf: [{ type: "string" }, { type: "number" }],
                    description: "Optional numeric confirmation code for Vine-sensitive operations (accepts string or number)",
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
            const { operation, target, sessionKey, confirmId, confirmCode } = rawParams;

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

                const humanTrusted = hasTrustedHumanTurn(sessionKey);
                const vineConfirm = maybeApplyVineConfirmRequired(
                    api,
                    config,
                    operation,
                    target,
                    sessionKey,
                    { confirmId, confirmCode, humanTrusted }
                );
                if (vineConfirm.deniedReason) {
                    return {
                        content: [{ type: "text", text: formatDeniedConfirmation(vineConfirm.deniedReason) }],
                        details: { status: "denied", reason: vineConfirm.deniedReason },
                    };
                }
                if (vineConfirm.confirmationAccepted) {
                    trustedUserConfirmUntil.delete(sessionKey ?? "");
                    emitVineConfirmEvent(
                        config,
                        AUDIT_DECISIONS.ALLOWED_BY_CONFIRM,
                        target,
                        "allowed after explicit confirmation"
                    );
                }
                if (vineConfirm.requiresConfirmation && vineConfirm.challenge) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: formatConfirmRequiredVine({
                                    operation,
                                    target,
                                    confirmCode: vineConfirm.challenge.confirmCode || "****",
                                    ttlSeconds: vineConfirm.challenge.ttlSeconds || 90,
                                    maxAttempts: vineConfirm.challenge.maxAttempts || 3,
                                    attemptsRemaining: vineConfirm.attemptsRemaining,
                                    invalidCode: vineConfirm.invalidCode,
                                }),
                            },
                        ],
                        details: {
                            status: "confirm_required",
                            reason: "external untrusted content risk (vine)",
                            confirmCode: vineConfirm.challenge.confirmCode,
                            ttlSeconds: vineConfirm.challenge.ttlSeconds || 90,
                            maxAttempts: vineConfirm.challenge.maxAttempts || 3,
                            attemptsRemaining: vineConfirm.attemptsRemaining,
                            invalidCode: vineConfirm.invalidCode,
                        },
                    };
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

                if (operation === "write") {
                    const humanTrusted = hasTrustedHumanTurn(sessionKey);
                    const vineConfirm = maybeApplyVineConfirmRequired(
                        api,
                        config,
                        operation,
                        target,
                        sessionKey,
                        { confirmId, confirmCode, humanTrusted }
                    );
                    if (vineConfirm.deniedReason) {
                        return {
                            content: [{ type: "text", text: formatDeniedConfirmation(vineConfirm.deniedReason) }],
                            details: { status: "denied", reason: vineConfirm.deniedReason },
                        };
                    }
                    if (vineConfirm.confirmationAccepted) {
                        trustedUserConfirmUntil.delete(sessionKey ?? "");
                        emitVineConfirmEvent(
                            config,
                            AUDIT_DECISIONS.ALLOWED_BY_CONFIRM,
                            target,
                            "allowed after explicit confirmation"
                        );
                    }
                    if (vineConfirm.requiresConfirmation && vineConfirm.challenge) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: formatConfirmRequiredVine({
                                        operation,
                                        target,
                                        confirmCode: vineConfirm.challenge.confirmCode || "****",
                                        ttlSeconds: vineConfirm.challenge.ttlSeconds || 90,
                                        maxAttempts: vineConfirm.challenge.maxAttempts || 3,
                                        attemptsRemaining: vineConfirm.attemptsRemaining,
                                        invalidCode: vineConfirm.invalidCode,
                                    }),
                                },
                            ],
                            details: {
                                status: "confirm_required",
                                reason: "external untrusted content risk (vine)",
                                confirmCode: vineConfirm.challenge.confirmCode,
                                ttlSeconds: vineConfirm.challenge.ttlSeconds || 90,
                                maxAttempts: vineConfirm.challenge.maxAttempts || 3,
                                attemptsRemaining: vineConfirm.attemptsRemaining,
                                invalidCode: vineConfirm.invalidCode,
                            },
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
