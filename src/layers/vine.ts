import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { BerryShieldPluginConfig } from "../types/config.js";
import type { AuditBlockEvent } from "../types/audit-event.js";
import { appendAuditEvent } from "../audit/writer.js";
import { AUDIT_DECISIONS, HOOKS, SECURITY_LAYERS, VINE_CONFIRMATION } from "../constants.js";
import { formatCardForBlockReason } from "../ui/decision-card/format-text.js";
import { formatAuditEvent } from "../types/audit-event.js";
import { getSharedVineStateManager } from "../vine/runtime-state.js";
import { getSharedVineConfirmStateManager } from "../vine/confirm-state.js";
import { buildChatBindingKey, getSharedVineSessionBindingManager } from "../vine/session-binding.js";
import {
    extractVineIntent,
    hasIntrinsicExternalHostActionRisk,
    inferVineOperationFromToolName,
    resolveAuthorizationTargetFromToolCall,
    resolveDisplayTargetFromToolCall,
    resolveWriteLikeTargetFromToolCall,
} from "../vine/authorization-intent.js";
import { findMatches } from "../utils/redaction.js";
import {
    getAllDestructiveCommandPatterns,
    getAllSensitiveFilePatterns,
} from "../patterns/index.js";
import { BERRY_LOG_CATEGORY, berryLog } from "../log/berry-log.js";
import { formatPolicyCard, POLICY_CARD_KIND } from "../ui/policy-card/index.js";
const EXTERNAL_TOOL_HINTS = [
    "browser",
    "web",
    "http",
    "fetch",
    "url",
    "crawl",
    "scrape",
    "search",
];

interface SessionResolutionInput {
    sessionKey?: string;
    sessionId?: string;
    conversationId?: string;
}

function normalizeName(value: string): string {
    return value.trim().toLowerCase();
}

function readOptionalString(record: Record<string, unknown>, field: string): string | undefined {
    const value = record[field];
    return typeof value === "string" && value.trim() ? value : undefined;
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
    return readOptionalString(record, field);
}

function readOptionalMetadataString(metadata: unknown, field: string): string | undefined {
    const record = asRecord(metadata);
    if (!record) {
        return undefined;
    }
    return readOptionalString(record, field);
}

function looksExternalTool(toolName: string): boolean {
    const normalized = normalizeName(toolName);
    return EXTERNAL_TOOL_HINTS.some((hint) => normalized.includes(hint));
}

function isAllowlistedTool(toolName: string, allowlist: string[]): boolean {
    if (allowlist.length === 0) return false;
    const normalized = normalizeName(toolName);
    return allowlist.some((entry) => normalized === normalizeName(entry));
}

function isDestructiveCommand(command: string): boolean {
    const patterns = getAllDestructiveCommandPatterns();
    return findMatches(command, patterns).length > 0;
}

function isSensitiveFile(value: string): boolean {
    const normalizedPath = value.replace(/\\/g, "/");
    const patterns = getAllSensitiveFilePatterns();
    return findMatches(normalizedPath, patterns).length > 0;
}

function isSensitiveAction(toolName: string, params: Record<string, unknown>): { sensitive: boolean; target: string } {
    const authorizationTarget = resolveAuthorizationTargetFromToolCall(toolName, params);
    const operation = inferVineOperationFromToolName(toolName);
    const intent = extractVineIntent(toolName, params, operation);

    if (operation === "exec") {
        if (
            intent.capabilities.includes("external_read")
            || intent.capabilities.includes("sensitive_write")
            || intent.capabilities.includes("external_send")
            || intent.capabilities.includes("destructive_exec")
        ) {
            return { sensitive: true, target: authorizationTarget };
        }

        const writeLikeTarget = resolveWriteLikeTargetFromToolCall(toolName, params);
        if (
            (writeLikeTarget && intent.localEffect.targetSensitivity === "sensitive")
            || isDestructiveCommand(authorizationTarget)
            || isSensitiveFile(authorizationTarget)
        ) {
            return { sensitive: true, target: authorizationTarget };
        }
    } else if (operation === "write") {
        // External-risk writes must not bypass Vine confirmation just because the path is non-sensitive.
        return { sensitive: true, target: authorizationTarget };
    } else if (isSensitiveFile(authorizationTarget)) {
        return { sensitive: true, target: authorizationTarget };
    }

    return { sensitive: false, target: toolName };
}

function resolveSessionKey(input: SessionResolutionInput): string {
    return input.sessionKey ?? input.sessionId ?? input.conversationId ?? "global_session";
}

function isSyntheticBerrySystemSender(value: string | undefined): boolean {
    return typeof value === "string" && value.trim().toLowerCase().startsWith("berry-shield:");
}

type ApprovalCodeParseResult =
    | { kind: "none" }
    | { kind: "single"; code: string }
    | { kind: "multiple"; codes: string[] };

function parseApprovalCodeMessage(content: string): ApprovalCodeParseResult {
    // Human replies may include surrounding text, but approval stays explicit by requiring exactly one isolated code.
    const pattern = new RegExp(`(?<!\\d)\\d{${VINE_CONFIRMATION.CODE_LENGTH}}(?!\\d)`, "g");
    const matches = content.match(pattern) ?? [];
    if (matches.length === 0) {
        return { kind: "none" };
    }
    if (matches.length === 1) {
        return { kind: "single", code: matches[0] };
    }
    return { kind: "multiple", codes: matches };
}

function emitVineTrace(
    api: OpenClawPluginApi,
    stage: string,
    payload: Record<string, unknown>
): void {
    berryLog(api.logger, BERRY_LOG_CATEGORY.LAYER_TRACE, `Berry.Vine ${stage} ${JSON.stringify(payload)}`);
}

function emitBlockEvent(
    api: OpenClawPluginApi,
    config: BerryShieldPluginConfig,
    reason: string,
    target: string
): void {
    const event: AuditBlockEvent = {
        mode: config.mode,
        decision: config.mode === "audit" ? AUDIT_DECISIONS.WOULD_BLOCK : AUDIT_DECISIONS.BLOCKED,
        layer: SECURITY_LAYERS.VINE,
        reason,
        target,
        ts: new Date().toISOString(),
    };
    if (config.mode === "audit") {
        berryLog(api.logger, BERRY_LOG_CATEGORY.SECURITY_EVENT, `Berry.Vine: ${formatAuditEvent(event)}`);
    }
    appendAuditEvent(event);
}

function resolveRuntimeGlobalMode(
    api: OpenClawPluginApi,
    fallback: BerryShieldPluginConfig["mode"]
): BerryShieldPluginConfig["mode"] {
    const apiRecord = asRecord(api);
    const runtimeConfig = apiRecord ? asRecord(apiRecord.pluginConfig) : undefined;
    const runtimeMode = runtimeConfig?.mode;
    return runtimeMode === "audit" || runtimeMode === "enforce"
        ? runtimeMode
        : fallback;
}

export function registerBerryVine(
    api: OpenClawPluginApi,
    config: BerryShieldPluginConfig
): void {
    if (!config.layers.vine) {
        berryLog(api.logger, BERRY_LOG_CATEGORY.RUNTIME_EVENT, "Berry.Vine layer disabled");
        return;
    }

    const vineState = getSharedVineStateManager(config.vine.retention);
    const vineConfirmState = getSharedVineConfirmStateManager(config.vine.retention, config.vine.confirmation);
    const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
    const requiredSafeTurns = Math.max(2, config.vine.thresholds.forcedGuardTurns);

    function resolveKnownSession(input: SessionResolutionInput): string {
        const resolved = sessionBindings.resolveSessionKey(input);
        return resolved || resolveSessionKey(input);
    }

    function maybeRelaxBalancedRisk(sessionKey: string): void {
        if (config.vine.mode !== "balanced") return;
        vineState.tryClearBalancedRisk(sessionKey, requiredSafeTurns);
    }

    api.on(
        HOOKS.MESSAGE_RECEIVED,
        (event, ctx) => {
            if (isSyntheticBerrySystemSender(event.from)) {
                return;
            }
            const resolutionInput: SessionResolutionInput = {
                sessionKey: readOptionalContextString(ctx, "sessionKey"),
                sessionId: readOptionalContextString(ctx, "sessionId"),
                conversationId: readOptionalContextString(ctx, "conversationId")
                    ?? readOptionalMetadataString(event.metadata, "originatingTo")
                    ?? readOptionalMetadataString(event.metadata, "to")
                    ?? (typeof ctx.conversationId === "string" && ctx.conversationId.trim()
                        ? ctx.conversationId
                        : undefined),
            };
            const inboundChannelId = readOptionalContextString(ctx, "channelId")
                ?? (typeof ctx.channelId === "string" && ctx.channelId.trim()
                    ? ctx.channelId
                    : undefined)
                ?? readOptionalMetadataString(event.metadata, "surface")
                ?? readOptionalMetadataString(event.metadata, "provider");
            const inboundAccountId = readOptionalContextString(ctx, "accountId")
                ?? (typeof ctx.accountId === "string" && ctx.accountId.trim()
                    ? ctx.accountId
                    : undefined);
            const inboundThreadId = readOptionalMetadataString(event.metadata, "threadId");
            const inboundFrom = event.from?.trim()
                || readOptionalMetadataString(event.metadata, "senderId")
                || undefined;
            const inboundTo = readOptionalMetadataString(event.metadata, "to")
                ?? readOptionalMetadataString(event.metadata, "originatingTo");
            const sessionKey = (() => {
                const resolvedSessionKey = resolveKnownSession(resolutionInput);
                if (resolvedSessionKey !== "global_session") {
                    return resolvedSessionKey;
                }
                // Sparse inbound hooks still need to map back to the live runtime session when chat metadata is all we have.
                return sessionBindings.resolveSessionKeyByChatBinding({
                    channelId: inboundChannelId,
                    accountId: inboundAccountId,
                    conversationId: resolutionInput.conversationId,
                    messageThreadId: inboundThreadId,
                    from: inboundFrom,
                    to: inboundTo,
                }) ?? resolvedSessionKey;
            })();
            const binding = sessionBindings.bindKnownSession({
                ...resolutionInput,
                channelId: inboundChannelId,
                accountId: inboundAccountId,
                messageThreadId: inboundThreadId,
                from: inboundFrom,
                to: inboundTo,
            }, sessionKey);
            const inboundChatBindingKey = inboundChannelId
                ? buildChatBindingKey({
                    channelId: inboundChannelId,
                    accountId: inboundAccountId,
                    conversationId: resolutionInput.conversationId,
                    messageThreadId: inboundThreadId,
                    from: inboundFrom,
                    to: inboundTo,
                })
                : null;

            const approvalInput = parseApprovalCodeMessage(event.content);
            const activeChallenge = vineConfirmState.getPendingChallengeForSession(sessionKey);
            let approvedOnCurrentTurn = false;
            emitVineTrace(api, "message-received", {
                sessionKey,
                chatBindingKey: binding?.chatBindingKey ?? inboundChatBindingKey,
                senderId: event.from ?? null,
                approvalInputKind: approvalInput.kind,
                pendingConfirmId: activeChallenge?.confirmId ?? null,
                pendingStatus: activeChallenge?.status ?? null,
            });

            if (activeChallenge && approvalInput.kind === "single" && (binding?.chatBindingKey || inboundChatBindingKey)) {
                const chatBindingKeys = [...new Set([
                    binding?.chatBindingKey,
                    inboundChatBindingKey ?? undefined,
                ].filter((value): value is string => Boolean(value)))];
                let approval = vineConfirmState.approvePendingByChatBindingKeys({
                    chatBindingKeys,
                    confirmCode: approvalInput.code,
                    senderId: event.from,
                });
                if (approval.kind === "not_found" && sessionKey !== "global_session") {
                    // Session-resolved approval must still work after chat binding promotion enriches the runtime context.
                    approval = vineConfirmState.approvePendingForSession({
                        sessionKey,
                        confirmCode: approvalInput.code,
                        senderId: event.from,
                    });
                }
                berryLog(
                    api.logger,
                    BERRY_LOG_CATEGORY.LAYER_TRACE,
                    `Berry.Vine normal-message-approval ${JSON.stringify({
                        sessionKey,
                        chatBindingKey: chatBindingKeys[0] ?? null,
                        authPath: "binding_1to1",
                        result: approval.kind,
                    })}`
                );
                emitVineTrace(api, "message-approval-result", {
                    sessionKey,
                    chatBindingKey: chatBindingKeys[0] ?? null,
                    result: approval.kind,
                    challengeConfirmId: approval.challenge?.confirmId ?? null,
                    challengeStatus: approval.challenge?.status ?? null,
                });

                if (approval.kind === "approved" || approval.kind === "already_approved") {
                    approvedOnCurrentTurn = true;
                }
            } else if (activeChallenge && approvalInput.kind === "multiple") {
                emitVineTrace(api, "message-approval-result", {
                    sessionKey,
                    chatBindingKey: binding?.chatBindingKey ?? null,
                    result: "multiple_candidates",
                    candidateCount: approvalInput.codes.length,
                });
            }

            if (/\bhttps?:\/\/\S+/i.test(event.content)) {
                vineState.markUnknownSignal(sessionKey);
            } else {
                vineState.markSafeHumanSignal(sessionKey);
                maybeRelaxBalancedRisk(sessionKey);
            }

            // Keep approved state alive for the accepted code turn, but purge stale approval on later human input.
            if (!approvedOnCurrentTurn) {
                vineConfirmState.clearApprovedChallenge(sessionKey);
            }
        },
        { priority: 190 }
    );

    api.on(
        HOOKS.AFTER_TOOL_CALL,
        (_event, ctx) => {
            const resolutionInput: SessionResolutionInput = {
                sessionKey: ctx.sessionKey,
                sessionId: readOptionalContextString(ctx, "sessionId"),
                conversationId: readOptionalContextString(ctx, "conversationId"),
            };

            const sessionKey = resolveKnownSession(resolutionInput);

            // Keep session bindings warm even when this hook lacks external-risk semantics.
            if (sessionKey === "global_session") {
                return;
            }
            sessionBindings.bindKnownSession(resolutionInput, sessionKey);
        },
        { priority: 190 }
    );

    api.on(
        HOOKS.TOOL_RESULT_PERSIST,
        (event, ctx) => {
            // Runtime source of truth for external-ingestion correlation in current OpenClaw.
            const sessionKey = resolveKnownSession({ sessionKey: ctx.sessionKey });
            if (sessionKey === "global_session") {
                return event;
            }

            const toolName = event.toolName ?? ctx.toolName;
            if (!toolName) {
                return event;
            }
            if (isAllowlistedTool(toolName, config.vine.toolAllowlist)) {
                return event;
            }
            if (!looksExternalTool(toolName)) {
                return event;
            }

            vineState.markExternalSignal({
                sessionKey,
                escalationThreshold: config.vine.thresholds.externalSignalsToEscalate,
                forcedGuardTurns: config.vine.thresholds.forcedGuardTurns,
                sourceToolCallId: toolName,
            });
            return event;
        },
        { priority: 190 }
    );

    api.on(
        HOOKS.BEFORE_AGENT_START,
        (_event, ctx) => {
            const resolutionInput: SessionResolutionInput = {
                sessionKey: ctx.sessionKey,
                sessionId: ctx.sessionId,
                conversationId: readOptionalContextString(ctx, "conversationId"),
            };
            const sessionKey = resolveKnownSession(resolutionInput);
            sessionBindings.bindKnownSession({
                ...resolutionInput,
                channelId: ctx.channelId,
            }, sessionKey);

            // Turn lifecycle tick for forced-guard counters and balanced relaxation.
            vineState.beginTurn(sessionKey);
            maybeRelaxBalancedRisk(sessionKey);
            if (!vineState.shouldInjectContext(sessionKey)) {
                return undefined;
            }
            // Approval replies must continue through the normal agent flow without repeated Berry guidance.
            return { prependContext: formatPolicyCard(POLICY_CARD_KIND.SESSION_EXTERNAL) };
        },
        { priority: 150 }
    );

    api.on(
        HOOKS.BEFORE_TOOL_CALL,
        (event, ctx) => {
            const resolutionInput: SessionResolutionInput = {
                sessionKey: ctx.sessionKey,
                sessionId: readOptionalContextString(ctx, "sessionId"),
                conversationId: readOptionalContextString(ctx, "conversationId"),
            };
            const sessionKey = resolveKnownSession(resolutionInput);
            sessionBindings.bindKnownSession({
                ...resolutionInput,
                channelId: readOptionalContextString(ctx, "channelId"),
            }, sessionKey);
            maybeRelaxBalancedRisk(sessionKey);

            // Read runtime mode at call time to avoid stale closure behavior after mode switches.
            const runtimeMode = resolveRuntimeGlobalMode(api, config.mode);

            if (isAllowlistedTool(event.toolName, config.vine.toolAllowlist)) {
                return undefined;
            }

            const sensitive = isSensitiveAction(event.toolName, event.params);
            if (!sensitive.sensitive) {
                return undefined;
            }

            const operation = inferVineOperationFromToolName(event.toolName);
            const allowanceTarget = resolveAuthorizationTargetFromToolCall(event.toolName, event.params, operation);
            const displayTarget = resolveDisplayTargetFromToolCall(event.toolName, event.params);
            const intent = extractVineIntent(event.toolName, event.params, operation);
            const vineOperation = operation === "write" ? "write" : "exec";
            // Same-command external fetch plus host-side execution must not rely on previously persisted session risk.
            const hasIntrinsicExecRisk = operation === "exec"
                && hasIntrinsicExternalHostActionRisk(intent);

            const allowedByExecutionAllowance = Boolean(
                ctx.runId
                && (operation === "exec" || operation === "write")
                && vineConfirmState.consumeExecutionAllowance({
                    sessionKey,
                    runId: ctx.runId,
                    operation: vineOperation,
                    target: allowanceTarget,
                    intent,
                })
            );
            if (allowedByExecutionAllowance) {
                emitVineTrace(api, "before-tool-call-allow", {
                    sessionKey,
                    toolName: event.toolName,
                    operation,
                    target: allowanceTarget,
                    runId: ctx.runId ?? null,
                    allowancePath: "execution_allowance",
                });
                return undefined;
            }
            const allowedByToolAllowance = Boolean(
                (operation === "exec" || operation === "write")
                && vineConfirmState.consumeToolExecutionAllowance({
                    sessionKey,
                    operation: vineOperation,
                    target: allowanceTarget,
                    intent,
                })
            );
            if (allowedByToolAllowance) {
                emitVineTrace(api, "before-tool-call-allow", {
                    sessionKey,
                    toolName: event.toolName,
                    operation,
                    target: allowanceTarget,
                    runId: ctx.runId ?? null,
                    allowancePath: "tool_execution_allowance",
                });
                return undefined;
            }

            const hasGuardRisk = vineState.shouldGuardSensitiveAction(sessionKey);
            const hasUnknownSignal = vineState.hasUnknownSignal(sessionKey);

            // Audit mode never blocks, but logs would_block.
            if (runtimeMode === "audit") {
                if (hasIntrinsicExecRisk || hasGuardRisk || hasUnknownSignal) {
                    emitBlockEvent(api, { ...config, mode: runtimeMode }, "external-untrusted instruction risk", displayTarget);
                }
                return undefined;
            }

            // Enforce strict: unknown and risk both block.
            if (hasIntrinsicExecRisk || (config.vine.mode === "strict" && (hasGuardRisk || hasUnknownSignal))) {
                emitVineTrace(api, "before-tool-call-block", {
                    sessionKey,
                    toolName: event.toolName,
                    operation,
                    target: allowanceTarget,
                    runId: ctx.runId ?? null,
                    hasIntrinsicExecRisk,
                    hasGuardRisk,
                    hasUnknownSignal,
                });
                emitBlockEvent(api, config, "external-untrusted instruction risk", displayTarget);
                // Record a blocked attempt so balanced mode does not clear risk prematurely.
                vineState.markSensitiveAttemptBlocked(sessionKey);
                vineState.consumeForcedGuardTurn(sessionKey);
                return {
                    block: true,
                    blockReason: formatCardForBlockReason({
                        status: "BLOCKED",
                        layer: "Vine",
                        operation,
                        target: displayTarget,
                        reason: "External content risk",
                    }),
                };
            }

            // Enforce balanced: block only when explicit external risk is active.
            if (hasGuardRisk) {
                emitVineTrace(api, "before-tool-call-block", {
                    sessionKey,
                    toolName: event.toolName,
                    operation,
                    target: allowanceTarget,
                    runId: ctx.runId ?? null,
                    hasIntrinsicExecRisk,
                    hasGuardRisk,
                    hasUnknownSignal,
                });
                emitBlockEvent(api, config, "external-untrusted instruction risk", displayTarget);
                // Record a blocked attempt so balanced mode does not clear risk prematurely.
                vineState.markSensitiveAttemptBlocked(sessionKey);
                vineState.consumeForcedGuardTurn(sessionKey);
                return {
                    block: true,
                    blockReason: formatCardForBlockReason({
                        status: "BLOCKED",
                        layer: "Vine",
                        operation,
                        target: displayTarget,
                        reason: "External content risk",
                    }),
                };
            }

            // Balanced + unknown: no hard block; rely on telemetry only.
            if (hasUnknownSignal) {
                emitBlockEvent(api, { ...config, mode: "audit" }, "unknown-origin sensitive attempt", displayTarget);
            }

            return undefined;
        },
        { priority: 190 }
    );

    api.on(
        HOOKS.SESSION_END,
        (event) => {
            const resolvedSessionKey = sessionBindings.resolveSessionKey({ sessionId: event.sessionId });
            if (resolvedSessionKey) {
                vineState.delete(resolvedSessionKey);
            }
            vineState.delete(event.sessionId);
            sessionBindings.cleanupSession(event.sessionId, resolvedSessionKey);
        },
        { priority: 190 }
    );

    berryLog(api.logger, BERRY_LOG_CATEGORY.RUNTIME_EVENT, "Berry.Vine layer registered (External Content Guard)");
}
