import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { registerBerryRoot } from "../../src/layers/root";
import { HOOKS } from "../../src/constants";
import type { BerryShieldPluginConfig } from "../../src/types/config";

type RootHandler = (event: unknown, ctx: { sessionId?: string; sessionKey?: string }) => { prependContext?: string } | void;
type SessionEndHandler = (event: { sessionId: string }) => void;

function createConfig(
    injectionMode: BerryShieldPluginConfig["policy"]["injectionMode"] = "session_full_plus_reminder",
    rootEnabled = true,
): BerryShieldPluginConfig {
    return {
        mode: "enforce",
        layers: {
            root: rootEnabled,
            pulp: true,
            thorn: true,
            leaf: true,
            stem: true,
        },
        policy: {
            injectionMode,
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
            on: vi.fn((hook: string, handler: (...args: any[]) => any) => {
                handlers.set(hook, handler);
            }),
            logger: {
                debug: vi.fn(),
                warn: vi.fn(),
                info: vi.fn(),
                error: vi.fn(),
            },
        },
    };
}

function getRootHandler(handlers: Map<string, (...args: any[]) => any>): RootHandler {
    const handler = handlers.get(HOOKS.BEFORE_AGENT_START);
    if (!handler) throw new Error("before_agent_start handler not registered");
    return handler as RootHandler;
}

function getSessionEndHandler(handlers: Map<string, (...args: any[]) => any>): SessionEndHandler {
    const handler = handlers.get("session_end");
    if (!handler) throw new Error("session_end handler not registered");
    return handler as SessionEndHandler;
}

describe("Berry.Root injection strategy", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("does not register when root layer is disabled", () => {
        const { api } = createApi();
        registerBerryRoot(api as any, createConfig("session_full_plus_reminder", false));

        expect(api.on).not.toHaveBeenCalled();
    });

    it("injects full policy on every turn in always_full mode", () => {
        const { api, handlers } = createApi();
        registerBerryRoot(api as any, createConfig("always_full"));
        const handler = getRootHandler(handlers);

        const first = handler({}, { sessionId: "session-a" });
        const second = handler({}, { sessionId: "session-a" });

        expect(first?.prependContext).toContain("SECURITY RULES - You MUST follow these rules at all times:");
        expect(second?.prependContext).toContain("SECURITY RULES - You MUST follow these rules at all times:");
    });

    it("injects full then short in session_full_plus_reminder mode", () => {
        const { api, handlers } = createApi();
        registerBerryRoot(api as any, createConfig("session_full_plus_reminder"));
        const handler = getRootHandler(handlers);

        const first = handler({}, { sessionId: "session-a" });
        const second = handler({}, { sessionId: "session-a" });

        expect(first?.prependContext).toContain("SECURITY RULES - You MUST follow these rules at all times:");
        expect(second?.prependContext).toContain("SECURITY REMINDER: You MUST call `berry_check` before any exec/read operation.");
    });

    it("injects full then nothing in session_full_only mode", () => {
        const { api, handlers } = createApi();
        registerBerryRoot(api as any, createConfig("session_full_only"));
        const handler = getRootHandler(handlers);

        const first = handler({}, { sessionId: "session-a" });
        const second = handler({}, { sessionId: "session-a" });

        expect(first?.prependContext).toContain("SECURITY RULES - You MUST follow these rules at all times:");
        expect(second).toBeUndefined();
    });

    it("injects full for a new session even if previous session is active", () => {
        const { api, handlers } = createApi();
        registerBerryRoot(api as any, createConfig("session_full_plus_reminder"));
        const handler = getRootHandler(handlers);

        handler({}, { sessionId: "session-a" });
        const secondSame = handler({}, { sessionId: "session-a" });
        const firstOther = handler({}, { sessionId: "session-b" });

        expect(secondSame?.prependContext).toContain("SECURITY REMINDER");
        expect(firstOther?.prependContext).toContain("SECURITY RULES - You MUST follow these rules at all times:");
    });

    it("falls back to always_full and warns when session id is missing", () => {
        const { api, handlers } = createApi();
        registerBerryRoot(api as any, createConfig("session_full_only"));
        const handler = getRootHandler(handlers);

        const first = handler({}, {});
        const second = handler({}, {});

        expect(first?.prependContext).toContain("SECURITY RULES - You MUST follow these rules at all times:");
        expect(second?.prependContext).toContain("SECURITY RULES - You MUST follow these rules at all times:");
        expect(api.logger.warn).toHaveBeenCalled();
    });

    it("re-injects full policy after ttl expiration", () => {
        const { api, handlers } = createApi();
        const config = createConfig("session_full_plus_reminder");
        config.policy.retention.ttlSeconds = 1;
        registerBerryRoot(api as any, config);
        const handler = getRootHandler(handlers);

        const first = handler({}, { sessionId: "session-a" });
        const second = handler({}, { sessionId: "session-a" });

        vi.advanceTimersByTime(1_001);
        const afterTtl = handler({}, { sessionId: "session-a" });

        expect(first?.prependContext).toContain("SECURITY RULES - You MUST follow these rules at all times:");
        expect(second?.prependContext).toContain("SECURITY REMINDER");
        expect(afterTtl?.prependContext).toContain("SECURITY RULES - You MUST follow these rules at all times:");
    });

    it("clears session state on session_end", () => {
        const { api, handlers } = createApi();
        registerBerryRoot(api as any, createConfig("session_full_plus_reminder"));
        const rootHandler = getRootHandler(handlers);
        const sessionEndHandler = getSessionEndHandler(handlers);

        const first = rootHandler({}, { sessionId: "session-a" });
        const second = rootHandler({}, { sessionId: "session-a" });
        sessionEndHandler({ sessionId: "session-a" });
        const afterEnd = rootHandler({}, { sessionId: "session-a" });

        expect(first?.prependContext).toContain("SECURITY RULES - You MUST follow these rules at all times:");
        expect(second?.prependContext).toContain("SECURITY REMINDER");
        expect(afterEnd?.prependContext).toContain("SECURITY RULES - You MUST follow these rules at all times:");
    });
});
