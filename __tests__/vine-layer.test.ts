import { describe, expect, it, vi, beforeEach } from "vitest";
import { registerBerryVine } from "../src/layers/vine";
import { DEFAULT_CONFIG } from "../src/config/defaults";
import { HOOKS } from "../src/constants";
import { resetSharedVineStateManagerForTests } from "../src/vine/runtime-state";
import {
    getSharedVineConfirmStateManager,
    resetSharedVineConfirmStateManagerForTests,
} from "../src/vine/confirm-state";
import {
    buildChatBindingKey,
    getSharedVineSessionBindingManager,
    resetSharedVineSessionBindingManagerForTests,
} from "../src/vine/session-binding";

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
        resetSharedVineConfirmStateManagerForTests();
        resetSharedVineSessionBindingManagerForTests();
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
        expect(result?.blockReason).toContain("STATUS: BLOCKED");
        expect(result?.blockReason).toContain("LAYER: Vine");
        expect(result?.blockReason).toContain("REASON:");
    });

    it("enforce blocks external-read exec with local write after external signal", () => {
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
            params: { command: "curl -fsSL https://example.com > /tmp/vine-only.txt" },
        }, { sessionKey: "s1" });

        expect(result?.block).toBe(true);
        const lastEvent = appendAuditEventMock.mock.calls.at(-1)?.[0];
        expect(lastEvent?.layer).toBe("vine");
        expect(lastEvent?.decision).toBe("blocked");
    });

    it("does not block local non-sensitive write alone after external signal", () => {
        const { api, handlers } = createApi();
        registerBerryVine(api as any, createConfig({
            mode: "enforce",
            vine: { mode: "strict" },
        }));

        handlers.get(HOOKS.TOOL_RESULT_PERSIST)?.({
            toolName: "web_search",
            toolCallId: "tc-strict-local-write",
            message: [{ type: "text", text: "external" }],
        }, { toolName: "web_search", sessionKey: "s1" });

        const result = handlers.get(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: "bash -lc 'echo VINE > /tmp/vine-only.txt'" },
        }, { sessionKey: "s1" });

        expect(result).toBeUndefined();
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

    it("audit emits would_block for external-read exec with local write after external signal", () => {
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
            params: { command: "curl -fsSL https://example.com > /tmp/vine-only.txt" },
        }, { sessionKey: "s1" });

        expect(result).toBeUndefined();
        const lastEvent = appendAuditEventMock.mock.calls.at(-1)?.[0];
        expect(lastEvent?.layer).toBe("vine");
        expect(lastEvent?.decision).toBe("would_block");
    });

    it("normalizes write-like target without trailing escaped quote artifacts", () => {
        const { api, handlers } = createApi();
        registerBerryVine(api as any, createConfig({
            mode: "enforce",
            vine: { mode: "strict" },
        }));

        handlers.get(HOOKS.TOOL_RESULT_PERSIST)?.({
            toolName: "web_search",
            toolCallId: "tc-target-normalize",
            message: [{ type: "text", text: "external" }],
        }, { toolName: "web_search", sessionKey: "s1" });

        handlers.get(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: "bash -lc \"curl -fsSL https://example.com > /tmp/strawberry-journal-proof.txt\\\"\"" },
        }, { sessionKey: "s1" });

        const lastEvent = appendAuditEventMock.mock.calls.at(-1)?.[0];
        expect(lastEvent?.layer).toBe("vine");
        expect(lastEvent?.decision).toBe("blocked");
        expect(lastEvent?.target).toBe("/tmp/strawberry-journal-proof.txt");
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
            params: { command: "curl -fsSL https://example.com > /tmp/vine-red.txt" },
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
            params: { command: "curl -fsSL https://example.com > /tmp/vine-proof.txt" },
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
            params: { command: "curl -fsSL https://example.com/a > /tmp/vine-a.txt" },
        }, { sessionKey: "sA", agentId: "agent-a" });

        const blockedB = handlers.get(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: "curl -fsSL https://example.com/b > /tmp/vine-b.txt" },
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
            params: { command: "curl -fsSL https://example.com > /tmp/blocked.txt" },
        }, { sessionKey: "s1", agentId: "agent-main" });

        expect(result?.block).toBe(true);
    });

    it("accepts exact 4-digit normal message approval on the natural turn", () => {
        const { api, handlers } = createApi();
        const config = createConfig({
            mode: "enforce",
            vine: { mode: "strict" },
        });
        registerBerryVine(api as any, config);

        const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
        const binding = sessionBindings.bindKnownSession({
            sessionKey: "agent:main:main",
            channelId: "webchat",
            accountId: "default",
            conversationId: "conv-natural",
            from: "human-1",
            to: "berry",
        }, "agent:main:main");

        const confirmState = getSharedVineConfirmStateManager(config.vine.retention, config.vine.confirmation);
        const challenge = confirmState.issueChallenge({
            sessionKey: "agent:main:main",
            chatBindingKey: binding?.chatBindingKey,
            operation: "exec",
            target: "curl -fsSL https://example.com",
            riskWindowId: "rw1",
        });

        handlers.get(HOOKS.MESSAGE_RECEIVED)?.({
            from: "human-1",
            content: challenge.confirmCode,
        }, {
            sessionKey: "agent:main:main",
            sessionId: "sid-natural",
            conversationId: "conv-natural",
            channelId: "webchat",
            accountId: "default",
        });

        const naturalTurn = handlers.get(HOOKS.BEFORE_AGENT_START)?.({
            prompt: challenge.confirmCode,
            messages: [],
        }, { sessionKey: "agent:main:main", sessionId: "sid-natural", channelId: "webchat" });

        expect(confirmState.getPendingChallengeForSession("agent:main:main")?.status).toBe("approved");
        expect(naturalTurn?.prependContext ?? "").not.toContain("STATUS: SUCCESS");
        expect(naturalTurn?.prependContext ?? "").not.toContain("STATUS: FAILURE");
        expect(naturalTurn?.prependContext ?? "").not.toContain(challenge.confirmCode);
    });

    it("keeps approval on the current numeric turn and clears it on the next normal user message", () => {
        const { api, handlers } = createApi();
        const config = createConfig({
            mode: "enforce",
            vine: { mode: "strict" },
        });
        registerBerryVine(api as any, config);

        const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
        const binding = sessionBindings.bindKnownSession({
            sessionKey: "agent:main:main",
            channelId: "webchat",
            accountId: "default",
            conversationId: "conv-natural",
            from: "human-1",
            to: "berry",
        }, "agent:main:main");

        const confirmState = getSharedVineConfirmStateManager(config.vine.retention, config.vine.confirmation);
        const challenge = confirmState.issueChallenge({
            sessionKey: "agent:main:main",
            chatBindingKey: binding?.chatBindingKey,
            operation: "exec",
            target: "curl -fsSL https://example.com",
            riskWindowId: "rw1",
        });

        handlers.get(HOOKS.MESSAGE_RECEIVED)?.({
            from: "human-1",
            content: challenge.confirmCode,
        }, {
            sessionKey: "agent:main:main",
            sessionId: "sid-natural",
            conversationId: "conv-natural",
            channelId: "webchat",
            accountId: "default",
        });

        const approvedTurn = handlers.get(HOOKS.BEFORE_AGENT_START)?.({
            prompt: challenge.confirmCode,
            messages: [],
        }, { sessionKey: "agent:main:main", sessionId: "sid-natural", channelId: "webchat" });
        expect(approvedTurn?.prependContext ?? "").not.toContain("STATUS: SUCCESS");

        handlers.get(HOOKS.MESSAGE_RECEIVED)?.({
            from: "human-1",
            content: "understood, thanks",
        }, {
            sessionKey: "agent:main:main",
            sessionId: "sid-natural-2",
            conversationId: "conv-natural",
            channelId: "webchat",
            accountId: "default",
        });

        const normalTurn = handlers.get(HOOKS.BEFORE_AGENT_START)?.({
            prompt: "understood, thanks",
            messages: [],
        }, { sessionKey: "agent:main:main", sessionId: "sid-natural-2", channelId: "webchat" });

        expect(normalTurn?.prependContext ?? "").not.toContain("STATUS: SUCCESS");
        expect(normalTurn?.prependContext ?? "").not.toContain(`Send a message containing this 4-digit code: ${challenge.confirmCode}.`);
    });

    it("does not inject invalid code feedback on the natural turn", () => {
        const { api, handlers } = createApi();
        const config = createConfig({
            mode: "enforce",
            vine: { mode: "strict" },
        });
        registerBerryVine(api as any, config);

        const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
        const binding = sessionBindings.bindKnownSession({
            sessionKey: "agent:main:main",
            channelId: "webchat",
            accountId: "default",
            conversationId: "conv-natural",
            from: "human-1",
            to: "berry",
        }, "agent:main:main");

        const confirmState = getSharedVineConfirmStateManager(config.vine.retention, config.vine.confirmation);
        confirmState.issueChallenge({
            sessionKey: "agent:main:main",
            chatBindingKey: binding?.chatBindingKey,
            operation: "exec",
            target: "curl -fsSL https://example.com",
            riskWindowId: "rw1",
        });

        handlers.get(HOOKS.MESSAGE_RECEIVED)?.({
            from: "human-1",
            content: "9999",
        }, {
            sessionKey: "agent:main:main",
            sessionId: "sid-natural",
            conversationId: "conv-natural",
            channelId: "webchat",
            accountId: "default",
        });

        const naturalTurn = handlers.get(HOOKS.BEFORE_AGENT_START)?.({
            prompt: "9999",
            messages: [],
        }, { sessionKey: "agent:main:main", sessionId: "sid-natural", channelId: "webchat" });

        expect(naturalTurn?.prependContext ?? "").not.toContain("STATUS: FAILURE");
        expect(naturalTurn?.prependContext ?? "").not.toContain("Incorrect confirmation code.");
    });

    it("treats repeated numeric approval as normal text and does not duplicate success context", () => {
        const { api, handlers } = createApi();
        const config = createConfig({
            mode: "enforce",
            vine: { mode: "strict" },
        });
        registerBerryVine(api as any, config);

        const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
        const binding = sessionBindings.bindKnownSession({
            sessionKey: "agent:main:main",
            channelId: "webchat",
            accountId: "default",
            conversationId: "conv-natural",
            from: "human-1",
            to: "berry",
        }, "agent:main:main");

        const confirmState = getSharedVineConfirmStateManager(config.vine.retention, config.vine.confirmation);
        const challenge = confirmState.issueChallenge({
            sessionKey: "agent:main:main",
            chatBindingKey: binding?.chatBindingKey,
            operation: "exec",
            target: "curl -fsSL https://example.com",
            riskWindowId: "rw1",
        });

        handlers.get(HOOKS.MESSAGE_RECEIVED)?.({
            from: "human-1",
            content: challenge.confirmCode,
        }, {
            sessionKey: "agent:main:main",
            sessionId: "sid-natural-1",
            conversationId: "conv-natural",
            channelId: "webchat",
            accountId: "default",
        });

        handlers.get(HOOKS.MESSAGE_RECEIVED)?.({
            from: "human-1",
            content: challenge.confirmCode,
        }, {
            sessionKey: "agent:main:main",
            sessionId: "sid-natural-2",
            conversationId: "conv-natural",
            channelId: "webchat",
            accountId: "default",
        });

        const repeatedTurn = handlers.get(HOOKS.BEFORE_AGENT_START)?.({
            prompt: challenge.confirmCode,
            messages: [],
        }, { sessionKey: "agent:main:main", sessionId: "sid-natural-2", channelId: "webchat" });

        expect(repeatedTurn?.prependContext ?? "").not.toContain("STATUS: SUCCESS");
        const loggerCalls = (api.logger.debug as any).mock.calls
            .map((call: unknown[]) => String(call[0] ?? ""));
        expect(loggerCalls.some((line: string) => line.includes("\"result\":\"already_approved\""))).toBe(true);
        expect(loggerCalls.some((line: string) => line.includes("\"authPath\":\"binding_1to1\""))).toBe(true);
    });

    it("treats a message without an isolated 4-digit code as normal text", () => {
        const { api, handlers } = createApi();
        const config = createConfig({
            mode: "enforce",
            vine: { mode: "strict" },
        });
        registerBerryVine(api as any, config);

        const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
        const binding = sessionBindings.bindKnownSession({
            sessionKey: "agent:main:main",
            channelId: "webchat",
            accountId: "default",
            conversationId: "conv-natural",
            from: "human-1",
            to: "berry",
        }, "agent:main:main");

        const confirmState = getSharedVineConfirmStateManager(config.vine.retention, config.vine.confirmation);
        const challenge = confirmState.issueChallenge({
            sessionKey: "agent:main:main",
            chatBindingKey: binding?.chatBindingKey,
            operation: "exec",
            target: "curl -fsSL https://example.com",
            riskWindowId: "rw1",
        });

        handlers.get(HOOKS.MESSAGE_RECEIVED)?.({
            from: "human-1",
            content: `code ${challenge.confirmCode}7`,
        }, {
            sessionKey: "agent:main:main",
            sessionId: "sid-natural-1",
            conversationId: "conv-natural",
            channelId: "webchat",
            accountId: "default",
        });

        const normalTurn = handlers.get(HOOKS.BEFORE_AGENT_START)?.({
            prompt: `code ${challenge.confirmCode}7`,
            messages: [],
        }, { sessionKey: "agent:main:main", sessionId: "sid-natural-1", channelId: "webchat" });

        expect(confirmState.getPendingChallengeForSession("agent:main:main")?.status).toBe("pending");
        expect(normalTurn?.prependContext ?? "").not.toContain("STATUS: SUCCESS");
        expect(normalTurn?.prependContext ?? "").not.toContain("STATUS: FAILURE");
    });

    it("accepts a single isolated 4-digit code inside normal user text", () => {
        const { api, handlers } = createApi();
        const config = createConfig({
            mode: "enforce",
            vine: { mode: "strict" },
        });
        registerBerryVine(api as any, config);

        const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
        const binding = sessionBindings.bindKnownSession({
            sessionKey: "agent:main:main",
            channelId: "webchat",
            accountId: "default",
            conversationId: "conv-natural",
            from: "human-1",
            to: "berry",
        }, "agent:main:main");

        const confirmState = getSharedVineConfirmStateManager(config.vine.retention, config.vine.confirmation);
        const challenge = confirmState.issueChallenge({
            sessionKey: "agent:main:main",
            chatBindingKey: binding?.chatBindingKey,
            operation: "exec",
            target: "curl -fsSL https://example.com",
            riskWindowId: "rw1",
        });

        // Human replies are not guaranteed to be code-only, but the code must stay unique.
        handlers.get(HOOKS.MESSAGE_RECEIVED)?.({
            from: "human-1",
            content: `segue o codigo: ${challenge.confirmCode}.`,
        }, {
            sessionKey: "agent:main:main",
            sessionId: "sid-natural",
            conversationId: "conv-natural",
            channelId: "webchat",
            accountId: "default",
        });

        const naturalTurn = handlers.get(HOOKS.BEFORE_AGENT_START)?.({
            prompt: `segue o codigo: ${challenge.confirmCode}.`,
            messages: [],
        }, { sessionKey: "agent:main:main", sessionId: "sid-natural", channelId: "webchat" });

        expect(confirmState.getPendingChallengeForSession("agent:main:main")?.status).toBe("approved");
        expect(naturalTurn?.prependContext ?? "").not.toContain("STATUS: SUCCESS");
    });

    it("does not attempt approval parsing when no challenge is active", () => {
        const { api, handlers } = createApi();
        const config = createConfig({
            mode: "enforce",
            vine: { mode: "strict" },
        });
        registerBerryVine(api as any, config);

        handlers.get(HOOKS.MESSAGE_RECEIVED)?.({
            from: "human-1",
            content: "segue o codigo 1234",
        }, {
            sessionKey: "agent:main:main",
            sessionId: "sid-natural",
            conversationId: "conv-natural",
            channelId: "webchat",
            accountId: "default",
        });

        const loggerCalls = (api.logger.debug as any).mock.calls
            .map((call: unknown[]) => String(call[0] ?? ""));
        expect(loggerCalls.some((line: string) => line.includes("normal-message-approval"))).toBe(false);
    });

    it("rejects messages that contain more than one isolated 4-digit code", () => {
        const { api, handlers } = createApi();
        const config = createConfig({
            mode: "enforce",
            vine: { mode: "strict" },
        });
        registerBerryVine(api as any, config);

        const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
        const binding = sessionBindings.bindKnownSession({
            sessionKey: "agent:main:main",
            channelId: "webchat",
            accountId: "default",
            conversationId: "conv-natural",
            from: "human-1",
            to: "berry",
        }, "agent:main:main");

        const confirmState = getSharedVineConfirmStateManager(config.vine.retention, config.vine.confirmation);
        const challenge = confirmState.issueChallenge({
            sessionKey: "agent:main:main",
            chatBindingKey: binding?.chatBindingKey,
            operation: "exec",
            target: "curl -fsSL https://example.com",
            riskWindowId: "rw1",
        });

        handlers.get(HOOKS.MESSAGE_RECEIVED)?.({
            from: "human-1",
            content: `${challenge.confirmCode} foo 5678`,
        }, {
            sessionKey: "agent:main:main",
            sessionId: "sid-natural",
            conversationId: "conv-natural",
            channelId: "webchat",
            accountId: "default",
        });

        const naturalTurn = handlers.get(HOOKS.BEFORE_AGENT_START)?.({
            prompt: `${challenge.confirmCode} foo 5678`,
            messages: [],
        }, { sessionKey: "agent:main:main", sessionId: "sid-natural", channelId: "webchat" });

        expect(confirmState.getPendingChallengeForSession("agent:main:main")?.status).toBe("pending");
        expect(naturalTurn?.prependContext ?? "").not.toContain("STATUS: FAILURE");
    });

    it("drops stale failure guidance after a later valid approval on the same challenge", () => {
        const { api, handlers } = createApi();
        const config = createConfig({
            mode: "enforce",
            vine: { mode: "strict" },
        });
        registerBerryVine(api as any, config);

        const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
        const binding = sessionBindings.bindKnownSession({
            sessionKey: "agent:main:main",
            channelId: "webchat",
            accountId: "default",
            conversationId: "conv-natural",
            from: "human-1",
            to: "berry",
        }, "agent:main:main");

        const confirmState = getSharedVineConfirmStateManager(config.vine.retention, config.vine.confirmation);
        const challenge = confirmState.issueChallenge({
            sessionKey: "agent:main:main",
            chatBindingKey: binding?.chatBindingKey,
            operation: "exec",
            target: "curl -fsSL https://example.com",
            riskWindowId: "rw1",
        });

        handlers.get(HOOKS.MESSAGE_RECEIVED)?.({
            from: "human-1",
            content: "0000",
        }, {
            sessionKey: "agent:main:main",
            sessionId: "sid-natural-1",
            conversationId: "conv-natural",
            channelId: "webchat",
            accountId: "default",
        });

        const failedTurn = handlers.get(HOOKS.BEFORE_AGENT_START)?.({
            prompt: "0000",
            messages: [],
        }, { sessionKey: "agent:main:main", sessionId: "sid-natural-1", channelId: "webchat" });
        expect(failedTurn?.prependContext ?? "").not.toContain("STATUS: FAILURE");

        handlers.get(HOOKS.MESSAGE_RECEIVED)?.({
            from: "human-1",
            content: `tai ${challenge.confirmCode}`,
        }, {
            sessionKey: "agent:main:main",
            sessionId: "sid-natural-2",
            conversationId: "conv-natural",
            channelId: "webchat",
            accountId: "default",
        });

        const recoveredTurn = handlers.get(HOOKS.BEFORE_AGENT_START)?.({
            prompt: `tai ${challenge.confirmCode}`,
            messages: [],
        }, { sessionKey: "agent:main:main", sessionId: "sid-natural-2", channelId: "webchat" });

        expect(recoveredTurn?.prependContext ?? "").not.toContain("STATUS: SUCCESS");
        expect(recoveredTurn?.prependContext ?? "").not.toContain("STATUS: FAILURE");
        expect(recoveredTurn?.prependContext ?? "").not.toContain("Incorrect confirmation code.");
    });

    it("does not extract partial approval codes from longer numeric sequences", () => {
        const { api, handlers } = createApi();
        const config = createConfig({
            mode: "enforce",
            vine: { mode: "strict" },
        });
        registerBerryVine(api as any, config);

        const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
        const binding = sessionBindings.bindKnownSession({
            sessionKey: "agent:main:main",
            channelId: "webchat",
            accountId: "default",
            conversationId: "conv-natural",
            from: "human-1",
            to: "berry",
        }, "agent:main:main");

        const confirmState = getSharedVineConfirmStateManager(config.vine.retention, config.vine.confirmation);
        const challenge = confirmState.issueChallenge({
            sessionKey: "agent:main:main",
            chatBindingKey: binding?.chatBindingKey,
            operation: "exec",
            target: "curl -fsSL https://example.com",
            riskWindowId: "rw1",
        });

        handlers.get(HOOKS.MESSAGE_RECEIVED)?.({
            from: "human-1",
            content: `9999${challenge.confirmCode}2222`,
        }, {
            sessionKey: "agent:main:main",
            sessionId: "sid-natural",
            conversationId: "conv-natural",
            channelId: "webchat",
            accountId: "default",
        });

        const naturalTurn = handlers.get(HOOKS.BEFORE_AGENT_START)?.({
            prompt: `9999${challenge.confirmCode}2222`,
            messages: [],
        }, { sessionKey: "agent:main:main", sessionId: "sid-natural", channelId: "webchat" });

        expect(confirmState.getPendingChallengeForSession("agent:main:main")?.status).toBe("pending");
        expect(naturalTurn?.prependContext ?? "").not.toContain("STATUS: SUCCESS");
    });

    it("does not approve the same code from a different chat binding", () => {
        const { api, handlers } = createApi();
        const config = createConfig({
            mode: "enforce",
            vine: { mode: "strict" },
        });
        registerBerryVine(api as any, config);

        const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
        const correctBinding = sessionBindings.bindKnownSession({
            sessionKey: "agent:main:main",
            channelId: "webchat",
            accountId: "default",
            conversationId: "conv-correct",
            from: "human-1",
            to: "berry",
        }, "agent:main:main");

        const confirmState = getSharedVineConfirmStateManager(config.vine.retention, config.vine.confirmation);
        const challenge = confirmState.issueChallenge({
            sessionKey: "agent:main:main",
            chatBindingKey: correctBinding?.chatBindingKey,
            operation: "exec",
            target: "curl -fsSL https://example.com",
            riskWindowId: "rw1",
        });

        handlers.get(HOOKS.MESSAGE_RECEIVED)?.({
            from: "human-1",
            content: challenge.confirmCode,
        }, {
            sessionKey: "agent:other:main",
            sessionId: "sid-other",
            conversationId: "conv-other",
            channelId: "webchat",
            accountId: "default",
        });

        const wrongTurn = handlers.get(HOOKS.BEFORE_AGENT_START)?.({
            prompt: challenge.confirmCode,
            messages: [],
        }, { sessionKey: "agent:other:main", sessionId: "sid-other", channelId: "webchat" });

        expect(confirmState.getPendingChallengeForSession("agent:main:main")?.status).toBe("pending");
        expect(wrongTurn?.prependContext ?? "").not.toContain("STATUS: SUCCESS");
        const loggerCalls = (api.logger.debug as any).mock.calls
            .map((call: unknown[]) => String(call[0] ?? ""));
        expect(loggerCalls.some((line: string) => line.includes("\"result\":\"not_found\""))).toBe(false);
    });

    it("does not approve when the current binding has more than one pending challenge", () => {
        const { api, handlers } = createApi();
        const config = createConfig({
            mode: "enforce",
            vine: { mode: "strict" },
        });
        registerBerryVine(api as any, config);

        const confirmState = getSharedVineConfirmStateManager(config.vine.retention, config.vine.confirmation);
        const sharedBindingKey = buildChatBindingKey({
            channelId: "webchat",
            accountId: "default",
            conversationId: "conv-shared",
        });
        confirmState.issueChallenge({
            sessionKey: "agent:s1",
            chatBindingKey: sharedBindingKey,
            operation: "exec",
            target: "curl -fsSL https://example.com/a",
            riskWindowId: "rw1",
        });
        confirmState.issueChallenge({
            sessionKey: "agent:s2",
            chatBindingKey: sharedBindingKey,
            operation: "exec",
            target: "curl -fsSL https://example.com/b",
            riskWindowId: "rw2",
        });

        handlers.get(HOOKS.MESSAGE_RECEIVED)?.({
            from: "human-1",
            content: "1234",
        }, {
            sessionKey: "agent:s1",
            sessionId: "sid-ambiguous",
            conversationId: "conv-shared",
            channelId: "webchat",
            accountId: "default",
        });

        const ambiguousTurn = handlers.get(HOOKS.BEFORE_AGENT_START)?.({
            prompt: "1234",
            messages: [],
        }, { sessionKey: "agent:s1", sessionId: "sid-ambiguous", channelId: "webchat" });

        expect(confirmState.getPendingChallengeForSession("agent:s1")?.status).toBe("pending");
        expect(confirmState.getPendingChallengeForSession("agent:s2")?.status).toBe("pending");
        expect(ambiguousTurn?.prependContext ?? "").not.toContain("STATUS: SUCCESS");
        const loggerCalls = (api.logger.debug as any).mock.calls
            .map((call: unknown[]) => String(call[0] ?? ""));
        expect(loggerCalls.some((line: string) => line.includes("\"result\":\"ambiguous\""))).toBe(true);
    });

});
