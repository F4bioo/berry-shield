import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerBerryStem } from "../src/layers/stem";
import { DEFAULT_CONFIG } from "../src/config/defaults";
import { getSharedVineStateManager, resetSharedVineStateManagerForTests } from "../src/vine/runtime-state";

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
    });

    it("enforce strict requires confirmation for exec when vine risk is active", async () => {
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
        expect(result.content[0].text).toContain("STATUS: CONFIRM_REQUIRED");
    });

    it("audit strict keeps allowed but emits would_confirm_required on exec when vine risk is active", async () => {
        const config = createConfig({
            mode: "audit",
            vine: { mode: "strict" },
        });
        const vineState = getSharedVineStateManager(config.vine.retention);
        vineState.markExternalSignal({
            sessionKey: "s1",
            escalationThreshold: config.vine.thresholds.externalSignalsToEscalate,
            forcedGuardTurns: config.vine.thresholds.forcedGuardTurns,
            sourceToolCallId: "tc1",
        });

        const { api, getTool } = createApi();
        registerBerryStem(api as any, config);
        const result = await getTool().execute("id", {
            operation: "exec",
            target: "bash -lc 'printf vine-smoke > /tmp/vine-check.txt'",
            sessionKey: "s1",
        });

        expect(result.details.status).toBe("allowed");
        const lastEvent = appendAuditEventMock.mock.calls.at(-1)?.[0];
        expect(lastEvent?.layer).toBe("vine");
        expect(lastEvent?.decision).toBe("would_confirm_required");
    });

    it("enforce balanced requires confirmation for write operation when vine guard risk is active", async () => {
        const config = createConfig({
            mode: "enforce",
            vine: { mode: "balanced" },
        });
        const vineState = getSharedVineStateManager(config.vine.retention);
        vineState.markExternalSignal({
            sessionKey: "s1",
            escalationThreshold: config.vine.thresholds.externalSignalsToEscalate,
            forcedGuardTurns: config.vine.thresholds.forcedGuardTurns,
            sourceToolCallId: "tc1",
        });

        const { api, getTool } = createApi();
        registerBerryStem(api as any, config);
        const result = await getTool().execute("id", {
            operation: "write",
            target: "/tmp/vine-check-write.txt",
            sessionKey: "s1",
        });

        expect(result.details.status).toBe("confirm_required");
        expect(result.details.reason).toBe("external untrusted content risk (vine)");
    });

    it("allows once when confirmCode is valid under trusted user turn", async () => {
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

        const { api, getTool, getHandler } = createApi();
        registerBerryStem(api as any, config);
        const beforeAgentStart = getHandler("before_agent_start");
        beforeAgentStart?.({}, { sessionKey: "s1", trigger: "user" });

        const first = await getTool().execute("id", {
            operation: "exec",
            target: "python3 -c 'open(\"/tmp/ok.txt\",\"w\").write(\"x\")'",
            sessionKey: "s1",
        });
        const second = await getTool().execute("id", {
            operation: "exec",
            target: "python3 -c 'open(\"/tmp/ok.txt\",\"w\").write(\"x\")'",
            sessionKey: "s1",
            confirmCode: first.details.confirmCode,
        });

        expect(first.details.status).toBe("confirm_required");
        expect(second.details.status).toBe("allowed");
        expect(appendAuditEventMock.mock.calls.some((call) => call[0]?.decision === "confirm_required")).toBe(true);
        expect(appendAuditEventMock.mock.calls.some((call) => call[0]?.decision === "allowed_by_confirm")).toBe(true);
    });

    it("keeps confirm_required on invalid confirmation code", async () => {
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

        const { api, getTool, getHandler } = createApi();
        registerBerryStem(api as any, config);
        const beforeAgentStart = getHandler("before_agent_start");
        beforeAgentStart?.({}, { sessionKey: "s1", trigger: "user" });

        await getTool().execute("id", {
            operation: "exec",
            target: "node -e \"require('fs').writeFileSync('/tmp/ok.txt','x')\"",
            sessionKey: "s1",
        });
        const retry = await getTool().execute("id", {
            operation: "exec",
            target: "node -e \"require('fs').writeFileSync('/tmp/ok.txt','x')\"",
            sessionKey: "s1",
            confirmCode: "9999",
        });

        expect(retry.details.status).toBe("confirm_required");
        expect(retry.details.invalidCode).toBe(true);
    });

    it("denies after max confirmation attempts", async () => {
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

        const { api, getTool, getHandler } = createApi();
        registerBerryStem(api as any, config);
        const beforeAgentStart = getHandler("before_agent_start");
        beforeAgentStart?.({}, { sessionKey: "s1", trigger: "user" });

        await getTool().execute("id", {
            operation: "exec",
            target: "python3 -c 'open(\"/tmp/denied.txt\",\"w\").write(\"x\")'",
            sessionKey: "s1",
        });
        await getTool().execute("id", {
            operation: "exec",
            target: "python3 -c 'open(\"/tmp/denied.txt\",\"w\").write(\"x\")'",
            sessionKey: "s1",
            confirmCode: "1111",
        });
        await getTool().execute("id", {
            operation: "exec",
            target: "python3 -c 'open(\"/tmp/denied.txt\",\"w\").write(\"x\")'",
            sessionKey: "s1",
            confirmCode: "2222",
        });
        const finalTry = await getTool().execute("id", {
            operation: "exec",
            target: "python3 -c 'open(\"/tmp/denied.txt\",\"w\").write(\"x\")'",
            sessionKey: "s1",
            confirmCode: "3333",
        });

        expect(finalTry.details.status).toBe("denied");
        expect(finalTry.details.reason).toContain("Max confirmation attempts exceeded");
    });

    it("accepts numeric confirmCode for challenge confirmation", async () => {
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

        const { api, getTool, getHandler } = createApi();
        registerBerryStem(api as any, config);
        const beforeAgentStart = getHandler("before_agent_start");
        beforeAgentStart?.({}, { sessionKey: "s1", trigger: "user" });

        const target = "python3 -c 'open(\"/tmp/zero.txt\",\"w\").write(\"x\")'";
        const first = await getTool().execute("id", {
            operation: "exec",
            target,
            sessionKey: "s1",
        });

        const asNumber = Number(first.details.confirmCode);
        const second = await getTool().execute("id", {
            operation: "exec",
            target,
            sessionKey: "s1",
            confirmCode: asNumber,
        });

        expect(second.details.status).toBe("allowed");
    });

    it("uses configured confirmation TTL in confirm_required output/details", async () => {
        const config = createConfig({
            mode: "enforce",
            vine: {
                mode: "strict",
                confirmation: {
                    strategy: "one_to_one",
                    codeTtlSeconds: 33,
                    maxAttempts: 5,
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

        const { api, getTool } = createApi();
        registerBerryStem(api as any, config);
        const result = await getTool().execute("id", {
            operation: "exec",
            target: "bash -lc 'printf test > /tmp/ttl-check.txt'",
            sessionKey: "s1",
        });

        expect(result.details.status).toBe("confirm_required");
        expect(result.details.ttlSeconds).toBe(33);
        expect(result.details.maxAttempts).toBe(5);
        expect(result.content[0].text).toContain("TTL_SECONDS: 33");
        expect(result.content[0].text).toContain("MAX_ATTEMPTS: 5");
    });

    it("one_to_many allows follow-up sensitive actions without re-prompt until window is exhausted", async () => {
        const config = createConfig({
            mode: "enforce",
            vine: {
                mode: "strict",
                confirmation: {
                    strategy: "one_to_many",
                    codeTtlSeconds: 90,
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

        const { api, getTool, getHandler } = createApi();
        registerBerryStem(api as any, config);
        const beforeAgentStart = getHandler("before_agent_start");
        beforeAgentStart?.({}, { sessionKey: "s1", trigger: "user" });

        const targetA = "bash -lc 'printf A > /tmp/one-to-many-a.txt'";
        const targetB = "bash -lc 'printf B > /tmp/one-to-many-b.txt'";
        const targetC = "bash -lc 'printf C > /tmp/one-to-many-c.txt'";

        const first = await getTool().execute("id", {
            operation: "exec",
            target: targetA,
            sessionKey: "s1",
        });
        const second = await getTool().execute("id", {
            operation: "exec",
            target: targetA,
            sessionKey: "s1",
            confirmCode: first.details.confirmCode,
        });
        const third = await getTool().execute("id", {
            operation: "exec",
            target: targetB,
            sessionKey: "s1",
        });
        const fourth = await getTool().execute("id", {
            operation: "exec",
            target: targetC,
            sessionKey: "s1",
        });

        expect(first.details.status).toBe("confirm_required");
        expect(second.details.status).toBe("allowed");
        expect(third.details.status).toBe("allowed");
        expect(fourth.details.status).toBe("confirm_required");
    });
});
