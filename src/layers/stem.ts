/**
 * Berry.Stem - Security Gate Layer
 *
 * Provides the `berry_check` tool that the agent must call before sensitive
 * operations (`exec`, `read`, `write`) to validate policy decisions.
 *
 * Why Berry.Stem is important:
 * - Works across OpenClaw versions via tool contract (independent of hook-only enforcement)
 * - Produces explicit ALLOWED/DENIED/CONFIRM_REQUIRED decisions consumable by the agent
 * - Integrates with Vine confirm-required flows for external-risk sensitive actions
 */
import { randomUUID } from "node:crypto";
import type { AuditBlockEvent } from "../types/audit-event.js";
import { formatAuditEvent } from "../types/audit-event.js";
import { AUDIT_DECISIONS, HOOKS, SECURITY_LAYERS, VINE_CONFIRMATION_STRATEGY_LABEL } from "../constants.js";
import { appendAuditEvent } from "../audit/writer.js";
import { notifyPolicyDenied } from "../policy/runtime-state.js";
import { getSharedVineStateManager } from "../vine/runtime-state.js";
import { getSharedVineConfirmStateManager } from "../vine/confirm-state.js";
import { getSharedVineSessionBindingManager } from "../vine/session-binding.js";
import {
    createVineIntentFromOperationTarget,
    hasIntrinsicExternalHostActionRisk,
} from "../vine/authorization-intent.js";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { BerryShieldPluginConfig } from "../types/config.js";
import { VINE_CONFIRMATION_STRATEGY } from "../constants.js";
import { formatCardForToolResult } from "../ui/decision-card/format-text.js";
import {
    getAllDestructiveCommandPatterns,
    getAllSensitiveFilePatterns,
} from "../patterns/index.js";
import { BERRY_LOG_CATEGORY, berryLog } from "../log/berry-log.js";

type OperationType = "exec" | "read" | "write";
const DEGRADED_VINE_SESSION_KEY = "degraded:confirm-required";

/** Parameters accepted by the `berry_check` tool. */
interface BerryCheckParams {
    /** Operation to validate against policy. */
    operation: OperationType;
    /** Command or file target under evaluation. */
    target: string;
    /** Optional session binding key used by adaptive/Vine state. */
    sessionKey?: string;
    /** Optional runtime run identifier injected from tool-call context. */
    runId?: string;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    if (typeof value !== "object" || value === null) {
        return undefined;
    }
    return value as Record<string, unknown>;
}

function readOptionalContextString(ctx: unknown, field: string): string | undefined {
    const record = asRecord(ctx);
    if (!record) {
        return undefined;
    }
    const value = record[field];
    return typeof value === "string" && value.trim() ? value : undefined;
}

/** Runtime type guard for `berry_check` parameters. */
function isBerryCheckParams(params: unknown): params is BerryCheckParams {
    if (typeof params !== "object" || params === null) {
        return false;
    }
    const maybe = params as { operation?: unknown; target?: unknown };
    return (
        (maybe.operation === "exec" || maybe.operation === "read" || maybe.operation === "write")
        && typeof maybe.target === "string"
        && (typeof (params as { sessionKey?: unknown }).sessionKey === "string"
            || (params as { sessionKey?: unknown }).sessionKey === undefined)
        && (typeof (params as { runId?: unknown }).runId === "string"
            || (params as { runId?: unknown }).runId === undefined)
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
        berryLog(api.logger, BERRY_LOG_CATEGORY.COMPAT_EVENT, "Berry.Stem: sessionKey missing, applying configured global adaptive escalation");
        notifyPolicyDenied(undefined, escalationTurns, true);
        return;
    }
    berryLog(api.logger, BERRY_LOG_CATEGORY.COMPAT_EVENT, "Berry.Stem: sessionKey missing, skipping adaptive escalation");
}

/** Checks if a command matches destructive command patterns. */
function isDestructiveCommand(command: string, customPatterns: string[]): boolean {
    for (const pattern of getAllDestructiveCommandPatterns()) {
        if (pattern.test(command)) {
            return true;
        }
    }
    for (const patternStr of customPatterns) {
        try {
            const pattern = new RegExp(patternStr, "i");
            if (pattern.test(command)) {
                return true;
            }
        } catch {
            // ignore invalid regex
        }
    }
    return false;
}

/** Checks if a path/command references sensitive file patterns. */
function isSensitiveFile(filePath: string, customPatterns: string[]): boolean {
    const normalizedPath = filePath.replace(/\\/g, "/");
    for (const pattern of getAllSensitiveFilePatterns()) {
        if (pattern.test(normalizedPath)) {
            return true;
        }
    }
    for (const patternStr of customPatterns) {
        try {
            const pattern = new RegExp(patternStr, "i");
            if (pattern.test(normalizedPath)) {
                return true;
            }
        } catch {
            // ignore invalid regex
        }
    }
    return false;
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

function buildNativeConfirmAction(
    confirmCode: string,
    confirmation: BerryShieldPluginConfig["vine"]["confirmation"]
): string {
    const strategyLine = confirmation.strategy === VINE_CONFIRMATION_STRATEGY.ONE_TO_MANY
        ? `This opens a short confirmation window for the next compatible sensitive actions (up to ${confirmation.maxActionsPerWindow} actions within ${confirmation.windowSeconds} seconds).`
        : "This will allow the pending action once.";
    return [
        "External untrusted content risk (Vine).",
        `Reply with a message containing this 4-digit code: ${confirmCode}`,
        strategyLine,
        "WARNING: STOP EXECUTION IMMEDIATELY. You MUST WAIT for the user to reply to this challenge before checking other actions or executing any tools.",
    ].join("\n");
}

function resolveBerryCheckRunId(runId: string | undefined): string {
    const normalized = typeof runId === "string" ? runId.trim() : "";
    if (normalized) {
        return normalized;
    }
    return `berry_check_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function emitVineTrace(
    api: OpenClawPluginApi,
    stage: string,
    payload: Record<string, unknown>
): void {
    berryLog(api.logger, BERRY_LOG_CATEGORY.LAYER_TRACE, `Berry.Vine ${stage} ${JSON.stringify(payload)}`);
}

/**
 * Applies the Vine confirmation gate for `berry_check`.
 *
 * This is the bridge between runtime risk state and the confirmation state machine:
 * - it resolves which session should carry the risk for the current action
 * - it consumes a previously approved challenge or active one-to-many window when possible
 * - it issues a new `CONFIRM_REQUIRED` challenge when the action still needs an explicit pause
 *
 * Degraded identity still uses the normal confirmation protocol. The flow prefers exact runtime
 * correlation, but it can fall back to the single plausible risky session/window exposed by the
 * Vine managers. Ambiguous matches stay blocked.
 */
function maybeApplyVineConfirmRequired(
    api: OpenClawPluginApi,
    config: BerryShieldPluginConfig,
    operation: OperationType,
    target: string,
    sessionKey?: string,
    runId?: string
): {
    requiresConfirmation: boolean;
    challenge?: {
        confirmId: string;
        confirmCode: string;
        ttlSeconds: number;
        maxAttempts: number;
    };
    deniedReason?: string;
    confirmationAccepted?: boolean;
    allowedByWindow?: boolean;
    resumeToken?: string;
} {
    if (!config.layers.vine || (operation !== "exec" && operation !== "write")) {
        return { requiresConfirmation: false };
    }
    const operationForIntent = operation === "write" ? "write" : "exec";
    const intent = createVineIntentFromOperationTarget(operationForIntent, target);
    // Same-command fetch-and-act flows must not bypass confirmation just because no prior session risk exists yet.
    const hasIntrinsicExecRisk = operationForIntent === "exec"
        && hasIntrinsicExternalHostActionRisk(intent);
    const vineState = getSharedVineStateManager(config.vine.retention);
    const resolvedRiskState = vineState.resolveRiskState(sessionKey);
    const effectiveSessionKey = resolvedRiskState?.sessionKey ?? sessionKey;
    const hasGuardRisk = resolvedRiskState?.hasGuardRisk ?? false;
    const hasUnknownSignal = resolvedRiskState?.hasUnknownSignal ?? false;
    const requiresConfirmation = hasIntrinsicExecRisk || (config.vine.mode === "strict"
        ? (hasGuardRisk || hasUnknownSignal)
        : hasGuardRisk);
    const requiresDegradedConfirmation = requiresConfirmation || operationForIntent === "write";

    if (!effectiveSessionKey && !requiresDegradedConfirmation) {
        return { requiresConfirmation: false };
    }

    if (config.mode === "audit") {
        const event: AuditBlockEvent = {
            mode: "audit",
            decision: AUDIT_DECISIONS.WOULD_CONFIRM_REQUIRED,
            layer: SECURITY_LAYERS.VINE,
            reason: !effectiveSessionKey
                ? "external-untrusted instruction risk (binding degraded)"
                : "external-untrusted instruction risk (confirm required)",
            target: target.slice(0, 120),
            ts: new Date().toISOString(),
        };
        berryLog(api.logger, BERRY_LOG_CATEGORY.SECURITY_EVENT, `Berry.Vine: ${formatAuditEvent(event)}`);
        appendAuditEvent(event);
        return { requiresConfirmation: false };
    }

    const confirmState = getSharedVineConfirmStateManager(config.vine.retention, config.vine.confirmation);
    const stateSessionKey = effectiveSessionKey ?? DEGRADED_VINE_SESSION_KEY;
    const riskWindowId = resolvedRiskState?.riskWindowId
        ?? (effectiveSessionKey ? vineState.getRiskWindowId(effectiveSessionKey) : undefined)
        ?? "risk-window-default";
    const normalizedRunId = resolveBerryCheckRunId(runId);
    const pendingChallenge = confirmState.getPendingChallengeForSession(stateSessionKey);
    const activeWindow = confirmState.getActiveWindowSnapshot({ sessionKey: stateSessionKey, riskWindowId });
    emitVineTrace(api, "gate-entry", {
        requestedSessionKey: sessionKey ?? null,
        effectiveSessionKey: effectiveSessionKey ?? null,
        stateSessionKey,
        operation: operationForIntent,
        target,
        runId: normalizedRunId,
        riskWindowId,
        pendingConfirmId: pendingChallenge?.confirmId ?? null,
        pendingStatus: pendingChallenge?.status ?? null,
        pendingTarget: pendingChallenge?.target ?? null,
        activeWindowRemainingActions: activeWindow?.remainingActions ?? null,
        hasIntrinsicExecRisk,
        hasGuardRisk,
        hasUnknownSignal,
        usedRiskFallback: resolvedRiskState?.sessionKey !== undefined && resolvedRiskState.sessionKey !== sessionKey,
    });
    if (normalizedRunId) {
        const approved = confirmState.consumeApprovedForBinding({
            sessionKey: stateSessionKey,
            operation: operationForIntent,
            target,
            runId: normalizedRunId,
            intent,
            rawTarget: target,
        });
        if (approved.kind === "allowed") {
            if (approved.resumeToken) {
                // Bridge berry_check approval to the next real tool call even when runtime run ids diverge.
                confirmState.grantToolExecutionAllowance({
                    sessionKey: stateSessionKey,
                    operation: operationForIntent,
                    target,
                    resumeToken: approved.resumeToken,
                    intent,
                    rawTarget: target,
                });
            }
            if (config.vine.confirmation.strategy === VINE_CONFIRMATION_STRATEGY.ONE_TO_MANY) {
                confirmState.openWindowAfterConfirmation({
                    sessionKey: stateSessionKey,
                    riskWindowId,
                    windowSeconds: config.vine.confirmation.windowSeconds,
                    maxActionsPerWindow: config.vine.confirmation.maxActionsPerWindow,
                });
            }
            emitVineTrace(api, "gate-approved", {
                requestedSessionKey: sessionKey ?? null,
                effectiveSessionKey: effectiveSessionKey ?? null,
                stateSessionKey,
                operation: operationForIntent,
                target,
                runId: normalizedRunId,
                riskWindowId,
                resumeToken: approved.resumeToken ?? null,
                matchedByIntent: approved.matchedByIntent ?? false,
            });
            return {
                requiresConfirmation: false,
                confirmationAccepted: true,
                resumeToken: approved.resumeToken,
            };
        }
    }

    if (config.vine.confirmation.strategy === VINE_CONFIRMATION_STRATEGY.ONE_TO_MANY) {
        const consumedWindow = confirmState.consumeActiveWindowSlot({
            sessionKey: stateSessionKey,
            riskWindowId,
            allowGlobalFallback: effectiveSessionKey !== sessionKey,
        });
        if (consumedWindow) {
            const resumeToken = `vwin_${normalizedRunId}`;
            if (normalizedRunId) {
                confirmState.grantExecutionAllowance({
                    sessionKey: stateSessionKey,
                    runId: normalizedRunId,
                    operation: operationForIntent,
                    target,
                    resumeToken,
                    intent,
                    rawTarget: target,
                });
            }
            confirmState.grantToolExecutionAllowance({
                sessionKey: stateSessionKey,
                operation: operationForIntent,
                target,
                resumeToken,
                intent,
                rawTarget: target,
            });
            emitVineTrace(api, "gate-window-allow", {
                requestedSessionKey: sessionKey ?? null,
                effectiveSessionKey: effectiveSessionKey ?? null,
                stateSessionKey,
                operation: operationForIntent,
                target,
                runId: normalizedRunId,
                riskWindowId,
                resumeToken,
            });
            return { requiresConfirmation: false, confirmationAccepted: true, allowedByWindow: true };
        }
        emitVineTrace(api, "gate-window-miss", {
            requestedSessionKey: sessionKey ?? null,
            effectiveSessionKey: effectiveSessionKey ?? null,
            stateSessionKey,
            operation: operationForIntent,
            target,
            runId: normalizedRunId,
            riskWindowId,
        });
    }

    const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
    const binding = effectiveSessionKey
        ? sessionBindings.getBindingForSession(effectiveSessionKey)
        : null;
    const challenge = confirmState.issueChallenge({
        sessionKey: stateSessionKey,
        chatBindingKey: binding?.chatBindingKey,
        operation: operationForIntent,
        target,
        intent,
        rawTarget: target,
        riskWindowId,
    });
    emitVineTrace(api, "gate-challenge-issued", {
        requestedSessionKey: sessionKey ?? null,
        effectiveSessionKey: effectiveSessionKey ?? null,
        stateSessionKey,
        operation: operationForIntent,
        target,
        runId: normalizedRunId,
        riskWindowId,
        chatBindingKey: binding?.chatBindingKey ?? null,
        previousPendingConfirmId: pendingChallenge?.confirmId ?? null,
        previousPendingStatus: pendingChallenge?.status ?? null,
        issuedConfirmId: challenge.confirmId,
        reusedPendingChallenge: pendingChallenge?.confirmId === challenge.confirmId,
    });
    emitVineConfirmEvent(
        config,
        AUDIT_DECISIONS.CONFIRM_REQUIRED,
        target,
        effectiveSessionKey
            ? "external-untrusted instruction risk"
            : "external-untrusted instruction risk (binding degraded)"
    );
    return { requiresConfirmation: true, challenge };
}

/**
 * Registers Berry.Stem tool and hook wiring.
 *
 * - Auto-injects `sessionKey`/`runId` into `berry_check` params from runtime context.
 * - Enforces destructive/sensitive checks and emits decision-card responses.
 * - Bridges Vine confirm-required state when external-risk sensitive actions are requested.
 *
 * Stem is the policy entrypoint for `berry_check`: it normalizes runtime identity, applies static
 * policy decisions, and then hands exec/write actions to Vine so approval state can survive host
 * drift between chat surfaces and real tool execution.
 */
export function registerBerryStem(
    api: OpenClawPluginApi,
    config: BerryShieldPluginConfig
): void {
    if (!config.layers.stem) {
        berryLog(api.logger, BERRY_LOG_CATEGORY.RUNTIME_EVENT, "Berry.Stem layer disabled");
        return;
    }

    api.on(
        HOOKS.BEFORE_TOOL_CALL,
        (event, ctx) => {
            if (event.toolName !== "berry_check") {
                return undefined;
            }
            const rawRuntimeSessionKey = typeof ctx.sessionKey === "string" ? ctx.sessionKey.trim() : "";
            const runtimeRunId = typeof ctx.runId === "string" ? ctx.runId.trim() : "";
            const runtimeSessionId = readOptionalContextString(ctx, "sessionId");
            const runtimeConversationId = readOptionalContextString(ctx, "conversationId");
            const runtimeChannelId = readOptionalContextString(ctx, "channelId");
            const runtimeAccountId = readOptionalContextString(ctx, "accountId");
            const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
            /**
             * Berry tries to preserve a stable session identity for `berry_check` even when the host
             * omits `sessionKey` from the hook context. This lets later confirmation replies and tool
             * handoffs correlate back to the same runtime session whenever a single plausible identity
             * can be reconstructed from session ids or chat bindings.
             */
            const resolvedRuntimeSessionKey = (() => {
                if (rawRuntimeSessionKey) {
                    return rawRuntimeSessionKey;
                }
                const resolvedFromIdentity = sessionBindings.resolveSessionKey({
                    sessionKey: undefined,
                    sessionId: runtimeSessionId,
                    conversationId: runtimeConversationId,
                });
                if (resolvedFromIdentity !== "global_session") {
                    return resolvedFromIdentity;
                }
                const resolvedFromBinding = sessionBindings.resolveSessionKeyByChatBinding({
                    channelId: runtimeChannelId,
                    accountId: runtimeAccountId,
                    conversationId: runtimeConversationId,
                });
                return resolvedFromBinding ?? "";
            })();
            if (resolvedRuntimeSessionKey) {
                // Warm the chat/session binding so a later human reply can resolve back to this runtime session.
                sessionBindings.bindKnownSession({
                    sessionKey: resolvedRuntimeSessionKey,
                    sessionId: runtimeSessionId,
                    conversationId: runtimeConversationId,
                    channelId: runtimeChannelId,
                    accountId: runtimeAccountId,
                }, resolvedRuntimeSessionKey);
            }
            const nextParams = { ...event.params };
            let mutated = false;

            const existingSessionKey = typeof nextParams.sessionKey === "string" ? nextParams.sessionKey.trim() : "";
            if (!existingSessionKey && resolvedRuntimeSessionKey) {
                nextParams.sessionKey = resolvedRuntimeSessionKey;
                mutated = true;
            }

            const existingRunId = typeof nextParams.runId === "string" ? nextParams.runId.trim() : "";
            if (!existingRunId && runtimeRunId) {
                nextParams.runId = runtimeRunId;
                mutated = true;
            }

            if (!mutated) {
                return undefined;
            }
            return { params: nextParams };
        },
        { priority: 220 }
    );

    api.registerTool({
        name: "berry_check",
        label: "Security Gate (Exec/Read Check)",
        description: "Security gate - call BEFORE exec or file read to verify permission",
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
                runId: {
                    type: "string",
                    description: "Internal runtime run id injected by Berry Shield",
                },
            },
            required: ["operation", "target"],
        },

        async execute(_id: string, rawParams: Record<string, unknown>) {
            if (!isBerryCheckParams(rawParams)) {
                throw new Error("Invalid parameters for berry_check");
            }
            const { operation, target, sessionKey } = rawParams;
            // Manual berry_check calls still need a stable consumption path for approved Vine challenges.
            const runId = resolveBerryCheckRunId(rawParams.runId);

            if (operation === "exec") {
                if (isDestructiveCommand(target, config.destructiveCommands)) {
                    if (config.mode === "audit") {
                        const event: AuditBlockEvent = {
                            mode: "audit",
                            decision: AUDIT_DECISIONS.WOULD_BLOCK,
                            layer: SECURITY_LAYERS.STEM,
                            reason: "destructive command",
                            target: target.substring(0, 100),
                            ts: new Date().toISOString(),
                        };
                        berryLog(api.logger, BERRY_LOG_CATEGORY.SECURITY_EVENT, `Berry.Stem: ${formatAuditEvent(event)}`);
                        appendAuditEvent(event);
                    } else {
                        appendAuditEvent({
                            mode: "enforce",
                            decision: AUDIT_DECISIONS.BLOCKED,
                            layer: SECURITY_LAYERS.STEM,
                            reason: "destructive command",
                            target: target.substring(0, 100),
                            ts: new Date().toISOString(),
                        });
                        maybeEscalateFromStem(
                            api,
                            sessionKey,
                            config.policy.adaptive.escalationTurns,
                            config.policy.adaptive.allowGlobalEscalation
                        );
                        return {
                            content: [{
                                type: "text",
                                text: formatCardForToolResult({
                                    status: "DENIED",
                                    layer: "Stem",
                                    operation: "exec",
                                    target,
                                    reason: "Destructive command detected",
                                    action: "Do NOT execute this command. Suggest a safer alternative to the user.",
                                }),
                            }],
                            details: { status: "denied", reason: "destructive command" },
                        };
                    }
                }

                if (isSensitiveFile(target, config.sensitiveFilePaths)) {
                    if (config.mode === "audit") {
                        const event: AuditBlockEvent = {
                            mode: "audit",
                            decision: AUDIT_DECISIONS.WOULD_BLOCK,
                            layer: SECURITY_LAYERS.STEM,
                            reason: "sensitive file reference",
                            target: target.substring(0, 100),
                            ts: new Date().toISOString(),
                        };
                        berryLog(api.logger, BERRY_LOG_CATEGORY.SECURITY_EVENT, `Berry.Stem: ${formatAuditEvent(event)}`);
                        appendAuditEvent(event);
                    } else {
                        appendAuditEvent({
                            mode: "enforce",
                            decision: AUDIT_DECISIONS.BLOCKED,
                            layer: SECURITY_LAYERS.STEM,
                            reason: "sensitive file reference",
                            target: target.substring(0, 100),
                            ts: new Date().toISOString(),
                        });
                        maybeEscalateFromStem(
                            api,
                            sessionKey,
                            config.policy.adaptive.escalationTurns,
                            config.policy.adaptive.allowGlobalEscalation
                        );
                        return {
                            content: [{
                                type: "text",
                                text: formatCardForToolResult({
                                    status: "DENIED",
                                    layer: "Stem",
                                    operation: "exec",
                                    target,
                                    reason: "Sensitive file reference",
                                    action: "Do NOT read this file. Inform the user it is blocked by security policy.",
                                }),
                            }],
                            details: { status: "denied", reason: "sensitive file reference" },
                        };
                    }
                }

                const vineConfirm = maybeApplyVineConfirmRequired(
                    api,
                    config,
                    operation,
                    target,
                    sessionKey,
                    runId
                );
                if (vineConfirm.deniedReason) {
                    return {
                        content: [{
                            type: "text",
                            text: formatCardForToolResult({
                                status: "DENIED",
                                layer: "Stem",
                                reason: vineConfirm.deniedReason,
                                action: "The confirmation challenge is no longer valid. Start a new confirmation flow by calling berry_check again.",
                            }),
                        }],
                        details: { status: "denied", reason: vineConfirm.deniedReason },
                    };
                }
                if (vineConfirm.confirmationAccepted) {
                    emitVineConfirmEvent(
                        config,
                        AUDIT_DECISIONS.ALLOWED_BY_CONFIRM,
                        target,
                        vineConfirm.allowedByWindow
                            ? "allowed by active confirmation window"
                            : "allowed after explicit confirmation"
                    );
                }
                if (vineConfirm.requiresConfirmation && vineConfirm.challenge) {
                    return {
                        content: [{
                            type: "text",
                            text: formatCardForToolResult({
                                status: "CONFIRM_REQUIRED",
                                layer: "Vine",
                                operation,
                                target,
                                reason: "External untrusted content risk (Vine)",
                                action: buildNativeConfirmAction(vineConfirm.challenge.confirmCode, config.vine.confirmation),
                                confirm: {
                                    confirmCode: vineConfirm.challenge.confirmCode,
                                    ttlSeconds: vineConfirm.challenge.ttlSeconds,
                                    maxAttempts: vineConfirm.challenge.maxAttempts,
                                    strategyLabel: config.vine.confirmation.strategy === VINE_CONFIRMATION_STRATEGY.ONE_TO_MANY
                                        ? VINE_CONFIRMATION_STRATEGY_LABEL.ONE_TO_MANY
                                        : VINE_CONFIRMATION_STRATEGY_LABEL.ONE_TO_ONE,
                                    windowSeconds: config.vine.confirmation.strategy === VINE_CONFIRMATION_STRATEGY.ONE_TO_MANY
                                        ? config.vine.confirmation.windowSeconds
                                        : undefined,
                                    maxActionsPerWindow: config.vine.confirmation.strategy === VINE_CONFIRMATION_STRATEGY.ONE_TO_MANY
                                        ? config.vine.confirmation.maxActionsPerWindow
                                        : undefined,
                                },
                            }),
                        }],
                        details: {
                            status: "confirm_required",
                            reason: "external untrusted content risk (vine)",
                            confirmCode: vineConfirm.challenge.confirmCode,
                            ttlSeconds: vineConfirm.challenge.ttlSeconds,
                            maxAttempts: vineConfirm.challenge.maxAttempts,
                            confirmationStrategy: config.vine.confirmation.strategy,
                            confirmationStrategyLabel: config.vine.confirmation.strategy === VINE_CONFIRMATION_STRATEGY.ONE_TO_MANY
                                ? VINE_CONFIRMATION_STRATEGY_LABEL.ONE_TO_MANY
                                : VINE_CONFIRMATION_STRATEGY_LABEL.ONE_TO_ONE,
                            windowSeconds: config.vine.confirmation.strategy === VINE_CONFIRMATION_STRATEGY.ONE_TO_MANY
                                ? config.vine.confirmation.windowSeconds
                                : undefined,
                            maxActionsPerWindow: config.vine.confirmation.strategy === VINE_CONFIRMATION_STRATEGY.ONE_TO_MANY
                                ? config.vine.confirmation.maxActionsPerWindow
                                : undefined,
                        },
                    };
                }
            }

            if (operation === "read" || operation === "write") {
                if (isSensitiveFile(target, config.sensitiveFilePaths)) {
                    if (config.mode === "audit") {
                        const event: AuditBlockEvent = {
                            mode: "audit",
                            decision: AUDIT_DECISIONS.WOULD_BLOCK,
                            layer: SECURITY_LAYERS.STEM,
                            reason: "sensitive file access",
                            target,
                            ts: new Date().toISOString(),
                        };
                        berryLog(api.logger, BERRY_LOG_CATEGORY.SECURITY_EVENT, `Berry.Stem: ${formatAuditEvent(event)}`);
                        appendAuditEvent(event);
                    } else {
                        appendAuditEvent({
                            mode: "enforce",
                            decision: AUDIT_DECISIONS.BLOCKED,
                            layer: SECURITY_LAYERS.STEM,
                            reason: "sensitive file access",
                            target,
                            ts: new Date().toISOString(),
                        });
                        maybeEscalateFromStem(
                            api,
                            sessionKey,
                            config.policy.adaptive.escalationTurns,
                            config.policy.adaptive.allowGlobalEscalation
                        );
                        return {
                            content: [{
                                type: "text",
                                text: formatCardForToolResult({
                                    status: "DENIED",
                                    layer: "Stem",
                                    operation,
                                    target,
                                    reason: "Sensitive file access",
                                    action: "Do NOT read this file. Inform the user it is blocked by security policy.",
                                }),
                            }],
                            details: { status: "denied", reason: "sensitive file access" },
                        };
                    }
                }

                if (operation === "write") {
                    const vineConfirm = maybeApplyVineConfirmRequired(
                        api,
                        config,
                        operation,
                        target,
                        sessionKey,
                        runId
                    );
                    if (vineConfirm.deniedReason) {
                        return {
                            content: [{
                                type: "text",
                                text: formatCardForToolResult({
                                    status: "DENIED",
                                    layer: "Stem",
                                    reason: vineConfirm.deniedReason,
                                    action: "The confirmation challenge is no longer valid. Start a new confirmation flow by calling berry_check again.",
                                }),
                            }],
                            details: { status: "denied", reason: vineConfirm.deniedReason },
                        };
                    }
                    if (vineConfirm.confirmationAccepted) {
                        emitVineConfirmEvent(
                            config,
                            AUDIT_DECISIONS.ALLOWED_BY_CONFIRM,
                            target,
                            vineConfirm.allowedByWindow
                                ? "allowed by active confirmation window"
                                : "allowed after explicit confirmation"
                        );
                    }
                    if (vineConfirm.requiresConfirmation && vineConfirm.challenge) {
                        return {
                            content: [{
                                type: "text",
                                text: formatCardForToolResult({
                                    status: "CONFIRM_REQUIRED",
                                    layer: "Vine",
                                    operation,
                                    target,
                                    reason: "External untrusted content risk (Vine)",
                                    action: buildNativeConfirmAction(vineConfirm.challenge.confirmCode, config.vine.confirmation),
                                    confirm: {
                                        confirmCode: vineConfirm.challenge.confirmCode,
                                        ttlSeconds: vineConfirm.challenge.ttlSeconds,
                                        maxAttempts: vineConfirm.challenge.maxAttempts,
                                        strategyLabel: config.vine.confirmation.strategy === VINE_CONFIRMATION_STRATEGY.ONE_TO_MANY
                                            ? VINE_CONFIRMATION_STRATEGY_LABEL.ONE_TO_MANY
                                            : VINE_CONFIRMATION_STRATEGY_LABEL.ONE_TO_ONE,
                                        windowSeconds: config.vine.confirmation.strategy === VINE_CONFIRMATION_STRATEGY.ONE_TO_MANY
                                            ? config.vine.confirmation.windowSeconds
                                            : undefined,
                                        maxActionsPerWindow: config.vine.confirmation.strategy === VINE_CONFIRMATION_STRATEGY.ONE_TO_MANY
                                            ? config.vine.confirmation.maxActionsPerWindow
                                            : undefined,
                                    },
                                }),
                            }],
                            details: {
                                status: "confirm_required",
                                reason: "external untrusted content risk (vine)",
                                confirmCode: vineConfirm.challenge.confirmCode,
                                ttlSeconds: vineConfirm.challenge.ttlSeconds,
                                maxAttempts: vineConfirm.challenge.maxAttempts,
                                confirmationStrategy: config.vine.confirmation.strategy,
                                confirmationStrategyLabel: config.vine.confirmation.strategy === VINE_CONFIRMATION_STRATEGY.ONE_TO_MANY
                                    ? VINE_CONFIRMATION_STRATEGY_LABEL.ONE_TO_MANY
                                    : VINE_CONFIRMATION_STRATEGY_LABEL.ONE_TO_ONE,
                                windowSeconds: config.vine.confirmation.strategy === VINE_CONFIRMATION_STRATEGY.ONE_TO_MANY
                                    ? config.vine.confirmation.windowSeconds
                                    : undefined,
                                maxActionsPerWindow: config.vine.confirmation.strategy === VINE_CONFIRMATION_STRATEGY.ONE_TO_MANY
                                    ? config.vine.confirmation.maxActionsPerWindow
                                    : undefined,
                            },
                        };
                    }
                }
            }

            return {
                content: [{
                    type: "text",
                    text: formatCardForToolResult({
                        status: "ALLOWED",
                        layer: "Stem",
                        operation,
                        target,
                    }),
                }],
                details: { status: "allowed" },
            };
        },
    });

    berryLog(api.logger, BERRY_LOG_CATEGORY.LAYER_TRACE, "Berry.Stem layer registered (Security Gate)");
}
