import { describe, expect, it } from "vitest";
import { PolicyStateManager } from "../src/utils/policy-state";
import type { BerryShieldPolicyConfig } from "../src/types/config";

function createPolicy(overrides?: Partial<BerryShieldPolicyConfig>): BerryShieldPolicyConfig {
    return {
        profile: "balanced",
        adaptive: {
            staleAfterMinutes: 30,
            escalationTurns: 3,
            heartbeatEveryTurns: 0,
            allowGlobalEscalation: false,
        },
        retention: {
            maxEntries: 10,
            ttlSeconds: 60,
        },
        ...overrides,
    };
}

describe("PolicyStateManager", () => {
    it("returns full on first turn and none on subsequent balanced turns", () => {
        let nowTs = 1_000;
        const manager = new PolicyStateManager({ maxEntries: 10, ttlSeconds: 60 }, () => nowTs);
        const policy = createPolicy();

        const first = manager.consumeTurnDecision({
            sessionKey: "a",
            hasSessionIdentity: true,
            provider: "openai",
            policy,
        });
        manager.markInjected("a");

        const second = manager.consumeTurnDecision({
            sessionKey: "a",
            hasSessionIdentity: true,
            provider: "openai",
            policy,
        });

        expect(first).toBe("full");
        expect(second).toBe("none");
    });

    it("forces full when session identity is missing", () => {
        const manager = new PolicyStateManager({ maxEntries: 10, ttlSeconds: 60 });
        const decision = manager.consumeTurnDecision({
            sessionKey: "global_session",
            hasSessionIdentity: false,
            provider: undefined,
            policy: createPolicy(),
        });
        expect(decision).toBe("full");
    });

    it("minimal profile is silent on first turn by default", () => {
        const manager = new PolicyStateManager({ maxEntries: 10, ttlSeconds: 60 });
        const policy = createPolicy({ profile: "minimal" });

        const first = manager.consumeTurnDecision({
            sessionKey: "s1",
            hasSessionIdentity: true,
            provider: "openai",
            policy,
        });

        expect(first).toBe("none");
    });

    it("escalates to full after denied signal", () => {
        const manager = new PolicyStateManager({ maxEntries: 10, ttlSeconds: 60 });
        const policy = createPolicy();

        manager.consumeTurnDecision({
            sessionKey: "s1",
            hasSessionIdentity: true,
            provider: "openai",
            policy,
        });
        manager.markInjected("s1");

        manager.markDenied("s1", 2);
        const firstEscalated = manager.consumeTurnDecision({
            sessionKey: "s1",
            hasSessionIdentity: true,
            provider: "openai",
            policy,
        });
        const secondEscalated = manager.consumeTurnDecision({
            sessionKey: "s1",
            hasSessionIdentity: true,
            provider: "openai",
            policy,
        });
        const afterEscalation = manager.consumeTurnDecision({
            sessionKey: "s1",
            hasSessionIdentity: true,
            provider: "openai",
            policy,
        });

        expect(firstEscalated).toBe("full");
        expect(secondEscalated).toBe("full");
        expect(afterEscalation).toBe("none");
    });

    it("does not trigger global escalation when session key is missing", () => {
        const manager = new PolicyStateManager({ maxEntries: 10, ttlSeconds: 60 });
        const policy = createPolicy();

        manager.consumeTurnDecision({
            sessionKey: "s1",
            hasSessionIdentity: true,
            provider: "openai",
            policy,
        });
        manager.markInjected("s1");

        manager.markDenied(undefined, 2, false);
        const decision = manager.consumeTurnDecision({
            sessionKey: "s1",
            hasSessionIdentity: true,
            provider: "openai",
            policy,
        });

        expect(decision).toBe("none");
    });

    it("supports explicit global escalation when enabled", () => {
        const manager = new PolicyStateManager({ maxEntries: 10, ttlSeconds: 60 });
        const policy = createPolicy({
            adaptive: {
                staleAfterMinutes: 30,
                escalationTurns: 3,
                heartbeatEveryTurns: 0,
                allowGlobalEscalation: true,
            },
        });

        manager.consumeTurnDecision({
            sessionKey: "s1",
            hasSessionIdentity: true,
            provider: "openai",
            policy,
        });
        manager.markInjected("s1");

        manager.markDenied(undefined, 1, true);
        const decision = manager.consumeTurnDecision({
            sessionKey: "s1",
            hasSessionIdentity: true,
            provider: "openai",
            policy,
        });

        expect(decision).toBe("full");
    });

    it("returns short on stale sessions", () => {
        let nowTs = 0;
        const manager = new PolicyStateManager({ maxEntries: 10, ttlSeconds: 120 }, () => nowTs);
        const policy = createPolicy({
            adaptive: {
                staleAfterMinutes: 1,
                escalationTurns: 3,
                heartbeatEveryTurns: 0,
                allowGlobalEscalation: false,
            },
        });

        manager.consumeTurnDecision({
            sessionKey: "s1",
            hasSessionIdentity: true,
            provider: "openai",
            policy,
        });
        manager.markInjected("s1");

        nowTs = 61_000;
        const staleDecision = manager.consumeTurnDecision({
            sessionKey: "s1",
            hasSessionIdentity: true,
            provider: "openai",
            policy,
        });

        expect(staleDecision).toBe("short");
    });

    it("minimal profile does not emit short on stale session without heartbeat", () => {
        let nowTs = 0;
        const manager = new PolicyStateManager({ maxEntries: 10, ttlSeconds: 120 }, () => nowTs);
        const policy = createPolicy({
            profile: "minimal",
            adaptive: {
                staleAfterMinutes: 1,
                escalationTurns: 3,
                heartbeatEveryTurns: 0,
                allowGlobalEscalation: false,
            },
        });

        manager.consumeTurnDecision({
            sessionKey: "s1",
            hasSessionIdentity: true,
            provider: "openai",
            policy,
        });
        manager.markInjected("s1");

        nowTs = 61_000;
        const staleDecision = manager.consumeTurnDecision({
            sessionKey: "s1",
            hasSessionIdentity: true,
            provider: "openai",
            policy,
        });

        expect(staleDecision).toBe("none");
    });

    it("triggers full on provider/model swap", () => {
        const manager = new PolicyStateManager({ maxEntries: 10, ttlSeconds: 120 });
        const policy = createPolicy();

        manager.consumeTurnDecision({
            sessionKey: "s1",
            hasSessionIdentity: true,
            provider: "openai",
            policy,
        });
        manager.markInjected("s1");
        manager.consumeTurnDecision({
            sessionKey: "s1",
            hasSessionIdentity: true,
            provider: "openai",
            policy,
        });

        const changed = manager.consumeTurnDecision({
            sessionKey: "s1",
            hasSessionIdentity: true,
            provider: "anthropic",
            policy,
        });
        expect(changed).toBe("full");
    });
});
