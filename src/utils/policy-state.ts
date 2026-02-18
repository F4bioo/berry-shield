import type { BerryShieldPolicyRetentionConfig } from "../types/config.js";

type NowFn = () => number;

export interface PolicyStateStats {
    removedExpired: number;
    removedOverflow: number;
}

/**
 * Tracks per-session policy injection timestamps with bounded memory usage.
 */
export class PolicyStateManager {
    private readonly state = new Map<string, number>();
    private readonly maxEntries: number;
    private readonly ttlMs: number;
    private readonly now: NowFn;

    constructor(retention: BerryShieldPolicyRetentionConfig, now: NowFn = Date.now) {
        this.maxEntries = Math.max(1, Math.floor(retention.maxEntries));
        this.ttlMs = Math.max(1, Math.floor(retention.ttlSeconds * 1000));
        this.now = now;
    }

    public markInjected(sessionKey: string): void {
        this.state.set(sessionKey, this.now());
        this.prune();
    }

    public hasActiveSession(sessionKey: string): boolean {
        const ts = this.state.get(sessionKey);
        if (ts === undefined) return false;

        if (this.isExpired(ts, this.now())) {
            this.state.delete(sessionKey);
            return false;
        }

        return true;
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

        for (const [key, ts] of this.state.entries()) {
            if (this.isExpired(ts, nowTs)) {
                this.state.delete(key);
                removedExpired += 1;
            }
        }

        if (this.state.size > this.maxEntries) {
            const overflow = this.state.size - this.maxEntries;
            const oldestFirst = [...this.state.entries()]
                .sort((a, b) => a[1] - b[1])
                .slice(0, overflow);

            for (const [key] of oldestFirst) {
                if (this.state.delete(key)) {
                    removedOverflow += 1;
                }
            }
        }

        return { removedExpired, removedOverflow };
    }

    private isExpired(ts: number, nowTs: number): boolean {
        return (nowTs - ts) > this.ttlMs;
    }
}
