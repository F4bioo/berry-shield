import type {
    BerryShieldPolicyConfig,
    BerryShieldPolicyProfile,
    BerryShieldPolicyRetentionConfig,
} from "../types/config.js";

type NowFn = () => number;

export type PolicyInjectionDecision = "full" | "short" | "none";

interface SessionPolicyState {
    firstSeenAt: number;
    lastSeenAt: number;
    lastInjectedAt?: number;
    turnCount: number;
    forcedFullTurnsRemaining: number;
    escalationLevel: number;
    lastProvider?: string;
}

export interface PolicyStateStats {
    removedExpired: number;
    removedOverflow: number;
}

interface BeginTurnResult {
    isNew: boolean;
    isStale: boolean;
    providerChanged: boolean;
    turnCount: number;
}

export interface PolicyDecisionInput {
    sessionKey: string;
    hasSessionIdentity: boolean;
    provider?: string;
    policy: BerryShieldPolicyConfig;
}

/**
 * Tracks session policy state and computes injection decisions.
 */
export class PolicyStateManager {
    private readonly state = new Map<string, SessionPolicyState>();
    private readonly maxEntries: number;
    private readonly ttlMs: number;
    private readonly now: NowFn;
    private globalForcedFullTurnsRemaining = 0;

    constructor(retention: BerryShieldPolicyRetentionConfig, now: NowFn = Date.now) {
        this.maxEntries = Math.max(1, Math.floor(retention.maxEntries));
        this.ttlMs = Math.max(1, Math.floor(retention.ttlSeconds * 1000));
        this.now = now;
    }

    public markDenied(sessionKey: string | undefined, escalationTurns = 1, allowGlobalEscalation = false): void {
        this.forceFullTurns(sessionKey, escalationTurns, allowGlobalEscalation);
    }

    public markModelSwap(sessionKey: string, escalationTurns = 1): void {
        this.forceFullTurns(sessionKey, escalationTurns, false);
    }

    public consumeTurnDecision(input: PolicyDecisionInput): PolicyInjectionDecision {
        const { sessionKey, hasSessionIdentity, provider, policy } = input;
        this.prune();

        if (!hasSessionIdentity) {
            return "full";
        }

        const profile = this.resolveProfile(policy);
        if (profile === "strict") {
            return "full";
        }

        const begin = this.beginTurn(
            sessionKey,
            provider,
            Math.max(1, policy.adaptive.staleAfterMinutes) * 60_000
        );

        if (begin.providerChanged) {
            this.markModelSwap(sessionKey, policy.adaptive.escalationTurns);
            return "full";
        }

        if (begin.isNew) {
            if (profile === "minimal") {
                return "none";
            }
            return "full";
        }

        if (this.consumeForcedFullTurns(sessionKey)) {
            return "full";
        }

        if (policy.adaptive.allowGlobalEscalation && this.consumeGlobalForcedFullTurns()) {
            return "full";
        }

        const heartbeat = Math.max(0, policy.adaptive.heartbeatEveryTurns);
        const isHeartbeatTurn = heartbeat > 0 && (begin.turnCount % heartbeat === 0);

        if (profile === "balanced" && (begin.isStale || isHeartbeatTurn)) {
            return "short";
        }

        if (profile === "minimal" && isHeartbeatTurn) {
            return "short";
        }

        if (profile === "minimal" || profile === "balanced") {
            return "none";
        }

        return "none";
    }

    public markInjected(sessionKey: string): void {
        const entry = this.state.get(sessionKey);
        if (!entry) return;
        entry.lastInjectedAt = this.now();
    }

    public delete(sessionKey: string): void {
        this.state.delete(sessionKey);
    }

    public size(): number {
        return this.state.size;
    }

    public prune(): PolicyStateStats {
        const nowTs = this.now();
        let removedExpired = 0;
        let removedOverflow = 0;

        for (const [key, value] of this.state.entries()) {
            if (this.isExpired(value.lastSeenAt, nowTs)) {
                this.state.delete(key);
                removedExpired += 1;
            }
        }

        if (this.state.size > this.maxEntries) {
            const overflow = this.state.size - this.maxEntries;
            const oldestFirst = [...this.state.entries()]
                .sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt)
                .slice(0, overflow);

            for (const [key] of oldestFirst) {
                if (this.state.delete(key)) {
                    removedOverflow += 1;
                }
            }
        }

        return { removedExpired, removedOverflow };
    }

    private beginTurn(sessionKey: string, provider: string | undefined, staleAfterMs: number): BeginTurnResult {
        const nowTs = this.now();
        const existing = this.state.get(sessionKey);

        if (!existing) {
            this.state.set(sessionKey, {
                firstSeenAt: nowTs,
                lastSeenAt: nowTs,
                turnCount: 1,
                forcedFullTurnsRemaining: 0,
                escalationLevel: 0,
                lastProvider: provider,
            });
            return {
                isNew: true,
                isStale: false,
                providerChanged: false,
                turnCount: 1,
            };
        }

        const previousSeenAt = existing.lastSeenAt;
        const providerChanged = Boolean(provider && existing.lastProvider && provider !== existing.lastProvider);

        existing.lastSeenAt = nowTs;
        existing.turnCount += 1;
        if (provider) {
            existing.lastProvider = provider;
        }

        return {
            isNew: false,
            isStale: (nowTs - previousSeenAt) > staleAfterMs,
            providerChanged,
            turnCount: existing.turnCount,
        };
    }

    private forceFullTurns(sessionKey: string | undefined, turns: number, allowGlobalEscalation: boolean): void {
        const normalizedTurns = Math.max(1, Math.floor(turns));
        if (!sessionKey) {
            if (!allowGlobalEscalation) {
                return;
            }
            this.globalForcedFullTurnsRemaining = Math.max(this.globalForcedFullTurnsRemaining, normalizedTurns);
            return;
        }

        const nowTs = this.now();
        const current = this.state.get(sessionKey) ?? {
            firstSeenAt: nowTs,
            lastSeenAt: nowTs,
            turnCount: 0,
            forcedFullTurnsRemaining: 0,
            escalationLevel: 0,
            lastProvider: undefined,
        };

        current.forcedFullTurnsRemaining = Math.max(
            current.forcedFullTurnsRemaining,
            normalizedTurns
        );
        current.escalationLevel += 1;
        current.lastSeenAt = nowTs;

        this.state.set(sessionKey, current);
    }

    private consumeForcedFullTurns(sessionKey: string): boolean {
        const entry = this.state.get(sessionKey);
        if (!entry || entry.forcedFullTurnsRemaining <= 0) {
            return false;
        }

        entry.forcedFullTurnsRemaining -= 1;
        return true;
    }

    private consumeGlobalForcedFullTurns(): boolean {
        if (this.globalForcedFullTurnsRemaining <= 0) {
            return false;
        }

        this.globalForcedFullTurnsRemaining -= 1;
        return true;
    }

    private resolveProfile(policy: BerryShieldPolicyConfig): BerryShieldPolicyProfile {
        return policy.profile;
    }

    private isExpired(ts: number, nowTs: number): boolean {
        return (nowTs - ts) > this.ttlMs;
    }
}
