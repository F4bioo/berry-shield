import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { registerBerryRoot } from "../src/layers/root";
import { HOOKS } from "../src/constants";
import type { BerryShieldPluginConfig } from "../src/types/config";
import { resetSharedPolicyStateManagerForTests } from "../src/policy/runtime-state";

type RootHandler = (event: unknown, ctx: { sessionId?: string; sessionKey?: string; messageProvider?: string }) => { prependContext?: string } | void;
type SessionEndHandler = (event: { sessionId: string }) => void;

function createConfig(
    profile: BerryShieldPluginConfig["policy"]["profile"] = "balanced",
    rootEnabled = true,
): BerryShieldPluginConfig {
    return {
        mode: "enforce",
        layers: { root: rootEnabled, pulp: true, thorn: true, leaf: true, stem: true },
        policy: {
            profile,
            adaptive: {
                staleAfterMinutes: 30,
                escalationTurns: 3,
                heartbeatEveryTurns: 0,
                allowGlobalEscalation: false,
            },
            retention: {
                maxEntries: 100,
                ttlSeconds: 60,
            },
        },
        sensitiveFilePaths: [],
        destructiveCommands: [],
    };
}

function createApi() {
    const handlers = new Map<string, (...args: any[]) => any>();
    return {
        handlers,
        api: {
            on: vi.fn((hook: string, handler: (...args: any[]) => any) => handlers.set(hook, handler)),
            logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
        },
    };
}

function getRootHandler(handlers: Map<string, (...args: any[]) => any>): RootHandler {
    const handler = handlers.get(HOOKS.BEFORE_AGENT_START);
    if (!handler) throw new Error("before_agent_start handler not registered");
    return handler as RootHandler;
}

function getSessionEndHandler(handlers: Map<string, (...args: any[]) => any>): SessionEndHandler {
    const handler = handlers.get(HOOKS.SESSION_END);
    if (!handler) throw new Error("session_end handler not registered");
    return handler as SessionEndHandler;
}

describe("Berry.Root adaptive injection strategy", () => {
    beforeEach(() => {
        resetSharedPolicyStateManagerForTests();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("does not register when root layer is disabled", () => {
        const { api } = createApi();
        registerBerryRoot(api as any, createConfig("balanced", false));
        expect(api.on).not.toHaveBeenCalled();
    });

    it("strict profile injects full policy on every turn", () => {
        const { api, handlers } = createApi();
        registerBerryRoot(api as any, createConfig("strict"));
        const handler = getRootHandler(handlers);

        const first = handler({}, { sessionId: "s1" });
        const second = handler({}, { sessionId: "s1" });

        expect(first?.prependContext).toContain("SECURITY RULES - You MUST follow these rules at all times:");
        expect(second?.prependContext).toContain("SECURITY RULES - You MUST follow these rules at all times:");
    });

    it("balanced profile injects full then none by default", () => {
        const { api, handlers } = createApi();
        registerBerryRoot(api as any, createConfig("balanced"));
        const handler = getRootHandler(handlers);

        const first = handler({}, { sessionId: "s1", sessionKey: "s1", messageProvider: "openai" });
        const second = handler({}, { sessionId: "s1", sessionKey: "s1", messageProvider: "openai" });

        expect(first?.prependContext).toContain("SECURITY RULES - You MUST follow these rules at all times:");
        expect(second).toBeUndefined();
    });

    it("minimal profile stays silent by default", () => {
        const { api, handlers } = createApi();
        registerBerryRoot(api as any, createConfig("minimal"));
        const handler = getRootHandler(handlers);

        const first = handler({}, { sessionId: "s1" });
        const second = handler({}, { sessionId: "s1" });

        expect(first).toBeUndefined();
        expect(second).toBeUndefined();
    });

    it("returns short reminder after stale inactivity", () => {
        const { api, handlers } = createApi();
        const config = createConfig("balanced");
        config.policy.adaptive.staleAfterMinutes = 1;
        config.policy.retention.ttlSeconds = 3600;
        registerBerryRoot(api as any, config);
        const handler = getRootHandler(handlers);

        handler({}, { sessionId: "s1", sessionKey: "s1", messageProvider: "openai" });
        vi.advanceTimersByTime(61_000);
        const afterStale = handler({}, { sessionId: "s1", sessionKey: "s1", messageProvider: "openai" });

        expect(afterStale?.prependContext).toContain("SECURITY REMINDER: You MUST call `berry_check` before any exec/read operation.");
    });

    it("minimal profile keeps silent after stale inactivity without heartbeat", () => {
        const { api, handlers } = createApi();
        const config = createConfig("minimal");
        config.policy.adaptive.staleAfterMinutes = 1;
        config.policy.retention.ttlSeconds = 3600;
        registerBerryRoot(api as any, config);
        const handler = getRootHandler(handlers);

        handler({}, { sessionId: "s1", sessionKey: "s1", messageProvider: "openai" });
        vi.advanceTimersByTime(61_000);
        const afterStale = handler({}, { sessionId: "s1", sessionKey: "s1", messageProvider: "openai" });

        expect(afterStale).toBeUndefined();
    });

    it("falls back to full policy when session id is missing", () => {
        const { api, handlers } = createApi();
        registerBerryRoot(api as any, createConfig("minimal"));
        const handler = getRootHandler(handlers);

        const first = handler({}, {});
        const second = handler({}, {});

        expect(first?.prependContext).toContain("SECURITY RULES - You MUST follow these rules at all times:");
        expect(second?.prependContext).toContain("SECURITY RULES - You MUST follow these rules at all times:");
        expect(api.logger.warn).toHaveBeenCalled();
    });

    it("provider swap re-injects full policy", () => {
        const { api, handlers } = createApi();
        registerBerryRoot(api as any, createConfig("balanced"));
        const handler = getRootHandler(handlers);

        handler({}, { sessionId: "s1", sessionKey: "s1", messageProvider: "openai" });
        handler({}, { sessionId: "s1", sessionKey: "s1", messageProvider: "openai" });
        const swapped = handler({}, { sessionId: "s1", sessionKey: "s1", messageProvider: "anthropic" });

        expect(swapped?.prependContext).toContain("SECURITY RULES - You MUST follow these rules at all times:");
    });

    it("clears session state on session_end", () => {
        const { api, handlers } = createApi();
        registerBerryRoot(api as any, createConfig("balanced"));
        const rootHandler = getRootHandler(handlers);
        const sessionEndHandler = getSessionEndHandler(handlers);

        rootHandler({}, { sessionId: "s1", sessionKey: "s1", messageProvider: "openai" });
        rootHandler({}, { sessionId: "s1", sessionKey: "s1", messageProvider: "openai" });
        sessionEndHandler({ sessionId: "s1" });
        const afterEnd = rootHandler({}, { sessionId: "s1", sessionKey: "s1", messageProvider: "openai" });

        expect(afterEnd?.prependContext).toContain("SECURITY RULES - You MUST follow these rules at all times:");
    });
});
