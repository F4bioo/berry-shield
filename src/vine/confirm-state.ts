import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { VINE_CONFIRMATION } from "../constants.js";
import { DEFAULT_CONFIG } from "../config/defaults.js";
import type { BerryShieldVineConfirmationConfig, BerryShieldVineRetentionConfig } from "../types/config.js";
import {
    createIntentSignature,
    isEquivalentApprovedIntent,
    type VineIntent,
} from "./vine-intent.js";

export type VineConfirmOperation = "exec" | "write";
export type VineConfirmStatus = "pending" | "approved" | "consumed" | "expired" | "superseded";

export interface VineConfirmBinding {
    sessionKey: string;
    chatBindingKey?: string;
    operation: VineConfirmOperation;
    target: string;
    intent?: VineIntent;
    rawTarget?: string;
    riskWindowId?: string;
}

export interface VineIssuedChallenge {
    confirmId: string;
    confirmCode: string;
    ttlSeconds: number;
    maxAttempts: number;
    attemptsRemaining?: number;
}

export interface VinePendingChallenge {
    confirmId: string;
    confirmCode: string;
    sessionKey: string;
    chatBindingKey: string;
    operation: VineConfirmOperation;
    intent: VineIntent;
    intentSignature: string;
    rawTarget: string;
    target: string;
    targetSignature: string;
    riskWindowId: string;
    createdAt: number;
    expiresAt: number;
    attempts: number;
    maxAttempts: number;
    status: VineConfirmStatus;
    approvedAt?: number;
    approvedBySenderId?: string;
    resumeToken?: string;
}

type VineChallengeState = VinePendingChallenge & {
    lastSeenAt: number;
    consumedAt?: number;
    supersededByConfirmId?: string;
};

type VineWindowState = {
    windowKey: string;
    sessionKey: string;
    riskWindowId: string;
    openedAt: number;
    expiresAt: number;
    lastSeenAt: number;
    remainingActions: number;
};

type VineExecutionAllowanceState = {
    sessionKey: string;
    runId: string;
    operation: VineConfirmOperation;
    intent: VineIntent;
    intentSignature: string;
    rawTarget: string;
    targetSignature: string;
    target: string;
    resumeToken: string;
    expiresAt: number;
    lastSeenAt: number;
};

type VineToolExecutionAllowanceState = {
    allowanceKey: string;
    sessionKey: string;
    operation: VineConfirmOperation;
    intent: VineIntent;
    intentSignature: string;
    rawTarget: string;
    targetSignature: string;
    target: string;
    resumeToken: string;
    expiresAt: number;
    lastSeenAt: number;
};

type VerifyResultKind =
    | "allowed"
    | "invalid_code"
    | "expired"
    | "not_found"
    | "mismatch"
    | "max_attempts_exceeded";

export interface VineVerifyResult {
    kind: VerifyResultKind;
    attemptsRemaining?: number;
}

export interface VineResolvedChallenge {
    confirmId: string;
}

export interface VineActiveWindowSnapshot {
    sessionKey: string;
    riskWindowId: string;
    openedAt: number;
    expiresAt: number;
    remainingActions: number;
}

type ApproveResultKind =
    | "approved"
    | "already_approved"
    | "invalid_code"
    | "expired"
    | "not_found"
    | "ambiguous"
    | "max_attempts_exceeded";

export interface VineApproveResult {
    kind: ApproveResultKind;
    challenge?: VinePendingChallenge;
    attemptsRemaining?: number;
    resumeToken?: string;
}

type ConsumeApprovedResultKind = "allowed" | "not_found" | "expired";

export interface VineConsumeApprovedResult {
    kind: ConsumeApprovedResultKind;
    challenge?: VinePendingChallenge;
    resumeToken?: string;
    matchedByIntent?: boolean;
}

interface VineConfirmManagerOptions {
    now?: () => number;
    randomIntFn?: (maxExclusive: number) => number;
    codeLength?: number;
    ttlSeconds?: number;
    maxAttempts?: number;
    cleanupIntervalMs?: number;
    defaultWindowSeconds?: number;
    defaultMaxActionsPerWindow?: number;
}

type ConfirmationOrOptions = BerryShieldVineConfirmationConfig | VineConfirmManagerOptions;

function isVineConfirmationConfig(value: ConfirmationOrOptions | undefined): value is BerryShieldVineConfirmationConfig {
    if (!value || typeof value !== "object") return false;
    return "strategy" in value;
}

function normalizeTarget(target: string): string {
    return target.trim().replace(/\s+/g, " ");
}

function signTarget(operation: VineConfirmOperation, target: string): string {
    return createHash("sha256")
        .update(`${operation}\n${normalizeTarget(target)}`)
        .digest("hex");
}

function buildLegacyIntent(operation: VineConfirmOperation, target: string, rawTarget?: string): VineIntent {
    return {
        kind: "legacy_target_signature",
        capabilities: [],
        localEffect: {
            writesLocal: operation === "write",
            targetPath: operation === "write" ? target : undefined,
            targetSensitivity: "unknown",
        },
        rawTarget: rawTarget ?? target,
    };
}

function secureEquals(a: string, b: string): boolean {
    const aBuf = Buffer.from(a, "utf8");
    const bBuf = Buffer.from(b, "utf8");
    if (aBuf.length !== bBuf.length) {
        return false;
    }
    return timingSafeEqual(aBuf, bBuf);
}

function normalizeConfirmCodeInput(value: string | number, codeLength: number): string {
    if (typeof value === "number") {
        if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
            return "";
        }
        return value.toString().padStart(codeLength, "0");
    }
    return value.trim();
}

function isActiveChallengeStatus(status: VineConfirmStatus): boolean {
    return status === "pending" || status === "approved";
}

/**
 * Manages Vine confirmation challenges, one-shot execution allowances, and one-to-many approval windows.
 *
 * The lifecycle is split into three stages:
 * - challenge approval: a pending challenge becomes approved after the user confirms the numeric code
 * - berry_check allowance: the approved challenge is consumed into a one-shot allowance for the next
 *   matching `berry_check` handoff
 * - real tool allowance: the same approval can also authorize the immediate tool execution when the
 *   host cannot preserve the original runtime correlation exactly
 *
 * The manager prefers strong correlation signals such as `sessionKey`, `runId`, and chat bindings.
 * When host/runtime identity drifts across surfaces, it may still resolve the single plausible
 * challenge or allowance that matches the requested action. If multiple candidates remain plausible,
 * it fails closed instead of guessing.
 */
export class VineConfirmStateManager {
    private readonly state = new Map<string, VineChallengeState>();
    private readonly activeBySessionKey = new Map<string, string>();
    private readonly activeByChatBindingKey = new Map<string, Set<string>>();
    private readonly executionAllowances = new Map<string, VineExecutionAllowanceState>();
    private readonly toolExecutionAllowances = new Map<string, VineToolExecutionAllowanceState>();
    private readonly windows = new Map<string, VineWindowState>();
    private readonly now: () => number;
    private readonly randomIntFn: (maxExclusive: number) => number;
    private readonly codeLength: number;
    private readonly ttlMs: number;
    private readonly maxAttempts: number;
    private readonly maxEntries: number;
    private readonly codePattern: RegExp;
    private readonly cleanupTimer?: NodeJS.Timeout;
    private readonly defaultWindowSeconds: number;
    private readonly defaultMaxActionsPerWindow: number;

    constructor(
        retention: BerryShieldVineRetentionConfig,
        confirmationOrOptions?: ConfirmationOrOptions,
        maybeOptions: VineConfirmManagerOptions = {}
    ) {
        const confirmation = isVineConfirmationConfig(confirmationOrOptions)
            ? confirmationOrOptions
            : undefined;
        const options = isVineConfirmationConfig(confirmationOrOptions)
            ? maybeOptions
            : (confirmationOrOptions ?? {});
        this.now = options.now ?? Date.now;
        this.randomIntFn = options.randomIntFn ?? randomInt;
        this.codeLength = Math.max(1, Math.floor(options.codeLength ?? VINE_CONFIRMATION.CODE_LENGTH));
        this.ttlMs = Math.max(
            1,
            Math.floor((options.ttlSeconds ?? confirmation?.codeTtlSeconds ?? DEFAULT_CONFIG.vine.confirmation.codeTtlSeconds) * 1000)
        );
        this.maxAttempts = Math.max(
            1,
            Math.floor(options.maxAttempts ?? confirmation?.maxAttempts ?? DEFAULT_CONFIG.vine.confirmation.maxAttempts)
        );
        this.maxEntries = Math.max(1, Math.floor(retention.maxEntries));
        this.defaultWindowSeconds = Math.max(
            1,
            Math.floor(options.defaultWindowSeconds ?? confirmation?.windowSeconds ?? DEFAULT_CONFIG.vine.confirmation.windowSeconds)
        );
        this.defaultMaxActionsPerWindow = Math.max(
            1,
            Math.floor(
                options.defaultMaxActionsPerWindow
                ?? confirmation?.maxActionsPerWindow
                ?? DEFAULT_CONFIG.vine.confirmation.maxActionsPerWindow
            )
        );
        this.codePattern = new RegExp(`^\\d{${this.codeLength}}$`);
        const cleanupIntervalMs = Math.max(
            1,
            Math.floor(options.cleanupIntervalMs ?? VINE_CONFIRMATION.CLEANUP_INTERVAL_MS)
        );

        this.cleanupTimer = setInterval(() => this.prune(), cleanupIntervalMs);
        this.cleanupTimer.unref?.();
    }

    public dispose(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
    }

    public issueChallenge(binding: VineConfirmBinding): VineIssuedChallenge {
        this.prune();
        const nowTs = this.now();
        const activeChallenge = this.getActiveChallengeForSession(binding.sessionKey);
        if (activeChallenge) {
            // Reuse the current gate while the same risk window is still unresolved.
            if (
                activeChallenge.chatBindingKey === (binding.chatBindingKey ?? binding.sessionKey)
                && activeChallenge.riskWindowId === (binding.riskWindowId ?? "risk-window-default")
            ) {
                activeChallenge.lastSeenAt = nowTs;
                return this.toIssuedChallenge(activeChallenge);
            }
            if (this.isSameBinding(activeChallenge, binding)) {
                activeChallenge.lastSeenAt = nowTs;
                return this.toIssuedChallenge(activeChallenge);
            }
            this.markSuperseded(activeChallenge);
        }

        const confirmId = `cfrm_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
        const firstDigit = (Math.abs(this.randomIntFn(9)) % 9) + 1;
        let code = String(firstDigit);
        for (let i = 1; i < this.codeLength; i += 1) {
            code += String(Math.abs(this.randomIntFn(10)) % 10);
        }

        const challenge: VineChallengeState = {
            confirmId,
            confirmCode: code,
            sessionKey: binding.sessionKey,
            chatBindingKey: binding.chatBindingKey ?? binding.sessionKey,
            operation: binding.operation,
            intent: binding.intent ?? buildLegacyIntent(binding.operation, binding.target, binding.rawTarget),
            intentSignature: createIntentSignature(
                binding.intent ?? buildLegacyIntent(binding.operation, binding.target, binding.rawTarget)
            ),
            rawTarget: binding.rawTarget ?? binding.target,
            target: binding.target,
            targetSignature: signTarget(binding.operation, binding.target),
            riskWindowId: binding.riskWindowId ?? "risk-window-default",
            createdAt: nowTs,
            expiresAt: nowTs + this.ttlMs,
            attempts: 0,
            maxAttempts: this.maxAttempts,
            status: "pending",
            lastSeenAt: nowTs,
        };

        this.state.set(confirmId, challenge);
        this.activateChallenge(challenge);
        this.prune();
        return this.toIssuedChallenge(challenge);
    }

    public verifyAndConsume(
        input: Omit<VineConfirmBinding, "chatBindingKey" | "riskWindowId"> & { confirmId: string; confirmCode: string | number }
    ): VineVerifyResult {
        this.prune();
        const current = this.state.get(input.confirmId);
        if (!current || current.status !== "pending") {
            return { kind: "not_found" };
        }

        const nowTs = this.now();
        if (current.expiresAt < nowTs) {
            this.markExpired(current);
            return { kind: "expired" };
        }

        const expectedSignature = signTarget(input.operation, input.target);
        if (
            current.sessionKey !== input.sessionKey
            || current.operation !== input.operation
            || current.targetSignature !== expectedSignature
        ) {
            this.markSuperseded(current);
            return { kind: "mismatch" };
        }

        current.lastSeenAt = nowTs;
        const normalizedCode = normalizeConfirmCodeInput(input.confirmCode, this.codeLength);
        if (!this.codePattern.test(normalizedCode) || !secureEquals(current.confirmCode, normalizedCode)) {
            current.attempts += 1;
            if (current.attempts >= current.maxAttempts) {
                this.markExpired(current);
                return { kind: "max_attempts_exceeded" };
            }
            return { kind: "invalid_code", attemptsRemaining: current.maxAttempts - current.attempts };
        }

        current.status = "consumed";
        current.lastSeenAt = nowTs;
        current.consumedAt = nowTs;
        this.deactivateChallenge(current);
        return { kind: "allowed" };
    }

    public approvePendingByChatBindingKeys(input: {
        chatBindingKeys: string[];
        confirmCode: string | number;
        senderId?: string;
    }): VineApproveResult {
        this.prune();
        const candidates = this.collectChallengesForChatBindings(input.chatBindingKeys);
        return this.approveWithinCandidates(candidates, input.confirmCode, input.senderId);
    }

    public approvePendingForSession(input: {
        sessionKey: string;
        confirmCode: string | number;
        senderId?: string;
    }): VineApproveResult {
        this.prune();
        const current = this.getActiveChallengeForSession(input.sessionKey);
        if (!current || !isActiveChallengeStatus(current.status)) {
            return { kind: "not_found" };
        }
        return this.approveWithinCandidates([current], input.confirmCode, input.senderId);
    }

    /**
     * Approves a pending challenge by numeric code even when the inbound message does not carry the same
     * runtime identity that originally created the challenge.
     *
     * Resolution order is:
     * 1. the preferred session challenge
     * 2. preferred chat-binding candidates
     * 3. the single active challenge matching the code globally
     *
     * More than one plausible match is treated as ambiguity and rejected.
     */
    public approvePendingByCode(input: {
        confirmCode: string | number;
        senderId?: string;
        sessionKey?: string;
        chatBindingKeys?: string[];
    }): VineApproveResult {
        this.prune();
        const normalizedCode = normalizeConfirmCodeInput(input.confirmCode, this.codeLength);
        if (!this.codePattern.test(normalizedCode)) {
            return { kind: "not_found" };
        }

        const preferredSessionCandidate = input.sessionKey
            ? this.getActiveChallengeForSession(input.sessionKey)
            : null;
        const preferredChatCandidates = this.collectChallengesForChatBindings(input.chatBindingKeys ?? []);
        const activeChallenges = this.getActiveChallenges();
        const matchingPreferredSession = preferredSessionCandidate
            && secureEquals(preferredSessionCandidate.confirmCode, normalizedCode)
            ? preferredSessionCandidate
            : null;
        if (matchingPreferredSession) {
            return this.approveChallenge(matchingPreferredSession, input.senderId);
        }

        const matchingPreferredChats = this.findCodeMatches(preferredChatCandidates, normalizedCode);
        if (matchingPreferredChats.length === 1) {
            return this.approveChallenge(matchingPreferredChats[0], input.senderId);
        }
        if (matchingPreferredChats.length > 1) {
            return { kind: "ambiguous" };
        }

        const matchingActiveChallenges = this.findCodeMatches(activeChallenges, normalizedCode);
        if (matchingActiveChallenges.length === 1) {
            return this.approveChallenge(matchingActiveChallenges[0], input.senderId);
        }
        if (matchingActiveChallenges.length > 1) {
            return { kind: "ambiguous" };
        }

        if (preferredSessionCandidate) {
            return this.rejectApprovalForChallenge(preferredSessionCandidate);
        }
        if (preferredChatCandidates.length === 1) {
            return this.rejectApprovalForChallenge(preferredChatCandidates[0]);
        }
        if (activeChallenges.length === 1) {
            return this.rejectApprovalForChallenge(activeChallenges[0]);
        }

        return activeChallenges.length > 1
            ? { kind: "ambiguous" }
            : { kind: "not_found" };
    }

    /**
     * Consumes an approved challenge and converts it into the run-scoped allowance used by the next
     * `berry_check` handoff.
     *
     * Exact session correlation is preferred, but the manager may reuse the single approved challenge
     * matching the same action when approval and execution happen through different host surfaces.
     */
    public consumeApprovedForBinding(input: {
        sessionKey: string;
        operation: VineConfirmOperation;
        target: string;
        runId: string;
        intent?: VineIntent;
        rawTarget?: string;
    }): VineConsumeApprovedResult {
        this.prune();
        const current = this.resolveApprovedChallengeForBinding(input);
        if (!current) {
            return { kind: "not_found" };
        }

        const nowTs = this.now();
        if (current.expiresAt < nowTs) {
            this.markExpired(current);
            return { kind: "expired" };
        }

        const match = this.matchesChallengeBinding(current, input);
        if (!match.isMatch) {
            return { kind: "not_found" };
        }

        current.status = "consumed";
        current.lastSeenAt = nowTs;
        current.consumedAt = nowTs;
        this.deactivateChallenge(current);

        if (current.resumeToken) {
            const allowanceIntent = input.intent ?? current.intent;
            this.executionAllowances.set(`${input.sessionKey}::${input.runId}`, {
                sessionKey: input.sessionKey,
                runId: input.runId,
                operation: input.operation,
                intent: allowanceIntent,
                intentSignature: createIntentSignature(allowanceIntent),
                rawTarget: input.rawTarget ?? input.target,
                targetSignature: signTarget(input.operation, input.target),
                target: input.target,
                resumeToken: current.resumeToken,
                expiresAt: nowTs + this.ttlMs,
                lastSeenAt: nowTs,
            });
        }

        return {
            kind: "allowed",
            challenge: this.toPendingChallenge(current),
            resumeToken: current.resumeToken,
            matchedByIntent: match.matchedByIntent,
        };
    }

    // Stores a one-shot runtime allowance keyed by session + runId for the immediate tool execution handoff.
    public grantExecutionAllowance(input: {
        sessionKey: string;
        runId: string;
        operation: VineConfirmOperation;
        target: string;
        resumeToken: string;
        intent?: VineIntent;
        rawTarget?: string;
    }): void {
        this.prune();
        const nowTs = this.now();
        const allowanceIntent = input.intent ?? buildLegacyIntent(input.operation, input.target, input.rawTarget);
        this.executionAllowances.set(`${input.sessionKey}::${input.runId}`, {
            sessionKey: input.sessionKey,
            runId: input.runId,
            operation: input.operation,
            intent: allowanceIntent,
            intentSignature: createIntentSignature(allowanceIntent),
            rawTarget: input.rawTarget ?? input.target,
            targetSignature: signTarget(input.operation, input.target),
            target: input.target,
            resumeToken: input.resumeToken,
            expiresAt: nowTs + this.ttlMs,
            lastSeenAt: nowTs,
        });
    }

    // Stores a fallback one-shot allowance for the next matching tool call when runtime run ids diverge.
    public grantToolExecutionAllowance(input: {
        sessionKey: string;
        operation: VineConfirmOperation;
        target: string;
        resumeToken: string;
        intent?: VineIntent;
        rawTarget?: string;
    }): void {
        this.prune();
        const nowTs = this.now();
        const allowanceIntent = input.intent ?? buildLegacyIntent(input.operation, input.target, input.rawTarget);
        const allowanceKey = `${input.sessionKey}::${input.resumeToken}::${randomUUID().replace(/-/g, "").slice(0, 8)}`;
        this.toolExecutionAllowances.set(allowanceKey, {
            allowanceKey,
            sessionKey: input.sessionKey,
            operation: input.operation,
            intent: allowanceIntent,
            intentSignature: createIntentSignature(allowanceIntent),
            rawTarget: input.rawTarget ?? input.target,
            targetSignature: signTarget(input.operation, input.target),
            target: input.target,
            resumeToken: input.resumeToken,
            expiresAt: nowTs + this.ttlMs,
            lastSeenAt: nowTs,
        });
    }

    /**
     * Consumes the one-shot allowance created for the next matching runtime call.
     *
     * Direct `sessionKey + runId` correlation wins. If that exact key cannot be found, a single
     * allowance sharing the same `runId` and matching the same action may still be consumed.
     * Multiple matches are rejected to avoid crossing approvals between concurrent runs.
     */
    public consumeExecutionAllowance(input: {
        sessionKey: string;
        runId: string;
        operation: VineConfirmOperation;
        target: string;
        intent?: VineIntent;
    }): boolean {
        this.prune();
        const key = `${input.sessionKey}::${input.runId}`;
        const directAllowance = this.executionAllowances.get(key);
        if (directAllowance) {
            const consumedDirect = this.consumeExecutionAllowanceCandidate(key, directAllowance, input);
            if (consumedDirect) {
                return true;
            }
        }

        const matchingRunCandidates = [...this.executionAllowances.entries()]
            .filter(([candidateKey, allowance]) => candidateKey !== key && allowance.runId === input.runId)
            .sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt);

        const matchedCandidates = matchingRunCandidates.filter(([, allowance]) => this.matchesAllowance(allowance, input));
        if (matchedCandidates.length !== 1) {
            return false;
        }

        const [matchedKey, matchedAllowance] = matchedCandidates[0];
        return this.consumeExecutionAllowanceCandidate(matchedKey, matchedAllowance, input);
    }

    /**
     * Consumes the fallback allowance used by the real tool call when the host cannot preserve the
     * original `runId` between `berry_check` and execution.
     *
     * Session-scoped matches are preferred. A single global match may still be consumed when surface
     * drift prevents exact correlation. Ambiguous matches always fail closed.
     */
    public consumeToolExecutionAllowance(input: {
        sessionKey: string;
        operation: VineConfirmOperation;
        target: string;
        intent?: VineIntent;
    }): boolean {
        this.prune();
        const sessionScopedCandidates = [...this.toolExecutionAllowances.entries()]
            .filter(([, allowance]) => allowance.sessionKey === input.sessionKey)
            .sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt);
        const matchedSessionScoped = sessionScopedCandidates
            .filter(([, allowance]) => this.matchesAllowance(allowance, input));
        if (matchedSessionScoped.length === 1) {
            this.toolExecutionAllowances.delete(matchedSessionScoped[0][0]);
            return true;
        }

        const matchedGlobal = [...this.toolExecutionAllowances.entries()]
            .sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt)
            .filter(([, allowance]) => this.matchesAllowance(allowance, input));
        if (matchedGlobal.length !== 1) {
            return false;
        }

        this.toolExecutionAllowances.delete(matchedGlobal[0][0]);
        return true;
    }

    public resolveLatestChallengeForBinding(
        binding: Omit<VineConfirmBinding, "chatBindingKey" | "riskWindowId">
    ): VineResolvedChallenge | null {
        this.prune();
        const matchingChallenges = this.getActiveChallenges()
            .filter((candidate) => candidate.status === "pending")
            .filter((candidate) => this.matchesChallengeBinding(candidate, binding).isMatch);
        const preferredMatches = matchingChallenges.filter((candidate) => candidate.sessionKey === binding.sessionKey);
        const candidates = preferredMatches.length > 0 ? preferredMatches : matchingChallenges;
        const newest = candidates
            .sort((a, b) => b.createdAt - a.createdAt)
            .at(0) ?? null;
        if (!newest) {
            return null;
        }
        return { confirmId: newest.confirmId };
    }

    public openWindowAfterConfirmation(input: {
        sessionKey: string;
        riskWindowId: string;
        windowSeconds?: number;
        maxActionsPerWindow?: number;
    }): void {
        this.prune();
        const nowTs = this.now();
        const windowSeconds = Math.max(1, Math.floor(input.windowSeconds ?? this.defaultWindowSeconds));
        const maxActionsPerWindow = Math.max(1, Math.floor(input.maxActionsPerWindow ?? this.defaultMaxActionsPerWindow));
        const windowKey = `${input.sessionKey}::${input.riskWindowId}`;
        this.windows.set(windowKey, {
            windowKey,
            sessionKey: input.sessionKey,
            riskWindowId: input.riskWindowId,
            openedAt: nowTs,
            expiresAt: nowTs + (windowSeconds * 1000),
            lastSeenAt: nowTs,
            remainingActions: Math.max(0, maxActionsPerWindow - 1),
        });
        this.prune();
    }

    /**
     * Consumes one slot from a one-to-many approval window.
     *
     * The window is resolved by exact `sessionKey + riskWindowId` first, then by a shared risk window,
     * and only optionally by a single global active window. This preserves cross-surface continuity
     * without turning a window into a broad global permit.
     */
    public consumeActiveWindowSlot(input: {
        sessionKey: string;
        riskWindowId: string;
        allowGlobalFallback?: boolean;
    }): boolean {
        this.prune();
        const windowKey = `${input.sessionKey}::${input.riskWindowId}`;
        const directWindow = this.windows.get(windowKey);
        if (directWindow && this.consumeWindowCandidate(windowKey, directWindow)) {
            return true;
        }

        const sharedRiskMatches = [...this.windows.entries()]
            .filter(([candidateKey]) => candidateKey !== windowKey)
            .filter(([, window]) => window.riskWindowId === input.riskWindowId)
            .sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt);
        if (sharedRiskMatches.length === 1 && this.consumeWindowCandidate(sharedRiskMatches[0][0], sharedRiskMatches[0][1])) {
            return true;
        }

        if (!input.allowGlobalFallback) {
            return false;
        }

        const activeWindows = [...this.windows.entries()]
            .sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt);
        if (activeWindows.length !== 1) {
            return false;
        }

        return this.consumeWindowCandidate(activeWindows[0][0], activeWindows[0][1]);
    }

    public getActiveWindowSnapshot(input: {
        sessionKey: string;
        riskWindowId: string;
    }): VineActiveWindowSnapshot | null {
        this.prune();
        const window = this.windows.get(`${input.sessionKey}::${input.riskWindowId}`);
        if (!window) {
            return null;
        }
        return {
            sessionKey: window.sessionKey,
            riskWindowId: window.riskWindowId,
            openedAt: window.openedAt,
            expiresAt: window.expiresAt,
            remainingActions: window.remainingActions,
        };
    }

    public clearApprovedChallenge(sessionKey: string): void {
        this.prune();
        const current = this.getActiveChallengeForSession(sessionKey);
        if (current && current.status === "approved") {
            current.status = "consumed";
            current.lastSeenAt = this.now();
            current.consumedAt = this.now();
            this.deactivateChallenge(current);
        }
    }

    public getPendingChallengeForSession(sessionKey: string): VinePendingChallenge | null {
        this.prune();
        const current = this.getActiveChallengeForSession(sessionKey);
        if (!current) {
            return null;
        }
        return this.toPendingChallenge(current);
    }

    public prune(): void {
        const nowTs = this.now();
        for (const challenge of this.state.values()) {
            if ((challenge.status === "pending" || challenge.status === "approved") && challenge.expiresAt < nowTs) {
                this.markExpired(challenge);
            }
        }

        for (const [key, value] of this.executionAllowances.entries()) {
            if (value.expiresAt < nowTs) {
                this.executionAllowances.delete(key);
            }
        }

        for (const [key, value] of this.toolExecutionAllowances.entries()) {
            if (value.expiresAt < nowTs) {
                this.toolExecutionAllowances.delete(key);
            }
        }

        for (const [key, value] of this.windows.entries()) {
            if (value.expiresAt < nowTs || value.remainingActions <= 0) {
                this.windows.delete(key);
            }
        }

        if (this.state.size > this.maxEntries) {
            const overflow = this.state.size - this.maxEntries;
            const oldest = [...this.state.entries()]
                .sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt)
                .slice(0, overflow);
            for (const [key, challenge] of oldest) {
                this.deactivateChallenge(challenge);
                this.state.delete(key);
            }
        }

        if (this.windows.size > this.maxEntries) {
            const overflow = this.windows.size - this.maxEntries;
            const oldestWindows = [...this.windows.entries()]
                .sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt)
                .slice(0, overflow);
            for (const [key] of oldestWindows) {
                this.windows.delete(key);
            }
        }

        if (this.toolExecutionAllowances.size > this.maxEntries) {
            const overflow = this.toolExecutionAllowances.size - this.maxEntries;
            const oldestAllowances = [...this.toolExecutionAllowances.entries()]
                .sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt)
                .slice(0, overflow);
            for (const [key] of oldestAllowances) {
                this.toolExecutionAllowances.delete(key);
            }
        }
    }

    public size(): number {
        return this.state.size;
    }

    private getActiveChallenges(): VineChallengeState[] {
        return [...this.state.values()]
            .filter((challenge) => isActiveChallengeStatus(challenge.status));
    }

    private collectChallengesForChatBindings(chatBindingKeys: string[]): VineChallengeState[] {
        const candidateIds = new Set<string>();
        for (const chatBindingKey of chatBindingKeys) {
            const activeIds = this.activeByChatBindingKey.get(chatBindingKey);
            if (!activeIds) {
                continue;
            }
            for (const id of activeIds) {
                candidateIds.add(id);
            }
        }
        return [...candidateIds]
            .map((id) => this.state.get(id))
            .filter((challenge): challenge is VineChallengeState => Boolean(challenge && isActiveChallengeStatus(challenge.status)));
    }

    private findCodeMatches(challenges: VineChallengeState[], normalizedCode: string): VineChallengeState[] {
        return challenges.filter((challenge) => secureEquals(challenge.confirmCode, normalizedCode));
    }

    private approveWithinCandidates(
        candidates: VineChallengeState[],
        confirmCode: string | number,
        senderId?: string
    ): VineApproveResult {
        if (candidates.length === 0) {
            return { kind: "not_found" };
        }

        const normalizedCode = normalizeConfirmCodeInput(confirmCode, this.codeLength);
        if (!this.codePattern.test(normalizedCode)) {
            return candidates.length === 1
                ? this.rejectApprovalForChallenge(candidates[0])
                : { kind: "ambiguous" };
        }

        const matches = this.findCodeMatches(candidates, normalizedCode);
        if (matches.length === 1) {
            return this.approveChallenge(matches[0], senderId);
        }
        if (matches.length > 1) {
            return { kind: "ambiguous" };
        }
        return candidates.length === 1
            ? this.rejectApprovalForChallenge(candidates[0])
            : { kind: "ambiguous" };
    }

    private approveChallenge(challenge: VineChallengeState, senderId?: string): VineApproveResult {
        const nowTs = this.now();
        if (challenge.expiresAt < nowTs) {
            this.markExpired(challenge);
            return { kind: "expired" };
        }

        challenge.lastSeenAt = nowTs;
        if (challenge.status === "approved" && challenge.resumeToken) {
            return {
                kind: "already_approved",
                challenge: this.toPendingChallenge(challenge),
                resumeToken: challenge.resumeToken,
            };
        }

        challenge.status = "approved";
        challenge.approvedAt = nowTs;
        challenge.approvedBySenderId = senderId?.trim() || undefined;
        challenge.resumeToken = challenge.resumeToken ?? `vres_${randomUUID().replace(/-/g, "").slice(0, 18)}`;

        return {
            kind: "approved",
            challenge: this.toPendingChallenge(challenge),
            resumeToken: challenge.resumeToken,
        };
    }

    private rejectApprovalForChallenge(challenge: VineChallengeState): VineApproveResult {
        const nowTs = this.now();
        if (challenge.expiresAt < nowTs) {
            this.markExpired(challenge);
            return { kind: "expired" };
        }

        challenge.attempts += 1;
        challenge.lastSeenAt = nowTs;
        if (challenge.attempts >= challenge.maxAttempts) {
            this.markExpired(challenge);
            return { kind: "max_attempts_exceeded" };
        }

        return {
            kind: "invalid_code",
            challenge: this.toPendingChallenge(challenge),
            attemptsRemaining: challenge.maxAttempts - challenge.attempts,
        };
    }

    /**
     * Resolves which approved challenge should authorize the next matching action.
     *
     * Exact session matches win. If runtime identity drifted and only one approved challenge remains
     * plausible for the same action, that challenge may still be used. If more than one approved
     * challenge matches, resolution stops and returns null.
     */
    private resolveApprovedChallengeForBinding(input: {
        sessionKey: string;
        operation: VineConfirmOperation;
        target: string;
        intent?: VineIntent;
        rawTarget?: string;
    }): VineChallengeState | null {
        const approvedChallenges = this.getActiveChallenges()
            .filter((challenge) => challenge.status === "approved")
            .filter((challenge) => this.matchesChallengeBinding(challenge, input).isMatch);
        if (approvedChallenges.length === 0) {
            return null;
        }

        const sessionScoped = approvedChallenges.filter((challenge) => challenge.sessionKey === input.sessionKey);
        if (sessionScoped.length === 1) {
            return sessionScoped[0];
        }
        if (sessionScoped.length > 1) {
            return null;
        }

        return approvedChallenges.length === 1
            ? approvedChallenges[0]
            : null;
    }

    /**
     * Matches a challenge against a requested action. Intent equality is preferred because it captures
     * the semantic action that was approved; target-signature matching is the legacy fallback.
     */
    private matchesChallengeBinding(
        challenge: VineChallengeState,
        binding: Omit<VineConfirmBinding, "chatBindingKey" | "riskWindowId">
    ): { isMatch: boolean; matchedByIntent: boolean } {
        if (challenge.operation !== binding.operation) {
            return { isMatch: false, matchedByIntent: false };
        }
        if (binding.intent) {
            const matchedByIntent = isEquivalentApprovedIntent(challenge.intent, binding.intent);
            return { isMatch: matchedByIntent, matchedByIntent };
        }
        return {
            isMatch: challenge.targetSignature === signTarget(binding.operation, binding.target),
            matchedByIntent: false,
        };
    }

    /**
     * Applies the same action-matching rules used for approved challenges to execution allowances.
     */
    private matchesAllowance(
        allowance: Pick<VineExecutionAllowanceState, "operation" | "intent" | "targetSignature" | "expiresAt">,
        input: {
            operation: VineConfirmOperation;
            target: string;
            intent?: VineIntent;
        }
    ): boolean {
        const nowTs = this.now();
        if (allowance.expiresAt < nowTs) {
            return false;
        }
        if (allowance.operation !== input.operation) {
            return false;
        }
        if (input.intent) {
            return isEquivalentApprovedIntent(allowance.intent, input.intent);
        }
        return allowance.targetSignature === signTarget(input.operation, input.target);
    }

    private consumeExecutionAllowanceCandidate(
        key: string,
        allowance: VineExecutionAllowanceState,
        input: {
            operation: VineConfirmOperation;
            target: string;
            intent?: VineIntent;
        }
    ): boolean {
        if (!this.matchesAllowance(allowance, input)) {
            if (allowance.expiresAt < this.now()) {
                this.executionAllowances.delete(key);
            }
            return false;
        }

        this.executionAllowances.delete(key);
        return true;
    }

    private consumeWindowCandidate(windowKey: string, window: VineWindowState): boolean {
        const nowTs = this.now();
        if (window.expiresAt < nowTs || window.remainingActions <= 0) {
            this.windows.delete(windowKey);
            return false;
        }

        window.remainingActions -= 1;
        window.lastSeenAt = nowTs;
        if (window.remainingActions <= 0) {
            this.windows.delete(windowKey);
        }
        return true;
    }

    private toIssuedChallenge(challenge: VineChallengeState): VineIssuedChallenge {
        return {
            confirmId: challenge.confirmId,
            confirmCode: challenge.confirmCode,
            ttlSeconds: Math.max(0, Math.ceil((challenge.expiresAt - this.now()) / 1000)),
            maxAttempts: challenge.maxAttempts,
            attemptsRemaining: Math.max(0, challenge.maxAttempts - challenge.attempts),
        };
    }

    private toPendingChallenge(challenge: VineChallengeState): VinePendingChallenge {
        return {
            confirmId: challenge.confirmId,
            confirmCode: challenge.confirmCode,
            sessionKey: challenge.sessionKey,
            chatBindingKey: challenge.chatBindingKey,
            operation: challenge.operation,
            intent: challenge.intent,
            intentSignature: challenge.intentSignature,
            rawTarget: challenge.rawTarget,
            target: challenge.target,
            targetSignature: challenge.targetSignature,
            riskWindowId: challenge.riskWindowId,
            createdAt: challenge.createdAt,
            expiresAt: challenge.expiresAt,
            attempts: challenge.attempts,
            maxAttempts: challenge.maxAttempts,
            status: challenge.status,
            approvedAt: challenge.approvedAt,
            approvedBySenderId: challenge.approvedBySenderId,
            resumeToken: challenge.resumeToken,
        };
    }

    private getActiveChallengeForSession(sessionKey: string): VineChallengeState | null {
        const confirmId = this.activeBySessionKey.get(sessionKey);
        if (!confirmId) {
            return null;
        }
        const challenge = this.state.get(confirmId);
        if (!challenge || !isActiveChallengeStatus(challenge.status)) {
            this.activeBySessionKey.delete(sessionKey);
            return null;
        }
        return challenge;
    }

    private isSameBinding(current: VineChallengeState, binding: VineConfirmBinding): boolean {
        return (
            current.sessionKey === binding.sessionKey
            && current.chatBindingKey === binding.chatBindingKey
            && current.operation === binding.operation
            && (
                (binding.intent && current.intentSignature === createIntentSignature(binding.intent))
                || current.targetSignature === signTarget(binding.operation, binding.target)
            )
        );
    }

    private activateChallenge(challenge: VineChallengeState): void {
        this.activeBySessionKey.set(challenge.sessionKey, challenge.confirmId);
        const byChat = this.activeByChatBindingKey.get(challenge.chatBindingKey) ?? new Set<string>();
        byChat.add(challenge.confirmId);
        this.activeByChatBindingKey.set(challenge.chatBindingKey, byChat);
    }

    private deactivateChallenge(challenge: VineChallengeState): void {
        const sessionMapped = this.activeBySessionKey.get(challenge.sessionKey);
        if (sessionMapped === challenge.confirmId) {
            this.activeBySessionKey.delete(challenge.sessionKey);
        }

        const byChat = this.activeByChatBindingKey.get(challenge.chatBindingKey);
        if (!byChat) {
            return;
        }
        byChat.delete(challenge.confirmId);
        if (byChat.size === 0) {
            this.activeByChatBindingKey.delete(challenge.chatBindingKey);
        }
    }

    private markSuperseded(challenge: VineChallengeState, supersededByConfirmId?: string): void {
        challenge.status = "superseded";
        challenge.lastSeenAt = this.now();
        challenge.supersededByConfirmId = supersededByConfirmId;
        this.deactivateChallenge(challenge);
    }

    private markExpired(challenge: VineChallengeState): void {
        challenge.status = "expired";
        challenge.lastSeenAt = this.now();
        this.deactivateChallenge(challenge);
    }
}

let sharedConfirmManager: VineConfirmStateManager | null = null;
let sharedConfirmSignature = "";

export function getSharedVineConfirmStateManager(
    retention: BerryShieldVineRetentionConfig,
    confirmation: BerryShieldVineConfirmationConfig
): VineConfirmStateManager {
    const signature = `${retention.maxEntries}:${retention.ttlSeconds}:${confirmation.strategy}:${confirmation.codeTtlSeconds}:${confirmation.maxAttempts}:${confirmation.windowSeconds}:${confirmation.maxActionsPerWindow}`;
    if (!sharedConfirmManager || sharedConfirmSignature !== signature) {
        sharedConfirmManager?.dispose();
        sharedConfirmManager = new VineConfirmStateManager(retention, confirmation);
        sharedConfirmSignature = signature;
    }
    return sharedConfirmManager;
}

export function resetSharedVineConfirmStateManagerForTests(): void {
    sharedConfirmManager?.dispose();
    sharedConfirmManager = null;
    sharedConfirmSignature = "";
}
