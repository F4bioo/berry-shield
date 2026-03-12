import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { VINE_CONFIRMATION } from "../constants.js";
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
            Math.floor((options.ttlSeconds ?? confirmation?.codeTtlSeconds ?? VINE_CONFIRMATION.TTL_SECONDS) * 1000)
        );
        this.maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? confirmation?.maxAttempts ?? VINE_CONFIRMATION.MAX_ATTEMPTS));
        this.maxEntries = Math.max(1, Math.floor(retention.maxEntries));
        this.defaultWindowSeconds = Math.max(
            1,
            Math.floor(options.defaultWindowSeconds ?? confirmation?.windowSeconds ?? 120)
        );
        this.defaultMaxActionsPerWindow = Math.max(
            1,
            Math.floor(options.defaultMaxActionsPerWindow ?? confirmation?.maxActionsPerWindow ?? 3)
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
        const candidateIds = new Set<string>();
        for (const chatBindingKey of input.chatBindingKeys) {
            const activeIds = this.activeByChatBindingKey.get(chatBindingKey);
            if (!activeIds) {
                continue;
            }
            for (const id of activeIds) {
                candidateIds.add(id);
            }
        }

        if (candidateIds.size === 0) {
            return { kind: "not_found" };
        }
        if (candidateIds.size > 1) {
            return { kind: "ambiguous" };
        }

        const confirmId = [...candidateIds][0];
        const current = this.state.get(confirmId);
        if (!current || !isActiveChallengeStatus(current.status)) {
            return { kind: "not_found" };
        }

        const nowTs = this.now();
        if (current.expiresAt < nowTs) {
            this.markExpired(current);
            return { kind: "expired" };
        }

        const normalizedCode = normalizeConfirmCodeInput(input.confirmCode, this.codeLength);
        if (!this.codePattern.test(normalizedCode) || !secureEquals(current.confirmCode, normalizedCode)) {
            current.attempts += 1;
            current.lastSeenAt = nowTs;
            if (current.attempts >= current.maxAttempts) {
                this.markExpired(current);
                return { kind: "max_attempts_exceeded" };
            }
            return {
                kind: "invalid_code",
                challenge: this.toPendingChallenge(current),
                attemptsRemaining: current.maxAttempts - current.attempts,
            };
        }

        current.lastSeenAt = nowTs;
        if (current.status === "approved" && current.resumeToken) {
            return {
                kind: "already_approved",
                challenge: this.toPendingChallenge(current),
                resumeToken: current.resumeToken,
            };
        }

        current.status = "approved";
        current.approvedAt = nowTs;
        current.approvedBySenderId = input.senderId?.trim() || undefined;
        current.resumeToken = current.resumeToken ?? `vres_${randomUUID().replace(/-/g, "").slice(0, 18)}`;

        return {
            kind: "approved",
            challenge: this.toPendingChallenge(current),
            resumeToken: current.resumeToken,
        };
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

        const nowTs = this.now();
        if (current.expiresAt < nowTs) {
            this.markExpired(current);
            return { kind: "expired" };
        }

        const normalizedCode = normalizeConfirmCodeInput(input.confirmCode, this.codeLength);
        if (!this.codePattern.test(normalizedCode) || !secureEquals(current.confirmCode, normalizedCode)) {
            current.attempts += 1;
            current.lastSeenAt = nowTs;
            if (current.attempts >= current.maxAttempts) {
                this.markExpired(current);
                return { kind: "max_attempts_exceeded" };
            }
            return {
                kind: "invalid_code",
                challenge: this.toPendingChallenge(current),
                attemptsRemaining: current.maxAttempts - current.attempts,
            };
        }

        current.lastSeenAt = nowTs;
        if (current.status === "approved" && current.resumeToken) {
            return {
                kind: "already_approved",
                challenge: this.toPendingChallenge(current),
                resumeToken: current.resumeToken,
            };
        }

        current.status = "approved";
        current.approvedAt = nowTs;
        current.approvedBySenderId = input.senderId?.trim() || undefined;
        current.resumeToken = current.resumeToken ?? `vres_${randomUUID().replace(/-/g, "").slice(0, 18)}`;

        return {
            kind: "approved",
            challenge: this.toPendingChallenge(current),
            resumeToken: current.resumeToken,
        };
    }

    // Converts an approved human reply into a single run-scoped allowance and consumes the pending challenge.
    public consumeApprovedForBinding(input: {
        sessionKey: string;
        operation: VineConfirmOperation;
        target: string;
        runId: string;
        intent?: VineIntent;
        rawTarget?: string;
    }): VineConsumeApprovedResult {
        this.prune();
        const current = this.getActiveChallengeForSession(input.sessionKey);
        if (!current || current.status !== "approved") {
            return { kind: "not_found" };
        }

        const nowTs = this.now();
        if (current.expiresAt < nowTs) {
            this.markExpired(current);
            return { kind: "expired" };
        }

        let isMatch = false;
        let matchedByIntent = false;

        if (current.operation === input.operation && input.intent) {
            isMatch = isEquivalentApprovedIntent(current.intent, input.intent);
            matchedByIntent = isMatch;
        } else if (current.operation === input.operation) {
            isMatch = current.targetSignature === signTarget(input.operation, input.target);
        }

        if (!isMatch) {
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
            matchedByIntent,
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

    // Consumes the exact run-scoped allowance created during the approved berry_check handoff.
    public consumeExecutionAllowance(input: {
        sessionKey: string;
        runId: string;
        operation: VineConfirmOperation;
        target: string;
        intent?: VineIntent;
    }): boolean {
        this.prune();
        const key = `${input.sessionKey}::${input.runId}`;
        const allowance = this.executionAllowances.get(key);
        if (!allowance) {
            return false;
        }

        const nowTs = this.now();
        if (allowance.expiresAt < nowTs) {
            this.executionAllowances.delete(key);
            return false;
        }

        let isMatch = false;

        if (allowance.operation === input.operation && input.intent) {
            isMatch = isEquivalentApprovedIntent(allowance.intent, input.intent);
        } else if (allowance.operation === input.operation) {
            isMatch = allowance.targetSignature === signTarget(input.operation, input.target);
        }

        if (!isMatch) {
            return false;
        }

        this.executionAllowances.delete(key);
        return true;
    }

    // Consumes the fallback tool allowance when the real tool call cannot be correlated through the original run id.
    public consumeToolExecutionAllowance(input: {
        sessionKey: string;
        operation: VineConfirmOperation;
        target: string;
        intent?: VineIntent;
    }): boolean {
        this.prune();
        const candidates = [...this.toolExecutionAllowances.entries()]
            .filter(([, allowance]) => allowance.sessionKey === input.sessionKey)
            .sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt);

        for (const [key, allowance] of candidates) {
            const nowTs = this.now();
            if (allowance.expiresAt < nowTs) {
                this.toolExecutionAllowances.delete(key);
                continue;
            }

            let isMatch = false;
            if (allowance.operation === input.operation && input.intent) {
                isMatch = isEquivalentApprovedIntent(allowance.intent, input.intent);
            } else if (allowance.operation === input.operation) {
                isMatch = allowance.targetSignature === signTarget(input.operation, input.target);
            }

            if (!isMatch) {
                continue;
            }

            this.toolExecutionAllowances.delete(key);
            return true;
        }

        return false;
    }

    public resolveLatestChallengeForBinding(
        binding: Omit<VineConfirmBinding, "chatBindingKey" | "riskWindowId">
    ): VineResolvedChallenge | null {
        this.prune();
        const expectedIntentSignature = binding.intent ? createIntentSignature(binding.intent) : null;
        const expectedSignature = expectedIntentSignature ? null : signTarget(binding.operation, binding.target);
        let newest: VineChallengeState | null = null;
        for (const candidate of this.state.values()) {
            if (candidate.status !== "pending") {
                continue;
            }
            if (
                candidate.sessionKey !== binding.sessionKey
                || candidate.operation !== binding.operation
            ) {
                continue;
            }
            if (expectedIntentSignature) {
                if (candidate.intentSignature !== expectedIntentSignature) {
                    continue;
                }
            } else if (candidate.targetSignature !== expectedSignature) {
                continue;
            }
            if (!newest || candidate.createdAt >= newest.createdAt) {
                newest = candidate;
            }
        }
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

    public consumeActiveWindowSlot(input: { sessionKey: string; riskWindowId: string }): boolean {
        this.prune();
        const windowKey = `${input.sessionKey}::${input.riskWindowId}`;
        const window = this.windows.get(windowKey);
        if (!window) {
            return false;
        }
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
