import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerBerryThorn } from "../src/layers/thorn";
import { DEFAULT_CONFIG } from "../src/config/defaults";
import { HOOKS } from "../src/constants";

const { appendAuditEventMock, notifyPolicyDeniedMock } = vi.hoisted(() => ({
    appendAuditEventMock: vi.fn(),
    notifyPolicyDeniedMock: vi.fn(),
}));

vi.mock("../src/audit/writer", () => ({
    appendAuditEvent: appendAuditEventMock,
}));

vi.mock("../src/policy/runtime-state", () => ({
    notifyPolicyDenied: notifyPolicyDeniedMock,
}));

function createApi() {
    const handlers = new Map<string, (...args: any[]) => any>();
    const api = {
        on: vi.fn((hook: string, handler: (...args: any[]) => any) => {
            handlers.set(hook, handler);
        }),
        logger: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    };
    return { api, handlers };
}

function createConfig(mode: "enforce" | "audit" = "enforce") {
    return {
        ...DEFAULT_CONFIG,
        mode,
        layers: { ...DEFAULT_CONFIG.layers, thorn: true },
    };
}

describe("Berry.Thorn", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        appendAuditEventMock.mockReset();
        notifyPolicyDeniedMock.mockReset();
    });

    it("does not register hooks when layer is disabled", () => {
        const { api, handlers } = createApi();
        registerBerryThorn(api as any, {
            ...createConfig(),
            layers: { ...createConfig().layers, thorn: false },
        } as any);

        expect(api.on).not.toHaveBeenCalled();
        expect(handlers.has(HOOKS.BEFORE_TOOL_CALL)).toBe(false);
        expect(api.logger.info).toHaveBeenCalledWith("[berry-shield][runtime] Berry.Thorn layer disabled");
    });

    it("registers before_tool_call when enabled", () => {
        const { api, handlers } = createApi();
        registerBerryThorn(api as any, createConfig() as any);

        expect(api.on).toHaveBeenCalledWith(
            HOOKS.BEFORE_TOOL_CALL,
            expect.any(Function),
            { priority: 200 }
        );
        expect(handlers.has(HOOKS.BEFORE_TOOL_CALL)).toBe(true);
        expect(api.logger.debug).toHaveBeenCalledWith("[berry-shield][layer-trace] Berry.Thorn layer registered (Tool Blocker)");
    });

    it("logs would_block and does not block in audit mode", () => {
        const { api, handlers } = createApi();
        registerBerryThorn(api as any, createConfig("audit") as any);

        const callback = handlers.get(HOOKS.BEFORE_TOOL_CALL)!;
        const result = callback({
            toolName: "run_command",
            params: { command: "rm -rf /" },
        });

        expect(result).toBeUndefined();
        expect(appendAuditEventMock).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: "audit",
                decision: "would_block",
                layer: "thorn",
            })
        );
        expect(api.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining("[berry-shield][security] Berry.Thorn: ")
        );
        expect(notifyPolicyDeniedMock).not.toHaveBeenCalled();
    });

    it("blocks destructive commands and notifies policy denial in enforce mode", () => {
        const { api, handlers } = createApi();
        registerBerryThorn(api as any, createConfig("enforce") as any);

        const callback = handlers.get(HOOKS.BEFORE_TOOL_CALL)!;
        const result = callback(
            {
                toolName: "run_command",
                params: { command: "rm -rf /" },
            },
            { sessionKey: "agent:main:main" }
        );

        expect(result.block).toBe(true);
        expect(result.blockReason).toContain("Berry Shield");
        expect(appendAuditEventMock).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: "enforce",
                decision: "blocked",
                layer: "thorn",
            })
        );
        expect(notifyPolicyDeniedMock).toHaveBeenCalledWith("agent:main:main", expect.any(Number), false);
        expect(api.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining("[berry-shield][security] Berry.Thorn: BLOCKED - Destructive command detected")
        );
    });

    it("uses compat logging when sessionKey is missing and global escalation is disabled", () => {
        const { api, handlers } = createApi();
        registerBerryThorn(api as any, {
            ...createConfig("enforce"),
            policy: {
                ...createConfig("enforce").policy,
                adaptive: {
                    ...createConfig("enforce").policy.adaptive,
                    allowGlobalEscalation: false,
                },
            },
        } as any);

        const callback = handlers.get(HOOKS.BEFORE_TOOL_CALL)!;
        callback({
            toolName: "read_file",
            params: { path: "/home/user/.env" },
        });

        expect(api.logger.warn).toHaveBeenCalledWith(
            "[berry-shield][compat] Berry.Thorn: sessionKey missing, skipping adaptive escalation"
        );
        expect(notifyPolicyDeniedMock).not.toHaveBeenCalled();
    });

    it("blocks commands that reference openclaw.json as sensitive file path", () => {
        const { api, handlers } = createApi();
        registerBerryThorn(api as any, createConfig("enforce") as any);

        const callback = handlers.get(HOOKS.BEFORE_TOOL_CALL)!;
        const result = callback(
            {
                toolName: "run_command",
                params: { command: "cat /home/user/.openclaw/openclaw.json" },
            },
            { sessionKey: "agent:main:main" }
        );

        expect(result.block).toBe(true);
        expect(result.blockReason).toContain("Command references sensitive file");
        expect(appendAuditEventMock).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: "enforce",
                decision: "blocked",
                layer: "thorn",
            })
        );
    });
});
