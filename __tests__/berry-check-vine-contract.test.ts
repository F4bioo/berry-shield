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
    const api = {
        registerTool: vi.fn((def: any) => {
            tool = def;
        }),
        on: vi.fn(),
        logger: {
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
            error: vi.fn(),
        },
    };
    return { api, getTool: () => tool };
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

    it("enforce strict denies write-like exec when vine risk is active", async () => {
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

        expect(result.details.status).toBe("denied");
        expect(result.details.reason).toBe("external untrusted content risk (vine)");
        expect(result.content[0].text).toContain("REASON: External untrusted content risk (Vine)");
    });

    it("audit strict keeps allowed but emits would_block on write-like exec when vine risk is active", async () => {
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
        expect(lastEvent?.decision).toBe("would_block");
    });

    it("enforce balanced denies write operation when vine guard risk is active", async () => {
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

        expect(result.details.status).toBe("denied");
        expect(result.details.reason).toBe("external untrusted content risk (vine)");
    });
});

