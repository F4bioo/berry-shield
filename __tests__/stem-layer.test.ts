import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerBerryStem } from "../src/layers/stem";
import { DEFAULT_CONFIG } from "../src/config/defaults";
import { HOOKS } from "../src/constants";

const { appendAuditEventMock, notifyPolicyDeniedMock } = vi.hoisted(() => ({
    appendAuditEventMock: vi.fn(),
    notifyPolicyDeniedMock: vi.fn(),
}));

vi.mock("../src/audit/writer", () => ({
    appendAuditEvent: appendAuditEventMock,
}));

vi.mock("../src/policy/runtime-state", async () => {
    const actual = await vi.importActual("../src/policy/runtime-state");
    return {
        ...actual,
        notifyPolicyDenied: notifyPolicyDeniedMock,
    };
});

function createApi() {
    const handlers = new Map<string, (...args: any[]) => any>();
    const tools: Array<{ name: string; execute: (id: string, params: Record<string, unknown>) => Promise<any> }> = [];
    const api = {
        on: vi.fn((hook: string, handler: (...args: any[]) => any) => {
            handlers.set(hook, handler);
        }),
        registerTool: vi.fn((definition: any) => {
            tools.push(definition);
        }),
        logger: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    };
    return { api, handlers, tools };
}

function createConfig(mode: "enforce" | "audit" = "enforce") {
    return {
        ...DEFAULT_CONFIG,
        mode,
        layers: { ...DEFAULT_CONFIG.layers, stem: true },
    };
}

describe("Berry.Stem", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        appendAuditEventMock.mockReset();
        notifyPolicyDeniedMock.mockReset();
    });

    it("does not register hooks or tools when layer is disabled", () => {
        const { api, handlers, tools } = createApi();
        registerBerryStem(api as any, {
            ...createConfig(),
            layers: { ...createConfig().layers, stem: false },
        } as any);

        expect(api.on).not.toHaveBeenCalled();
        expect(api.registerTool).not.toHaveBeenCalled();
        expect(handlers.has(HOOKS.BEFORE_TOOL_CALL)).toBe(false);
        expect(tools).toHaveLength(0);
        expect(api.logger.info).toHaveBeenCalledWith("[berry-shield][runtime] Berry.Stem layer disabled");
    });

    it("registers berry_check tool and hook when enabled", () => {
        const { api, handlers, tools } = createApi();
        registerBerryStem(api as any, createConfig() as any);

        expect(handlers.has(HOOKS.BEFORE_TOOL_CALL)).toBe(true);
        expect(tools.some((tool) => tool.name === "berry_check")).toBe(true);
        expect(api.logger.info).toHaveBeenCalledWith("[berry-shield][runtime] Berry.Stem layer registered");
    });

    it("logs would_block in audit mode for destructive exec", async () => {
        const { api, tools } = createApi();
        registerBerryStem(api as any, createConfig("audit") as any);

        const execute = tools.find((tool) => tool.name === "berry_check")!.execute;
        const result = await execute("test-id", { operation: "exec", target: "rm -rf /" });

        expect(result.details.status).toBe("allowed");
        expect(appendAuditEventMock).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: "audit",
                decision: "would_block",
                layer: "stem",
            })
        );
        expect(api.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining("[berry-shield][security] Berry.Stem: ")
        );
    });

    it("uses compat logging when adaptive escalation has no sessionKey", async () => {
        const { api, tools } = createApi();
        registerBerryStem(api as any, {
            ...createConfig("enforce"),
            policy: {
                ...createConfig("enforce").policy,
                adaptive: {
                    ...createConfig("enforce").policy.adaptive,
                    allowGlobalEscalation: false,
                },
            },
        } as any);

        const execute = tools.find((tool) => tool.name === "berry_check")!.execute;
        const result = await execute("test-id", { operation: "read", target: ".env" });

        expect(result.details.status).toBe("denied");
        expect(api.logger.warn).toHaveBeenCalledWith(
            "[berry-shield][compat] Berry.Stem: sessionKey missing, skipping adaptive escalation"
        );
        expect(notifyPolicyDeniedMock).not.toHaveBeenCalled();
    });
});
