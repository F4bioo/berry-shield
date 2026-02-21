import { describe, expect, it, vi } from "vitest";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { BerryShieldPluginConfig } from "../src/types/config";
import { registerBerryStem } from "../src/layers/stem";
import { registerBerryThorn } from "../src/layers/thorn";
import { registerBerryPulp } from "../src/layers/pulp";
import { DEFAULT_CONFIG } from "../src/config/defaults";
import { HOOKS, AUDIT_DECISIONS, SECURITY_LAYERS } from "../src/constants";

/**
 * Contract: Audit Mode Runtime — Layer Behavior
 *
 * These tests validate that each security layer behaves correctly
 * at runtime in both audit and enforce modes:
 * - Audit: must NOT block, must NOT redact, must log structured events
 * - Enforce: must block and/or redact as designed
 */

// -------------------------------------------------------------------
// Mock factory
// -------------------------------------------------------------------

type HookCallback = (event: any) => any;
type ToolDefinition = { name: string; execute: (id: string, params: Record<string, unknown>) => Promise<any> };

function createMockApi() {
    const hooks: Record<string, HookCallback> = {};
    const tools: ToolDefinition[] = [];
    const logs: { level: string; msg: string }[] = [];

    const api = {
        on: vi.fn((hookName: string, callback: HookCallback) => {
            hooks[hookName] = callback;
        }),
        registerTool: vi.fn((def: any) => {
            tools.push(def);
        }),
        logger: {
            debug: vi.fn((...args: any[]) => logs.push({ level: "debug", msg: String(args[0]) })),
            info: vi.fn((...args: any[]) => logs.push({ level: "info", msg: String(args[0]) })),
            warn: vi.fn((...args: any[]) => logs.push({ level: "warn", msg: String(args[0]) })),
            error: vi.fn((...args: any[]) => logs.push({ level: "error", msg: String(args[0]) })),
        },
        config: { get: vi.fn(), set: vi.fn() },
    } as unknown as OpenClawPluginApi;

    return { api, hooks, tools, logs };
}

function auditConfig(overrides?: Partial<BerryShieldPluginConfig>): BerryShieldPluginConfig {
    return { ...DEFAULT_CONFIG, mode: "audit", ...overrides };
}

function enforceConfig(overrides?: Partial<BerryShieldPluginConfig>): BerryShieldPluginConfig {
    return { ...DEFAULT_CONFIG, mode: "enforce", ...overrides };
}

// -------------------------------------------------------------------
// Berry.Stem Runtime
// -------------------------------------------------------------------

describe("Contract: Audit Mode Runtime — Berry.Stem", () => {
    it("returns ALLOWED for destructive command in audit mode", async () => {
        const { api, tools } = createMockApi();
        registerBerryStem(api, auditConfig());

        const execute = tools[0]!.execute;
        const result = await execute("test-id", { operation: "exec", target: "rm -rf /" });

        expect(result.details.status).toBe("allowed");
    });

    it("returns DENIED for destructive command in enforce mode", async () => {
        const { api, tools } = createMockApi();
        registerBerryStem(api, enforceConfig());

        const execute = tools[0]!.execute;
        const result = await execute("test-id", { operation: "exec", target: "rm -rf /" });

        expect(result.details.status).toBe("denied");
        expect(result.details.reason).toBe("destructive command");
    });

    it("returns ALLOWED for exec referencing sensitive file in audit mode (bug fix)", async () => {
        const { api, tools } = createMockApi();
        registerBerryStem(api, auditConfig());

        const execute = tools[0]!.execute;
        const result = await execute("test-id", { operation: "exec", target: "cat .env" });

        // This is the exact bug that was fixed — previously returned DENIED
        expect(result.details.status).toBe("allowed");
    });

    it("returns DENIED for exec referencing sensitive file in enforce mode", async () => {
        const { api, tools } = createMockApi();
        registerBerryStem(api, enforceConfig());

        const execute = tools[0]!.execute;
        const result = await execute("test-id", { operation: "exec", target: "cat .env" });

        expect(result.details.status).toBe("denied");
    });

    it("returns ALLOWED for read on sensitive file in audit mode", async () => {
        const { api, tools } = createMockApi();
        registerBerryStem(api, auditConfig());

        const execute = tools[0]!.execute;
        const result = await execute("test-id", { operation: "read", target: ".env" });

        expect(result.details.status).toBe("allowed");
    });

    it("returns DENIED for read on sensitive file in enforce mode", async () => {
        const { api, tools } = createMockApi();
        registerBerryStem(api, enforceConfig());

        const execute = tools[0]!.execute;
        const result = await execute("test-id", { operation: "read", target: ".env" });

        expect(result.details.status).toBe("denied");
        expect(result.details.reason).toBe("sensitive file access");
    });

    it("logs structured would_block event in audit mode", async () => {
        const { api, tools, logs } = createMockApi();
        registerBerryStem(api, auditConfig());

        await tools[0]!.execute("test-id", { operation: "exec", target: "rm -rf /" });

        const auditLog = logs.find(l => l.msg.includes(AUDIT_DECISIONS.WOULD_BLOCK));
        expect(auditLog).toBeDefined();
        const parsed = JSON.parse(auditLog!.msg.split("Berry.Stem: ")[1]);
        expect(parsed.decision).toBe(AUDIT_DECISIONS.WOULD_BLOCK);
        expect(parsed.layer).toBe(SECURITY_LAYERS.STEM);
        expect(parsed.mode).toBe("audit");
    });
});

// -------------------------------------------------------------------
// Berry.Thorn Runtime
// -------------------------------------------------------------------

describe("Contract: Audit Mode Runtime — Berry.Thorn", () => {
    it("returns undefined (no block) for destructive command in audit mode", () => {
        const { api, hooks } = createMockApi();
        registerBerryThorn(api, auditConfig());

        const callback = hooks[HOOKS.BEFORE_TOOL_CALL];
        const result = callback({
            toolName: "run_command",
            params: { command: "rm -rf /" },
        });

        expect(result).toBeUndefined();
    });

    it("returns block=true for destructive command in enforce mode", () => {
        const { api, hooks } = createMockApi();
        registerBerryThorn(api, enforceConfig());

        const callback = hooks[HOOKS.BEFORE_TOOL_CALL];
        const result = callback({
            toolName: "run_command",
            params: { command: "rm -rf /" },
        });

        expect(result).toBeDefined();
        expect(result.block).toBe(true);
        expect(result.blockReason).toContain("Berry Shield");
    });

    it("returns undefined (no block) for sensitive file access in audit mode", () => {
        const { api, hooks } = createMockApi();
        registerBerryThorn(api, auditConfig());

        const callback = hooks[HOOKS.BEFORE_TOOL_CALL];
        const result = callback({
            toolName: "read_file",
            params: { path: "/home/user/.env" },
        });

        expect(result).toBeUndefined();
    });

    it("returns block=true for sensitive file access in enforce mode", () => {
        const { api, hooks } = createMockApi();
        registerBerryThorn(api, enforceConfig());

        const callback = hooks[HOOKS.BEFORE_TOOL_CALL];
        const result = callback({
            toolName: "read_file",
            params: { path: "/home/user/.env" },
        });

        expect(result).toBeDefined();
        expect(result.block).toBe(true);
    });

    it("logs structured would_block event in audit mode", () => {
        const { api, hooks, logs } = createMockApi();
        registerBerryThorn(api, auditConfig());

        hooks[HOOKS.BEFORE_TOOL_CALL]({
            toolName: "run_command",
            params: { command: "rm -rf /" },
        });

        const auditLog = logs.find(l => l.msg.includes(AUDIT_DECISIONS.WOULD_BLOCK));
        expect(auditLog).toBeDefined();
        const parsed = JSON.parse(auditLog!.msg.split("Berry.Thorn: ")[1]);
        expect(parsed.decision).toBe(AUDIT_DECISIONS.WOULD_BLOCK);
        expect(parsed.layer).toBe(SECURITY_LAYERS.THORN);
    });
});

// -------------------------------------------------------------------
// Berry.Pulp Runtime
// -------------------------------------------------------------------

describe("Contract: Audit Mode Runtime — Berry.Pulp", () => {
    const SECRET_PAYLOAD = {
        toolName: "read_file",
        message: [{ type: "text", text: "Secret key: AKIAIOSFODNN7EXAMPLE and email user@test.com" }],
    };

    it("returns original event (no redaction) in audit mode", () => {
        const { api, hooks } = createMockApi();
        registerBerryPulp(api, auditConfig());

        const callback = hooks[HOOKS.TOOL_RESULT_PERSIST];
        const result = callback({ ...SECRET_PAYLOAD });

        // In audit mode, the message must pass through UNMODIFIED
        expect(result.message[0].text).toContain("AKIAIOSFODNN7EXAMPLE");
        expect(result.message[0].text).toContain("user@test.com");
    });

    it("returns redacted event in enforce mode", () => {
        const { api, hooks } = createMockApi();
        registerBerryPulp(api, enforceConfig());

        const callback = hooks[HOOKS.TOOL_RESULT_PERSIST];
        const result = callback({ ...SECRET_PAYLOAD });

        // In enforce mode, secrets must be redacted
        expect(result.message[0].text).not.toContain("AKIAIOSFODNN7EXAMPLE");
    });

    it("logs structured would_redact event in audit mode", () => {
        const { api, hooks, logs } = createMockApi();
        registerBerryPulp(api, auditConfig());

        hooks[HOOKS.TOOL_RESULT_PERSIST]({ ...SECRET_PAYLOAD });

        const auditLog = logs.find(l => l.msg.includes(AUDIT_DECISIONS.WOULD_REDACT));
        expect(auditLog).toBeDefined();
        const parsed = JSON.parse(auditLog!.msg.split("Berry.Pulp: ")[1]);
        expect(parsed.decision).toBe(AUDIT_DECISIONS.WOULD_REDACT);
        expect(parsed.layer).toBe(SECURITY_LAYERS.PULP);
        expect(parsed.count).toBeGreaterThan(0);
        expect(parsed.types.length).toBeGreaterThan(0);
    });

    it("does NOT log would_redact in enforce mode", () => {
        const { api, hooks, logs } = createMockApi();
        registerBerryPulp(api, enforceConfig());

        hooks[HOOKS.TOOL_RESULT_PERSIST]({ ...SECRET_PAYLOAD });

        const auditLog = logs.find(l => l.msg.includes(AUDIT_DECISIONS.WOULD_REDACT));
        expect(auditLog).toBeUndefined();
    });
});
