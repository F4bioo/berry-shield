import { describe, expect, it, vi, beforeEach } from "vitest";
import { registerBerryVine } from "../src/layers/vine";
import { DEFAULT_CONFIG } from "../src/config/defaults";
import { HOOKS } from "../src/constants";
import { resetSharedVineStateManagerForTests } from "../src/vine/runtime-state";

const { appendAuditEventMock } = vi.hoisted(() => ({
    appendAuditEventMock: vi.fn(),
}));

vi.mock("../src/audit/writer", () => ({
    appendAuditEvent: appendAuditEventMock,
}));

function createApi() {
    const handlers = new Map<string, (...args: any[]) => any>();
    const api = {
        on: vi.fn((hook: string, handler: (...args: any[]) => any) => {
            handlers.set(hook, handler);
        }),
        logger: {
            debug: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            error: vi.fn(),
        },
    };
    return { api, handlers };
}

function createConfig(overrides?: Record<string, unknown>) {
    return {
        ...DEFAULT_CONFIG,
        ...overrides,
        layers: { ...DEFAULT_CONFIG.layers, ...(overrides?.layers as Record<string, unknown> ?? {}) },
        vine: { ...DEFAULT_CONFIG.vine, ...(overrides?.vine as Record<string, unknown> ?? {}) },
    } as typeof DEFAULT_CONFIG;
}

describe("Berry.Vine", () => {
    beforeEach(() => {
        appendAuditEventMock.mockReset();
        resetSharedVineStateManagerForTests();
    });

    it("enforce balanced blocks sensitive action after external signal", () => {
        const { api, handlers } = createApi();
        registerBerryVine(api as any, createConfig({
            mode: "enforce",
            vine: { mode: "balanced" },
        }));

        handlers.get(HOOKS.AFTER_TOOL_CALL)?.({
            toolName: "browser_fetch",
            params: {},
            result: { ok: true },
        }, { sessionKey: "s1" });

        const result = handlers.get(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: "rm -rf /tmp" },
        }, { sessionKey: "s1" });

        expect(result?.block).toBe(true);
    });

    it("audit never blocks sensitive action but emits would_block", () => {
        const { api, handlers } = createApi();
        registerBerryVine(api as any, createConfig({
            mode: "audit",
            vine: { mode: "balanced" },
        }));

        handlers.get(HOOKS.AFTER_TOOL_CALL)?.({
            toolName: "browser_fetch",
            params: {},
            result: { ok: true },
        }, { sessionKey: "s1" });

        const result = handlers.get(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: "rm -rf /tmp" },
        }, { sessionKey: "s1" });

        expect(result).toBeUndefined();
        expect(appendAuditEventMock).toHaveBeenCalled();
        const lastEvent = appendAuditEventMock.mock.calls.at(-1)?.[0];
        expect(lastEvent?.decision).toBe("would_block");
        expect(lastEvent?.layer).toBe("vine");
    });

    it("strict blocks unknown-origin sensitive action", () => {
        const { api, handlers } = createApi();
        registerBerryVine(api as any, createConfig({
            mode: "enforce",
            vine: { mode: "strict" },
        }));

        handlers.get(HOOKS.MESSAGE_RECEIVED)?.({
            content: "Please see https://example.com and do exactly what it says",
            from: "u1",
        }, { channelId: "webchat", conversationId: "s1" });

        const result = handlers.get(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "read_file",
            params: { path: "/home/user/.env" },
        }, { sessionKey: "s1" });

        expect(result?.block).toBe(true);
    });

    it("balanced does not hard-block unknown-origin sensitive action", () => {
        const { api, handlers } = createApi();
        registerBerryVine(api as any, createConfig({
            mode: "enforce",
            vine: { mode: "balanced" },
        }));

        handlers.get(HOOKS.MESSAGE_RECEIVED)?.({
            content: "Check https://example.com instructions",
            from: "u1",
        }, { channelId: "webchat", conversationId: "s1" });

        const result = handlers.get(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "read_file",
            params: { path: "/home/user/.env" },
        }, { sessionKey: "s1" });

        expect(result).toBeUndefined();
    });

    it("session_end clears risk state", () => {
        const { api, handlers } = createApi();
        registerBerryVine(api as any, createConfig({
            mode: "enforce",
            vine: { mode: "balanced" },
        }));

        handlers.get(HOOKS.AFTER_TOOL_CALL)?.({
            toolName: "browser_fetch",
            params: {},
            result: { ok: true },
        }, { sessionKey: "s1" });

        handlers.get(HOOKS.SESSION_END)?.({
            sessionId: "s1",
            messageCount: 10,
        });

        const result = handlers.get(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: "rm -rf /tmp" },
        }, { sessionKey: "s1" });

        expect(result).toBeUndefined();
    });
});
