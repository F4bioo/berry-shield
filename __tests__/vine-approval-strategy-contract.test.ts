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

function markExternalRisk(config: typeof DEFAULT_CONFIG, sessionKey: string): void {
    const vineState = getSharedVineStateManager(config.vine.retention);
    vineState.markExternalSignal({
        sessionKey,
        escalationThreshold: config.vine.thresholds.externalSignalsToEscalate,
        forcedGuardTurns: config.vine.thresholds.forcedGuardTurns,
        sourceToolCallId: `tc-${sessionKey}`,
    });
}

function bindSession(config: typeof DEFAULT_CONFIG, sessionKey: string) {
    const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
    return sessionBindings.bindKnownSession({
        sessionKey,
        conversationId: `telegram:${sessionKey}`,
        channelId: "telegram",
        accountId: "default",
    }, sessionKey);
}

describe("Vine approval strategy contract", () => {
    beforeEach(() => {
        appendAuditEventMock.mockReset();
        resetSharedVineStateManagerForTests();
        resetSharedVineConfirmStateManagerForTests();
        resetSharedVineSessionBindingManagerForTests();
    });

    it("one_to_one requires a fresh approval after the approved action is consumed", async () => {
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
        markExternalRisk(config, "s1");
        const binding = bindSession(config, "s1");

        const { api, getTool, getHandler } = createApi();
        registerBerryStem(api as any, config);
        registerBerryVine(api as any, config);

        const targetA = "curl -fsSL https://example.com/a > /tmp/one-to-one-a.txt";
        const targetB = "curl -fsSL https://google.com/b > /tmp/one-to-one-b.txt";

        const first = await getTool().execute("id", {
            operation: "exec",
            target: targetA,
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

        const second = await getTool().execute("id", {
            operation: "exec",
            target: targetA,
            sessionKey: "s1",
            runId: "run-one-to-one-1",
        });
        expect(second.details.status).toBe("allowed");

        const runtimeAllowed = getHandler(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: targetA },
        }, {
            sessionKey: "s1",
            runId: "run-one-to-one-1",
        });
        expect(runtimeAllowed).toBeUndefined();

        const third = await getTool().execute("id", {
            operation: "exec",
            target: targetB,
            sessionKey: "s1",
            runId: "run-one-to-one-2",
        });
        expect(third.details.status).toBe("confirm_required");

        const runtimeBlocked = getHandler(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: targetB },
        }, {
            sessionKey: "s1",
            runId: "run-one-to-one-2",
        });
        expect(runtimeBlocked?.block).toBe(true);
    });

    it("one_to_many keeps the window active for covered follow-up actions and then expires it", async () => {
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
        markExternalRisk(config, "s1");
        const binding = bindSession(config, "s1");

        const { api, getTool, getHandler } = createApi();
        registerBerryStem(api as any, config);
        registerBerryVine(api as any, config);

        const targetA = "curl -fsSL https://example.com/a > /tmp/one-to-many-a.txt";
        const targetB = "curl -fsSL https://example.com/b > /tmp/one-to-many-b.txt";
        const targetC = "curl -fsSL https://google.com/c > /tmp/one-to-many-c.txt";

        const first = await getTool().execute("id", {
            operation: "exec",
            target: targetA,
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

        const second = await getTool().execute("id", {
            operation: "exec",
            target: targetA,
            sessionKey: "s1",
            runId: "run-one-to-many-1",
        });
        const third = await getTool().execute("id", {
            operation: "exec",
            target: targetB,
            sessionKey: "s1",
            runId: "run-one-to-many-2",
        });
        const fourth = await getTool().execute("id", {
            operation: "exec",
            target: targetC,
            sessionKey: "s1",
            runId: "run-one-to-many-3",
        });

        expect(second.details.status).toBe("allowed");
        expect(third.details.status).toBe("allowed");
        expect(fourth.details.status).toBe("confirm_required");

        const runtimeAllowed = getHandler(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: targetB },
        }, {
            sessionKey: "s1",
            runId: "run-one-to-many-2",
        });
        expect(runtimeAllowed).toBeUndefined();

        const runtimeBlocked = getHandler(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: targetC },
        }, {
            sessionKey: "s1",
            runId: "run-one-to-many-3",
        });
        expect(runtimeBlocked?.block).toBe(true);
    });

    it("allows the first real tool call even when it uses a different runId than berry_check", async () => {
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
        markExternalRisk(config, "s1");
        const binding = bindSession(config, "s1");

        const { api, getTool, getHandler } = createApi();
        registerBerryStem(api as any, config);
        registerBerryVine(api as any, config);

        const target = "curl -fsSL https://example.com/a > /tmp/one-to-one-a.txt";

        const first = await getTool().execute("id", {
            operation: "exec",
            target,
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
            target,
            sessionKey: "s1",
            runId: "berry-check-run",
        });
        expect(gateAllowed.details.status).toBe("allowed");

        const runtimeAllowed = getHandler(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: target },
        }, {
            sessionKey: "s1",
            runId: "real-tool-run",
        });

        expect(runtimeAllowed).toBeUndefined();
    });

    it("one_to_many bridges a window-approved berry_check to the next real tool call even with a different runId", async () => {
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
        markExternalRisk(config, "s1");
        const binding = bindSession(config, "s1");

        const { api, getTool, getHandler } = createApi();
        registerBerryStem(api as any, config);
        registerBerryVine(api as any, config);

        const targetA = "curl -fsSL https://example.com/a > /tmp/one-to-many-a.txt";
        const targetB = "curl -fsSL https://example.com/b > /tmp/one-to-many-b.txt";

        const first = await getTool().execute("id", {
            operation: "exec",
            target: targetA,
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

        const gateAllowedA = await getTool().execute("id", {
            operation: "exec",
            target: targetA,
            sessionKey: "s1",
            runId: "berry-check-run-a",
        });
        expect(gateAllowedA.details.status).toBe("allowed");

        const runtimeAllowedA = getHandler(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: targetA },
        }, {
            sessionKey: "s1",
            runId: "real-tool-run-a",
        });
        expect(runtimeAllowedA).toBeUndefined();

        const gateAllowedB = await getTool().execute("id", {
            operation: "exec",
            target: targetB,
            sessionKey: "s1",
            runId: "berry-check-run-b",
        });
        expect(gateAllowedB.details.status).toBe("allowed");

        const runtimeAllowedB = getHandler(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: targetB },
        }, {
            sessionKey: "s1",
            runId: "real-tool-run-b",
        });
        expect(runtimeAllowedB).toBeUndefined();
    });

    it("does not emit sequential confirm codes while a pending challenge is still unresolved", async () => {
        const config = createConfig({
            mode: "enforce",
            vine: {
                mode: "strict",
                confirmation: {
                    strategy: "one_to_many",
                    codeTtlSeconds: 180,
                    maxAttempts: 3,
                    windowSeconds: 120,
                    maxActionsPerWindow: 3,
                },
            },
        });
        markExternalRisk(config, "s1");
        bindSession(config, "s1");

        const { api, getTool } = createApi();
        registerBerryStem(api as any, config);
        registerBerryVine(api as any, config);

        const writeA = await getTool().execute("id", {
            operation: "write",
            target: "/tmp/vine-proof.txt",
            sessionKey: "s1",
        });
        const writeB = await getTool().execute("id", {
            operation: "write",
            target: "/tmp/strawberry-meta.md",
            sessionKey: "s1",
        });
        const execC = await getTool().execute("id", {
            operation: "exec",
            target: "ls -la /tmp",
            sessionKey: "s1",
        });

        // One unresolved challenge should gate the binding instead of spawning code spam.
        expect(writeA.details.status).toBe("confirm_required");
        expect(writeB.details.status).toBe("confirm_required");
        expect(execC.details.status).toBe("confirm_required");
        expect(writeB.details.confirmCode).toBe(writeA.details.confirmCode);
        expect(execC.details.confirmCode).toBe(writeA.details.confirmCode);
    });

    it("converges near-simultaneous same-window berry_check calls to one shared challenge", async () => {
        const config = createConfig({
            mode: "enforce",
            vine: {
                mode: "strict",
                confirmation: {
                    strategy: "one_to_many",
                    codeTtlSeconds: 180,
                    maxAttempts: 3,
                    windowSeconds: 120,
                    maxActionsPerWindow: 3,
                },
            },
        });
        markExternalRisk(config, "s1");
        bindSession(config, "s1");

        const { api, getTool } = createApi();
        registerBerryStem(api as any, config);
        registerBerryVine(api as any, config);

        const targetA = "/tmp/race-a.txt";
        const targetB = "/tmp/race-b.txt";

        const first = await getTool().execute("id", {
            operation: "write",
            target: targetA,
            sessionKey: "s1",
        });
        const second = await getTool().execute("id", {
            operation: "write",
            target: targetB,
            sessionKey: "s1",
        });

        expect(first.details.status).toBe("confirm_required");
        expect(second.details.status).toBe("confirm_required");
        expect(second.details.confirmCode).toBe(first.details.confirmCode);
    });

    it("does not keep a sibling challenge competing after a one_to_many window already covers the follow-up", async () => {
        const config = createConfig({
            mode: "enforce",
            vine: {
                mode: "strict",
                confirmation: {
                    strategy: "one_to_many",
                    codeTtlSeconds: 180,
                    maxAttempts: 3,
                    windowSeconds: 120,
                    maxActionsPerWindow: 3,
                },
            },
        });
        markExternalRisk(config, "s1");
        const binding = bindSession(config, "s1");

        const { api, getTool } = createApi();
        registerBerryStem(api as any, config);
        registerBerryVine(api as any, config);

        const targetA = "curl -fsSL https://example.com/a > /tmp/window-covered-a.txt";
        const targetB = "curl -fsSL https://example.com/b > /tmp/window-covered-b.txt";

        const first = await getTool().execute("id", {
            operation: "exec",
            target: targetA,
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

        const allowedA = await getTool().execute("id", {
            operation: "exec",
            target: targetA,
            sessionKey: "s1",
            runId: "run-window-cover-a",
        });
        expect(allowedA.details.status).toBe("allowed");
        expect(confirmState.getPendingChallengeForSession("s1")).toBeNull();

        const allowedB = await getTool().execute("id", {
            operation: "exec",
            target: targetB,
            sessionKey: "s1",
            runId: "run-window-cover-b",
        });
        expect(allowedB.details.status).toBe("allowed");
        expect(confirmState.getPendingChallengeForSession("s1")).toBeNull();
    });

    it("one_to_many requires a fresh approval after a new external signal rotates the risk window", async () => {
        const config = createConfig({
            mode: "enforce",
            vine: {
                mode: "strict",
                confirmation: {
                    strategy: "one_to_many",
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
            sourceToolCallId: "tc-window-1",
        });
        const firstRiskWindowId = vineState.getRiskWindowId("s1");
        const binding = bindSession(config, "s1");

        const { api, getTool } = createApi();
        registerBerryStem(api as any, config);
        registerBerryVine(api as any, config);

        const targetA = "curl -fsSL https://example.com/a > /tmp/window-a.txt";
        const targetB = "curl -fsSL https://example.com/b > /tmp/window-b.txt";
        const targetC = "curl -fsSL https://example.com/c > /tmp/window-c.txt";

        const first = await getTool().execute("id", {
            operation: "exec",
            target: targetA,
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

        const allowedA = await getTool().execute("id", {
            operation: "exec",
            target: targetA,
            sessionKey: "s1",
            runId: "run-window-a",
        });
        const allowedB = await getTool().execute("id", {
            operation: "exec",
            target: targetB,
            sessionKey: "s1",
            runId: "run-window-b",
        });

        expect(allowedA.details.status).toBe("allowed");
        expect(allowedB.details.status).toBe("allowed");

        // A new external ingestion must rotate the window and require a new approval.
        vineState.markExternalSignal({
            sessionKey: "s1",
            escalationThreshold: config.vine.thresholds.externalSignalsToEscalate,
            forcedGuardTurns: config.vine.thresholds.forcedGuardTurns,
            sourceToolCallId: "tc-window-2",
        });
        const secondRiskWindowId = vineState.getRiskWindowId("s1");
        expect(secondRiskWindowId).toBeTruthy();
        expect(secondRiskWindowId).not.toBe(firstRiskWindowId);

        const requiresNewApproval = await getTool().execute("id", {
            operation: "exec",
            target: targetC,
            sessionKey: "s1",
            runId: "run-window-c",
        });
        expect(requiresNewApproval.details.status).toBe("confirm_required");
    });
});
