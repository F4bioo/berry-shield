import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { VINE_CONFIRMATION } from "../constants.js";
import type { BerryShieldVineConfirmationConfig, BerryShieldVineRetentionConfig } from "../types/config.js";

export type VineConfirmOperation = "exec" | "write";

export interface VineConfirmBinding {
    sessionKey: string;
    operation: VineConfirmOperation;
    target: string;
}

export interface VineIssuedChallenge {
    confirmId: string;
    confirmCode: string;
    ttlSeconds: number;
    maxAttempts: number;
}

type VineChallengeState = {
    confirmId: string;
    confirmCode: string;
    sessionKey: string;
    operation: VineConfirmOperation;
    targetSignature: string;
    createdAt: number;
    expiresAt: number;
    lastSeenAt: number;
    attempts: number;
    maxAttempts: number;
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

function secureEquals(a: string, b: string): boolean {
    const aBuf = Buffer.from(a, "utf8");
    const bBuf = Buffer.from(b, "utf8");
    if (aBuf.length !== bBuf.length) {
        return false;
    }
    return timingSafeEqual(aBuf, bBuf);
}

function normalizeConfirmCodeInput(
    value: string | number,
    codeLength: number
): string {
    if (typeof value === "number") {
        if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
            return "";
        }
        return value.toString().padStart(codeLength, "0");
    }
    return value.trim();
}

export class VineConfirmStateManager {
    private readonly state = new Map<string, VineChallengeState>();
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
            operation: binding.operation,
            targetSignature: signTarget(binding.operation, binding.target),
            createdAt: nowTs,
            expiresAt: nowTs + this.ttlMs,
            lastSeenAt: nowTs,
            attempts: 0,
            maxAttempts: this.maxAttempts,
        };
        this.state.set(confirmId, challenge);
        this.prune();
        return {
            confirmId,
            confirmCode: code,
            ttlSeconds: Math.floor(this.ttlMs / 1000),
            maxAttempts: this.maxAttempts,
        };
    }

    public verifyAndConsume(
        input: VineConfirmBinding & { confirmId: string; confirmCode: string | number }
    ): VineVerifyResult {
        this.prune();
        const current = this.state.get(input.confirmId);
        if (!current) {
            return { kind: "not_found" };
        }

        const nowTs = this.now();
        if (current.expiresAt < nowTs) {
            this.state.delete(input.confirmId);
            return { kind: "expired" };
        }

        const expectedSignature = signTarget(input.operation, input.target);
        if (
            current.sessionKey !== input.sessionKey
            || current.operation !== input.operation
            || current.targetSignature !== expectedSignature
        ) {
            this.state.delete(input.confirmId);
            return { kind: "mismatch" };
        }

        current.lastSeenAt = nowTs;
        const normalizedCode = normalizeConfirmCodeInput(input.confirmCode, this.codeLength);
        if (!this.codePattern.test(normalizedCode) || !secureEquals(current.confirmCode, normalizedCode)) {
            current.attempts += 1;
            if (current.attempts >= current.maxAttempts) {
                this.state.delete(input.confirmId);
                return { kind: "max_attempts_exceeded" };
            }
            return { kind: "invalid_code", attemptsRemaining: current.maxAttempts - current.attempts };
        }

        this.state.delete(input.confirmId);
        return { kind: "allowed" };
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

    public resolveLatestChallengeForBinding(
        binding: VineConfirmBinding
    ): VineResolvedChallenge | null {
        this.prune();
        const expectedSignature = signTarget(binding.operation, binding.target);
        let newest: VineChallengeState | null = null;
        for (const candidate of this.state.values()) {
            if (
                candidate.sessionKey !== binding.sessionKey
                || candidate.operation !== binding.operation
                || candidate.targetSignature !== expectedSignature
            ) {
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

    public prune(): void {
        const nowTs = this.now();
        for (const [key, value] of this.state.entries()) {
            if (value.expiresAt < nowTs) {
                this.state.delete(key);
            }
        }
        for (const [key, value] of this.windows.entries()) {
            if (value.expiresAt < nowTs || value.remainingActions <= 0) {
                this.windows.delete(key);
            }
        }
        if (this.state.size <= this.maxEntries) return;
        const overflow = this.state.size - this.maxEntries;
        const oldest = [...this.state.entries()]
            .sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt)
            .slice(0, overflow);
        for (const [key] of oldest) {
            this.state.delete(key);
        }
        if (this.windows.size <= this.maxEntries) return;
        const windowOverflow = this.windows.size - this.maxEntries;
        const oldestWindows = [...this.windows.entries()]
            .sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt)
            .slice(0, windowOverflow);
        for (const [key] of oldestWindows) {
            this.windows.delete(key);
        }
    }

    public size(): number {
        return this.state.size;
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
