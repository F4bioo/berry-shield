import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerBerryStem } from "../src/layers/stem";
import { registerBerryVine } from "../src/layers/vine";
import { DEFAULT_CONFIG } from "../src/config/defaults";
import { HOOKS } from "../src/constants";
import { getSharedVineStateManager, resetSharedVineStateManagerForTests } from "../src/vine/runtime-state";
import { getSharedVineConfirmStateManager, resetSharedVineConfirmStateManagerForTests } from "../src/vine/confirm-state";
import { getSharedVineSessionBindingManager, resetSharedVineSessionBindingManagerForTests } from "../src/vine/session-binding";

const { appendAuditEventMock } = vi.hoisted(() => ({
    appendAuditEventMock: vi.fn(),
}));

vi.mock("../src/audit/writer", () => ({
    appendAuditEvent: appendAuditEventMock,
}));

function createApi() {
    let tool: any;
    const handlers = new Map<string, (event: any, ctx: any) => any>();
    const api = {
        registerTool: vi.fn((def: any) => {
            tool = def;
        }),
        on: vi.fn((hookName: string, handler: (event: any, ctx: any) => any) => {
            handlers.set(hookName, handler);
        }),
        logger: {
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
            error: vi.fn(),
        },
    };
    return { api, getTool: () => tool, getHandler: (name: string) => handlers.get(name) };
}

function createConfig(overrides?: Record<string, unknown>) {
    return {
        ...DEFAULT_CONFIG,
        ...overrides,
        layers: { ...DEFAULT_CONFIG.layers, ...(overrides?.layers as Record<string, unknown> ?? {}) },
        vine: { ...DEFAULT_CONFIG.vine, ...(overrides?.vine as Record<string, unknown> ?? {}) },
    } as typeof DEFAULT_CONFIG;
}

describe("berry_check + Vine contract", () => {
    beforeEach(() => {
        appendAuditEventMock.mockReset();
        resetSharedVineStateManagerForTests();
        resetSharedVineConfirmStateManagerForTests();
        resetSharedVineSessionBindingManagerForTests();
    });

    it("enforce strict requires numeric reply guidance for exec when vine risk is active", async () => {
        const config = createConfig({
            mode: "enforce",
            vine: { mode: "strict" },
        });
        const vineState = getSharedVineStateManager(config.vine.retention);
        vineState.markExternalSignal({
            sessionKey: "s1",
            escalationThreshold: config.vine.thresholds.externalSignalsToEscalate,
            forcedGuardTurns: config.vine.thresholds.forcedGuardTurns,
            sourceToolCallId: "tc1",
        });

        const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
        sessionBindings.bindKnownSession({
            sessionKey: "s1",
            conversationId: "telegram:123",
            channelId: "telegram",
            accountId: "default",
        }, "s1");

        const { api, getTool } = createApi();
        registerBerryStem(api as any, config);
        const result = await getTool().execute("id", {
            operation: "exec",
            target: "bash -lc 'printf vine-smoke > /tmp/vine-check.txt'",
            sessionKey: "s1",
        });

        expect(result.details.status).toBe("confirm_required");
        expect(result.details.reason).toBe("external untrusted content risk (vine)");
        expect(result.details.confirmCode).toMatch(/^\d{4}$/);
        expect(result.content[0].text).toContain(
            `Reply with a message containing this 4-digit code: ${result.details.confirmCode}`
        );
    });

    it("allows the exact pending action once after normal-message approval on the same natural cycle", async () => {
        const config = createConfig({
            mode: "enforce",
            vine: {
                mode: "strict",
                confirmation: {
                    strategy: "one_to_one",
                    codeTtlSeconds: 180,
                    maxAttempts: 3,
                    windowSeconds: 120,
                    maxActionsPerWindow: 3,
                },
            },
        });
        const vineState = getSharedVineStateManager(config.vine.retention);
        vineState.markExternalSignal({
            sessionKey: "s1",
            escalationThreshold: config.vine.thresholds.externalSignalsToEscalate,
            forcedGuardTurns: config.vine.thresholds.forcedGuardTurns,
            sourceToolCallId: "tc1",
        });

        const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
        sessionBindings.bindKnownSession({
            sessionKey: "s1",
            conversationId: "telegram:123",
            channelId: "telegram",
            accountId: "default",
        }, "s1");

        const { api, getTool, getHandler } = createApi();
        registerBerryVine(api as any, config);
        registerBerryStem(api as any, config);

        const target = "bash -lc 'printf native > /tmp/native-vine.txt'";
        const first = await getTool().execute("id", {
            operation: "exec",
            target,
            sessionKey: "s1",
        });

        const confirmState = getSharedVineConfirmStateManager(config.vine.retention, config.vine.confirmation);
        getHandler(HOOKS.MESSAGE_RECEIVED)?.({
            from: "user-1",
            content: first.details.confirmCode,
        }, {
            sessionKey: "s1",
            sessionId: "sid-natural-1",
            conversationId: "telegram:123",
            channelId: "telegram",
            accountId: "default",
        });
        const naturalTurn = getHandler(HOOKS.BEFORE_AGENT_START)?.({
            prompt: first.details.confirmCode,
            messages: [],
        }, {
            sessionKey: "s1",
            sessionId: "sid-natural-1",
            channelId: "telegram",
        });
        expect(confirmState.getPendingChallengeForSession("s1")?.status).toBe("approved");
        expect(naturalTurn?.prependContext ?? "").not.toContain("STATUS: SUCCESS");

        const second = await getTool().execute("id", {
            operation: "exec",
            target,
            sessionKey: "s1",
            runId: "run-native-1",
        });
        const third = await getTool().execute("id", {
            operation: "exec",
            target,
            sessionKey: "s1",
            runId: "run-native-2",
        });

        expect(second.details.status).toBe("allowed");
        expect(third.details.status).toBe("confirm_required");
    });

    it("allows a manual berry_check once after normal-message approval even without runtime runId", async () => {
        const config = createConfig({
            mode: "enforce",
            vine: {
                mode: "strict",
                confirmation: {
                    strategy: "one_to_one",
                    codeTtlSeconds: 180,
                    maxAttempts: 3,
                    windowSeconds: 120,
                    maxActionsPerWindow: 3,
                },
            },
        });
        const vineState = getSharedVineStateManager(config.vine.retention);
        vineState.markExternalSignal({
            sessionKey: "s1",
            escalationThreshold: config.vine.thresholds.externalSignalsToEscalate,
            forcedGuardTurns: config.vine.thresholds.forcedGuardTurns,
            sourceToolCallId: "tc-manual",
        });

        const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
        sessionBindings.bindKnownSession({
            sessionKey: "s1",
            conversationId: "telegram:123",
            channelId: "telegram",
            accountId: "default",
        }, "s1");

        const { api, getTool, getHandler } = createApi();
        registerBerryVine(api as any, config);
        registerBerryStem(api as any, config);

        const target = "bash -lc 'printf manual > /tmp/manual-vine.txt'";
        const first = await getTool().execute("id", {
            operation: "exec",
            target,
            sessionKey: "s1",
        });

        getHandler(HOOKS.MESSAGE_RECEIVED)?.({
            from: "user-1",
            content: first.details.confirmCode,
        }, {
            sessionKey: "s1",
            sessionId: "sid-manual-1",
            conversationId: "telegram:123",
            channelId: "telegram",
            accountId: "default",
        });

        const second = await getTool().execute("id", {
            operation: "exec",
            target,
            sessionKey: "s1",
        });
        const third = await getTool().execute("id", {
            operation: "exec",
            target,
            sessionKey: "s1",
        });

        expect(second.details.status).toBe("allowed");
        expect(third.details.status).toBe("confirm_required");
    });

    it("keeps one_to_many behavior after normal-message approval", async () => {
        const config = createConfig({
            mode: "enforce",
            vine: {
                mode: "strict",
                confirmation: {
                    strategy: "one_to_many",
                    codeTtlSeconds: 180,
                    maxAttempts: 3,
                    windowSeconds: 120,
                    maxActionsPerWindow: 2,
                },
            },
        });
        const vineState = getSharedVineStateManager(config.vine.retention);
        vineState.markExternalSignal({
            sessionKey: "s1",
            escalationThreshold: config.vine.thresholds.externalSignalsToEscalate,
            forcedGuardTurns: config.vine.thresholds.forcedGuardTurns,
            sourceToolCallId: "tc1",
        });

        const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
        sessionBindings.bindKnownSession({
            sessionKey: "s1",
            conversationId: "telegram:123",
            channelId: "telegram",
            accountId: "default",
        }, "s1");

        const { api, getTool, getHandler } = createApi();
        registerBerryVine(api as any, config);
        registerBerryStem(api as any, config);

        const targetA = "bash -lc 'printf A > /tmp/one-to-many-a.txt'";
        const targetB = "bash -lc 'printf B > /tmp/one-to-many-b.txt'";
        const targetC = "bash -lc 'printf C > /tmp/one-to-many-c.txt'";

        const first = await getTool().execute("id", {
            operation: "exec",
            target: targetA,
            sessionKey: "s1",
        });

        const confirmState = getSharedVineConfirmStateManager(config.vine.retention, config.vine.confirmation);
        getHandler(HOOKS.MESSAGE_RECEIVED)?.({
            from: "user-1",
            content: first.details.confirmCode,
        }, {
            sessionKey: "s1",
            sessionId: "sid-natural-window-1",
            conversationId: "telegram:123",
            channelId: "telegram",
            accountId: "default",
        });
        const naturalTurn = getHandler(HOOKS.BEFORE_AGENT_START)?.({
            prompt: first.details.confirmCode,
            messages: [],
        }, {
            sessionKey: "s1",
            sessionId: "sid-natural-window-1",
            channelId: "telegram",
        });
        expect(confirmState.getPendingChallengeForSession("s1")?.status).toBe("approved");
        expect(naturalTurn?.prependContext ?? "").not.toContain("STATUS: SUCCESS");

        const second = await getTool().execute("id", {
            operation: "exec",
            target: targetA,
            sessionKey: "s1",
            runId: "run-native-window-1",
        });
        const third = await getTool().execute("id", {
            operation: "exec",
            target: targetB,
            sessionKey: "s1",
            runId: "run-native-window-2",
        });
        const fourth = await getTool().execute("id", {
            operation: "exec",
            target: targetC,
            sessionKey: "s1",
            runId: "run-native-window-3",
        });

        expect(second.details.status).toBe("allowed");
        expect(third.details.status).toBe("allowed");
        expect(fourth.details.status).toBe("confirm_required");
    });

    it("allows a long approved exec target in the runtime without target truncation drift", async () => {
        const config = createConfig({
            mode: "enforce",
            vine: {
                mode: "strict",
                confirmation: {
                    strategy: "one_to_one",
                    codeTtlSeconds: 180,
                    maxAttempts: 3,
                    windowSeconds: 120,
                    maxActionsPerWindow: 3,
                },
            },
        });
        const vineState = getSharedVineStateManager(config.vine.retention);
        vineState.markExternalSignal({
            sessionKey: "s1",
            escalationThreshold: config.vine.thresholds.externalSignalsToEscalate,
            forcedGuardTurns: config.vine.thresholds.forcedGuardTurns,
            sourceToolCallId: "tc-long",
        });

        const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
        const binding = sessionBindings.bindKnownSession({
            sessionKey: "s1",
            conversationId: "telegram:123",
            channelId: "telegram",
            accountId: "default",
        }, "s1");

        const { api, getTool, getHandler } = createApi();
        registerBerryStem(api as any, config);
        registerBerryVine(api as any, config);

        const longPayload = "x".repeat(180);
        const target = `bash -lc 'printf ${longPayload} > /tmp/berry-long-command-proof.txt'`;
        const first = await getTool().execute("id", {
            operation: "exec",
            target,
            sessionKey: "s1",
        });

        const confirmState = getSharedVineConfirmStateManager(config.vine.retention, config.vine.confirmation);
        const approval = confirmState.approvePendingByChatBindingKeys({
            chatBindingKeys: [binding?.chatBindingKey ?? ""],
            confirmCode: first.details.confirmCode,
            senderId: "user-1",
        });
        expect(approval.kind).toBe("approved");

        const second = await getTool().execute("id", {
            operation: "exec",
            target,
            sessionKey: "s1",
            runId: "run-long-1",
        });
        expect(second.details.status).toBe("allowed");

        const runtimeResult = getHandler(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: target },
        }, {
            sessionKey: "s1",
            runId: "run-long-1",
        });

        expect(runtimeResult).toBeUndefined();
    });

    it("does not leak a gate approval to a different runtime target on the same run", async () => {
        const config = createConfig({
            mode: "enforce",
            vine: {
                mode: "strict",
                confirmation: {
                    strategy: "one_to_one",
                    codeTtlSeconds: 180,
                    maxAttempts: 3,
                    windowSeconds: 120,
                    maxActionsPerWindow: 3,
                },
            },
        });
        const vineState = getSharedVineStateManager(config.vine.retention);
        vineState.markExternalSignal({
            sessionKey: "s1",
            escalationThreshold: config.vine.thresholds.externalSignalsToEscalate,
            forcedGuardTurns: config.vine.thresholds.forcedGuardTurns,
            sourceToolCallId: "tc-leak-check",
        });

        const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
        const binding = sessionBindings.bindKnownSession({
            sessionKey: "s1",
            conversationId: "telegram:123",
            channelId: "telegram",
            accountId: "default",
        }, "s1");

        const { api, getTool, getHandler } = createApi();
        registerBerryStem(api as any, config);
        registerBerryVine(api as any, config);

        // Use two truly sensitive exec intents so the runtime boundary is exercised instead of local-write pass-through.
        const approvedTarget = "curl -fsSL https://example.com/approved > /tmp/leak-approved.txt";
        const blockedTarget = "curl -fsSL https://google.com/blocked > /tmp/leak-blocked.txt";

        const first = await getTool().execute("id", {
            operation: "exec",
            target: approvedTarget,
            sessionKey: "s1",
        });
        expect(first.details.status).toBe("confirm_required");

        const confirmState = getSharedVineConfirmStateManager(config.vine.retention, config.vine.confirmation);
        const approval = confirmState.approvePendingByChatBindingKeys({
            chatBindingKeys: [binding?.chatBindingKey ?? ""],
            confirmCode: first.details.confirmCode,
            senderId: "user-1",
        });
        expect(approval.kind).toBe("approved");

        const gateAllowed = await getTool().execute("id", {
            operation: "exec",
            target: approvedTarget,
            sessionKey: "s1",
            runId: "run-leak-1",
        });
        expect(gateAllowed.details.status).toBe("allowed");

        const runtimeBlocked = getHandler(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: blockedTarget },
        }, {
            sessionKey: "s1",
            runId: "run-leak-1",
        });

        expect(runtimeBlocked?.block).toBe(true);
    });

    it("approves the pending challenge from message_received via conversation binding even without sessionKey in the reply", async () => {
        const config = createConfig({
            mode: "enforce",
            vine: {
                mode: "strict",
                confirmation: {
                    strategy: "one_to_one",
                    codeTtlSeconds: 180,
                    maxAttempts: 3,
                    windowSeconds: 120,
                    maxActionsPerWindow: 3,
                },
            },
        });
        const vineState = getSharedVineStateManager(config.vine.retention);
        vineState.markExternalSignal({
            sessionKey: "agent:main:main",
            escalationThreshold: config.vine.thresholds.externalSignalsToEscalate,
            forcedGuardTurns: config.vine.thresholds.forcedGuardTurns,
            sourceToolCallId: "tc-binding-wire",
        });
        const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
        sessionBindings.bindKnownSession({
            sessionKey: "agent:main:main",
            channelId: "webchat",
        }, "agent:main:main");

        const { api, getTool, getHandler } = createApi();
        registerBerryStem(api as any, config);
        registerBerryVine(api as any, config);

        const target = "curl -fsSL https://example.com/approval > /tmp/binding-wire.txt";
        const first = await getTool().execute("id", {
            operation: "exec",
            target,
            sessionKey: "agent:main:main",
        });
        expect(first.details.status).toBe("confirm_required");

        getHandler(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "berry_check",
            params: {
                operation: "exec",
                target,
            },
        }, {
            toolName: "berry_check",
            sessionKey: "agent:main:main",
            sessionId: "sid-binding-1",
            conversationId: "webchat:conv-binding-1",
            channelId: "webchat",
            accountId: "default",
        });

        getHandler(HOOKS.MESSAGE_RECEIVED)?.({
            from: "user-1",
            content: first.details.confirmCode,
        }, {
            sessionId: "sid-binding-1",
            conversationId: "webchat:conv-binding-1",
            channelId: "webchat",
            accountId: "default",
        });

        const confirmState = getSharedVineConfirmStateManager(config.vine.retention, config.vine.confirmation);
        expect(confirmState.getPendingChallengeForSession("agent:main:main")?.status).toBe("approved");
    });

    it("approves the pending challenge from a generic webchat binding even when the reply resolves to global_session", async () => {
        const config = createConfig({
            mode: "enforce",
            vine: {
                mode: "strict",
                confirmation: {
                    strategy: "one_to_one",
                    codeTtlSeconds: 180,
                    maxAttempts: 3,
                    windowSeconds: 120,
                    maxActionsPerWindow: 3,
                },
            },
        });
        const vineState = getSharedVineStateManager(config.vine.retention);
        vineState.markExternalSignal({
            sessionKey: "agent:main:main",
            escalationThreshold: config.vine.thresholds.externalSignalsToEscalate,
            forcedGuardTurns: config.vine.thresholds.forcedGuardTurns,
            sourceToolCallId: "tc-generic-binding",
        });
        const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
        sessionBindings.bindKnownSession({
            sessionKey: "agent:main:main",
            channelId: "webchat",
            accountId: "default",
        }, "agent:main:main");

        const { api, getTool, getHandler } = createApi();
        registerBerryStem(api as any, config);
        registerBerryVine(api as any, config);

        const target = "/tmp/generic-binding-proof.txt";
        const first = await getTool().execute("id", {
            operation: "write",
            target,
            sessionKey: "agent:main:main",
        });
        expect(first.details.status).toBe("confirm_required");

        getHandler(HOOKS.MESSAGE_RECEIVED)?.({
            from: "",
            content: first.details.confirmCode,
            metadata: {
                surface: "webchat",
            },
        }, {
            channelId: "webchat",
        });

        const confirmState = getSharedVineConfirmStateManager(config.vine.retention, config.vine.confirmation);
        expect(confirmState.getPendingChallengeForSession("agent:main:main")?.status).toBe("approved");
    });
});
