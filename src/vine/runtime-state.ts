import type { BerryShieldVineRetentionConfig } from "../types/config.js";

interface VineSessionState {
    firstSeenAt: number;
    lastSeenAt: number;
    externalRiskLevel: number;
    externalSignalsCount: number;
    forcedGuardTurnsRemaining: number;
    stickyExternalRisk: boolean;
    safeClearingSignalsCount: number;
    riskWindowId: string;
    sourceToolCallId?: string;
    lastInjectedAt?: number;
    unknownSignalsCount: number;
}

interface MarkExternalSignalInput {
    sessionKey: string;
    escalationThreshold: number;
    forcedGuardTurns: number;
    sourceToolCallId?: string;
}

/**
 * Runtime in-memory state manager for Berry.Vine.
 */
export class VineStateManager {
    private readonly state = new Map<string, VineSessionState>();
    private readonly maxEntries: number;
    private readonly ttlMs: number;
    private readonly now: () => number;

    constructor(retention: BerryShieldVineRetentionConfig, now: () => number = Date.now) {
        this.maxEntries = Math.max(1, Math.floor(retention.maxEntries));
        this.ttlMs = Math.max(1, Math.floor(retention.ttlSeconds * 1000));
        this.now = now;
    }

    public markExternalSignal(input: MarkExternalSignalInput): VineSessionState {
        this.prune();
        const nowTs = this.now();
        const current = this.state.get(input.sessionKey) ?? {
            firstSeenAt: nowTs,
            lastSeenAt: nowTs,
            externalRiskLevel: 0,
            externalSignalsCount: 0,
            forcedGuardTurnsRemaining: 0,
            stickyExternalRisk: false,
            safeClearingSignalsCount: 0,
            riskWindowId: "",
            sourceToolCallId: undefined,
            lastInjectedAt: undefined,
            unknownSignalsCount: 0,
        };

        current.lastSeenAt = nowTs;
        current.externalSignalsCount += 1;
        if (input.sourceToolCallId) {
            current.sourceToolCallId = input.sourceToolCallId;
        }

        if (current.externalSignalsCount >= Math.max(1, input.escalationThreshold)) {
            current.externalRiskLevel = Math.max(1, current.externalRiskLevel + 1);
            current.forcedGuardTurnsRemaining = Math.max(
                current.forcedGuardTurnsRemaining,
                Math.max(1, input.forcedGuardTurns)
            );
            current.stickyExternalRisk = true;
            current.riskWindowId = `vine-${nowTs}-${Math.random().toString(36).slice(2, 8)}`;
        }

        this.state.set(input.sessionKey, current);
        return current;
    }

    public beginTurn(sessionKey: string): VineSessionState | undefined {
        this.prune();
        const entry = this.state.get(sessionKey);
        if (!entry) return undefined;
        entry.lastSeenAt = this.now();
        return entry;
    }

    public shouldInjectContext(sessionKey: string, minIntervalMs = 120_000): boolean {
        const entry = this.state.get(sessionKey);
        if (!entry) return false;
        if (!entry.stickyExternalRisk && entry.forcedGuardTurnsRemaining <= 0) return false;
        const nowTs = this.now();
        const last = entry.lastInjectedAt ?? 0;
        if ((nowTs - last) < minIntervalMs) return false;
        entry.lastInjectedAt = nowTs;
        return true;
    }

    public shouldGuardSensitiveAction(sessionKey: string): boolean {
        const entry = this.state.get(sessionKey);
        if (!entry) return false;
        return entry.stickyExternalRisk || entry.forcedGuardTurnsRemaining > 0;
    }

    public consumeForcedGuardTurn(sessionKey: string): void {
        const entry = this.state.get(sessionKey);
        if (!entry) return;
        if (entry.forcedGuardTurnsRemaining > 0) {
            entry.forcedGuardTurnsRemaining -= 1;
        }
    }

    public markSafeHumanSignal(sessionKey: string): void {
        const entry = this.state.get(sessionKey);
        if (!entry) return;
        entry.safeClearingSignalsCount += 1;
    }

    public markUnknownSignal(sessionKey: string): void {
        const nowTs = this.now();
        const entry = this.state.get(sessionKey) ?? {
            firstSeenAt: nowTs,
            lastSeenAt: nowTs,
            externalRiskLevel: 0,
            externalSignalsCount: 0,
            forcedGuardTurnsRemaining: 0,
            stickyExternalRisk: false,
            safeClearingSignalsCount: 0,
            riskWindowId: "",
            sourceToolCallId: undefined,
            lastInjectedAt: undefined,
            unknownSignalsCount: 0,
        };
        entry.lastSeenAt = nowTs;
        entry.unknownSignalsCount += 1;
        this.state.set(sessionKey, entry);
    }

    public hasUnknownSignal(sessionKey: string): boolean {
        const entry = this.state.get(sessionKey);
        if (!entry) return false;
        return entry.unknownSignalsCount > 0;
    }

    public clearRisk(sessionKey: string): void {
        const entry = this.state.get(sessionKey);
        if (!entry) return;
        entry.externalRiskLevel = 0;
        entry.externalSignalsCount = 0;
        entry.forcedGuardTurnsRemaining = 0;
        entry.stickyExternalRisk = false;
        entry.safeClearingSignalsCount = 0;
        entry.riskWindowId = "";
        entry.sourceToolCallId = undefined;
        entry.unknownSignalsCount = 0;
    }

    public delete(sessionKey: string): void {
        this.state.delete(sessionKey);
    }

    public prune(): void {
        const nowTs = this.now();
        for (const [key, value] of this.state.entries()) {
            if ((nowTs - value.lastSeenAt) > this.ttlMs) {
                this.state.delete(key);
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
    }
}

let sharedVineStateManager: VineStateManager | null = null;
let sharedRetentionSignature = "";

export function getSharedVineStateManager(retention: BerryShieldVineRetentionConfig): VineStateManager {
    const signature = `${retention.maxEntries}:${retention.ttlSeconds}`;
    if (!sharedVineStateManager || sharedRetentionSignature !== signature) {
        sharedVineStateManager = new VineStateManager(retention);
        sharedRetentionSignature = signature;
    }
    return sharedVineStateManager;
}

export function resetSharedVineStateManagerForTests(): void {
    sharedVineStateManager = null;
    sharedRetentionSignature = "";
}
