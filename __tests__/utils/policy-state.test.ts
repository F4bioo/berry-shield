import { describe, expect, it } from "vitest";
import { PolicyStateManager } from "../../src/utils/policy-state";

describe("PolicyStateManager", () => {
    it("keeps session active within ttl and expires after ttl", () => {
        let nowTs = 1_000;
        const manager = new PolicyStateManager(
            { maxEntries: 10, ttlSeconds: 60 },
            () => nowTs
        );

        manager.markInjected("session-a");
        expect(manager.hasActiveSession("session-a")).toBe(true);

        nowTs += 60_000;
        expect(manager.hasActiveSession("session-a")).toBe(true);

        nowTs += 1;
        expect(manager.hasActiveSession("session-a")).toBe(false);
        expect(manager.size()).toBe(0);
    });

    it("prunes expired entries", () => {
        let nowTs = 0;
        const manager = new PolicyStateManager(
            { maxEntries: 10, ttlSeconds: 10 },
            () => nowTs
        );

        manager.markInjected("a"); // t=0
        nowTs = 5_000;
        manager.markInjected("b"); // t=5000
        nowTs = 20_000;
        manager.markInjected("c"); // t=20000, triggers prune

        const stats = manager.prune();
        expect(stats.removedExpired).toBe(0);
        expect(manager.hasActiveSession("a")).toBe(false);
        expect(manager.hasActiveSession("b")).toBe(false);
        expect(manager.hasActiveSession("c")).toBe(true);
        expect(manager.size()).toBe(1);
    });

    it("keeps newest entries when size exceeds maxEntries", () => {
        let nowTs = 1;
        const manager = new PolicyStateManager(
            { maxEntries: 2, ttlSeconds: 10_000 },
            () => nowTs
        );

        manager.markInjected("a"); // 1
        nowTs = 2;
        manager.markInjected("b"); // 2
        nowTs = 10;
        manager.markInjected("a"); // refresh a => 10
        nowTs = 11;
        manager.markInjected("c"); // 11, prune oldest by timestamp

        expect(manager.hasActiveSession("a")).toBe(true);
        expect(manager.hasActiveSession("b")).toBe(false);
        expect(manager.hasActiveSession("c")).toBe(true);
        expect(manager.size()).toBe(2);
    });
});
