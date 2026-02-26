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

        handlers.get(HOOKS.TOOL_RESULT_PERSIST)?.({
            toolName: "browser_fetch",
            toolCallId: "tc-balanced-1",
            message: [{ type: "text", text: "external" }],
        }, { toolName: "browser_fetch", sessionKey: "s1" });

        const result = handlers.get(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: "rm -rf /tmp" },
        }, { sessionKey: "s1" });

        expect(result?.block).toBe(true);
    });

    it("enforce blocks write-like exec after external signal", () => {
        const { api, handlers } = createApi();
        registerBerryVine(api as any, createConfig({
            mode: "enforce",
            vine: { mode: "strict" },
        }));

        handlers.get(HOOKS.TOOL_RESULT_PERSIST)?.({
            toolName: "web_search",
            toolCallId: "tc-strict-1",
            message: [{ type: "text", text: "external" }],
        }, { toolName: "web_search", sessionKey: "s1" });

        const result = handlers.get(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: "bash -lc 'echo VINE > /tmp/vine-only.txt'" },
        }, { sessionKey: "s1" });

        expect(result?.block).toBe(true);
        const lastEvent = appendAuditEventMock.mock.calls.at(-1)?.[0];
        expect(lastEvent?.layer).toBe("vine");
        expect(lastEvent?.decision).toBe("blocked");
    });

    it("audit never blocks sensitive action but emits would_block", () => {
        const { api, handlers } = createApi();
        registerBerryVine(api as any, createConfig({
            mode: "audit",
            vine: { mode: "balanced" },
        }));

        handlers.get(HOOKS.TOOL_RESULT_PERSIST)?.({
            toolName: "browser_fetch",
            toolCallId: "tc-audit-1",
            message: [{ type: "text", text: "external" }],
        }, { toolName: "browser_fetch", sessionKey: "s1" });

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

    it("audit emits would_block for write-like exec after external signal", () => {
        const { api, handlers } = createApi();
        registerBerryVine(api as any, createConfig({
            mode: "audit",
            vine: { mode: "strict" },
        }));

        handlers.get(HOOKS.TOOL_RESULT_PERSIST)?.({
            toolName: "web_search",
            toolCallId: "tc-audit-2",
            message: [{ type: "text", text: "external" }],
        }, { toolName: "web_search", sessionKey: "s1" });

        const result = handlers.get(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: "echo \"VINE\" >> /tmp/vine-only.txt" },
        }, { sessionKey: "s1" });

        expect(result).toBeUndefined();
        const lastEvent = appendAuditEventMock.mock.calls.at(-1)?.[0];
        expect(lastEvent?.layer).toBe("vine");
        expect(lastEvent?.decision).toBe("would_block");
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

        handlers.get(HOOKS.TOOL_RESULT_PERSIST)?.({
            toolName: "browser_fetch",
            toolCallId: "tc-session-end",
            message: [{ type: "text", text: "external" }],
        }, { toolName: "browser_fetch", sessionKey: "s1" });

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

    it("respects runtime global mode updates and does not block in audit", () => {
        const { api, handlers } = createApi();

        // Register with ENFORCE (runtime snapshot captured in hook closures).
        const snapshotConfig = createConfig({
            mode: "enforce",
            vine: { mode: "strict" },
        });
        registerBerryVine(api as any, snapshotConfig);

        handlers.get(HOOKS.TOOL_RESULT_PERSIST)?.({
            toolName: "web_search",
            toolCallId: "tc-runtime-audit",
            message: [{ type: "text", text: "external" }],
        }, { toolName: "web_search", sessionKey: "s1" });

        // Simulate operator changed mode to AUDIT after registration.
        (api as any).pluginConfig = { mode: "audit" };

        const result = handlers.get(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: "bash -lc 'echo VINE > /tmp/vine-red.txt'" },
        }, { sessionKey: "s1" });

        expect(result).toBeUndefined();
        const lastEvent = appendAuditEventMock.mock.calls.at(-1)?.[0];
        expect(lastEvent?.layer).toBe("vine");
        expect(lastEvent?.decision).toBe("would_block");
    });

    it("marks risk from tool_result_persist even when after_tool_call has no session context", () => {
        const { api, handlers } = createApi();
        registerBerryVine(api as any, createConfig({
            mode: "enforce",
            vine: {
                mode: "strict",
                thresholds: {
                    externalSignalsToEscalate: 1,
                    forcedGuardTurns: 1,
                },
            },
        }));

        handlers.get(HOOKS.AFTER_TOOL_CALL)?.({
            toolName: "web_fetch",
            params: { url: "https://example.com", mode: "markdown" },
            result: { externalContent: { untrusted: true } },
        }, { toolName: "web_fetch" });

        handlers.get(HOOKS.TOOL_RESULT_PERSIST)?.({
            toolName: "web_fetch",
            toolCallId: "tc1",
            message: [{ type: "text", text: "external result" }],
        }, {
            toolName: "web_fetch",
            sessionKey: "s1",
        });

        const result = handlers.get(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: "bash -lc 'echo VINE > /tmp/vine-proof.txt'" },
        }, { sessionKey: "s1", agentId: "agent-main" });

        expect(result?.block).toBe(true);
    });

    it("does not cross-contaminate concurrent sessions with tool_result_persist session keys", () => {
        const { api, handlers } = createApi();
        registerBerryVine(api as any, createConfig({
            mode: "enforce",
            vine: {
                mode: "strict",
                thresholds: {
                    externalSignalsToEscalate: 1,
                    forcedGuardTurns: 1,
                },
            },
        }));

        handlers.get(HOOKS.AFTER_TOOL_CALL)?.({
            toolName: "web_fetch",
            params: { url: "https://example.com/a" },
            result: { externalContent: { untrusted: true } },
        }, { toolName: "web_fetch" });

        handlers.get(HOOKS.TOOL_RESULT_PERSIST)?.({
            toolName: "web_fetch",
            toolCallId: "tcA",
            message: [{ type: "text", text: "external result A" }],
        }, {
            toolName: "web_fetch",
            sessionKey: "sA",
        });

        const blockedA = handlers.get(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: "bash -lc 'echo A > /tmp/vine-a.txt'" },
        }, { sessionKey: "sA", agentId: "agent-a" });

        const blockedB = handlers.get(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: "bash -lc 'echo B > /tmp/vine-b.txt'" },
        }, { sessionKey: "sB", agentId: "agent-b" });

        expect(blockedA?.block).toBe(true);
        expect(blockedB).toBeUndefined();
    });

    it("does not mark risk from tool_result_persist for non-external tools", () => {
        const { api, handlers } = createApi();
        registerBerryVine(api as any, createConfig({
            mode: "enforce",
            vine: {
                mode: "strict",
                thresholds: {
                    externalSignalsToEscalate: 1,
                    forcedGuardTurns: 1,
                },
            },
        }));

        handlers.get(HOOKS.TOOL_RESULT_PERSIST)?.({
            toolName: "session_status",
            toolCallId: "tc-no-risk",
            message: [{ type: "text", text: "status ok" }],
        }, {
            toolName: "session_status",
            sessionKey: "s1",
        });

        const result = handlers.get(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: "bash -lc 'echo SHOULD_PASS > /tmp/safe-no-risk.txt'" },
        }, { sessionKey: "s1", agentId: "agent-main" });

        expect(result).toBeUndefined();
    });

    it("balanced relaxes risk after safe turns without new external signals", () => {
        const { api, handlers } = createApi();
        registerBerryVine(api as any, createConfig({
            mode: "enforce",
            vine: {
                mode: "balanced",
                thresholds: {
                    externalSignalsToEscalate: 1,
                    forcedGuardTurns: 1,
                },
            },
        }));

        handlers.get(HOOKS.TOOL_RESULT_PERSIST)?.({
            toolName: "web_fetch",
            toolCallId: "tc-balanced-relax",
            message: [{ type: "text", text: "external" }],
        }, { toolName: "web_fetch", sessionKey: "s1" });

        handlers.get(HOOKS.BEFORE_AGENT_START)?.({
            prompt: "turn-1",
            messages: [],
        }, { sessionKey: "s1", sessionId: "sid-1" });

        handlers.get(HOOKS.MESSAGE_RECEIVED)?.({
            content: "ok, continue",
            from: "user",
        }, { channelId: "web", conversationId: "conv-1", sessionKey: "s1" });

        handlers.get(HOOKS.MESSAGE_RECEIVED)?.({
            content: "still safe",
            from: "user",
        }, { channelId: "web", conversationId: "conv-1", sessionKey: "s1" });

        const result = handlers.get(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: "bash -lc 'echo SAFE > /tmp/safe.txt'" },
        }, { sessionKey: "s1", agentId: "agent-main" });

        expect(result).toBeUndefined();
    });

    it("strict does not relax risk after safe turns only", () => {
        const { api, handlers } = createApi();
        registerBerryVine(api as any, createConfig({
            mode: "enforce",
            vine: {
                mode: "strict",
                thresholds: {
                    externalSignalsToEscalate: 1,
                    forcedGuardTurns: 1,
                },
            },
        }));

        handlers.get(HOOKS.TOOL_RESULT_PERSIST)?.({
            toolName: "web_fetch",
            toolCallId: "tc-strict-no-relax",
            message: [{ type: "text", text: "external" }],
        }, { toolName: "web_fetch", sessionKey: "s1" });

        handlers.get(HOOKS.BEFORE_AGENT_START)?.({
            prompt: "turn-1",
            messages: [],
        }, { sessionKey: "s1", sessionId: "sid-1" });

        handlers.get(HOOKS.MESSAGE_RECEIVED)?.({
            content: "ok, continue",
            from: "user",
        }, { channelId: "web", conversationId: "conv-1", sessionKey: "s1" });

        handlers.get(HOOKS.MESSAGE_RECEIVED)?.({
            content: "still safe",
            from: "user",
        }, { channelId: "web", conversationId: "conv-1", sessionKey: "s1" });

        const result = handlers.get(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: "bash -lc 'echo BLOCKED > /tmp/blocked.txt'" },
        }, { sessionKey: "s1", agentId: "agent-main" });

        expect(result?.block).toBe(true);
    });
});
