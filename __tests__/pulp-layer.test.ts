import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerBerryPulp } from "../src/layers/pulp";
import { DEFAULT_CONFIG } from "../src/config/defaults";
import { HOOKS } from "../src/constants";

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
        layers: { ...DEFAULT_CONFIG.layers, pulp: true },
    };
}

describe("Berry.Pulp", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        appendAuditEventMock.mockReset();
    });

    it("does not register hooks when layer is disabled", () => {
        const { api, handlers } = createApi();
        registerBerryPulp(api as any, {
            ...createConfig(),
            layers: { ...createConfig().layers, pulp: false },
        } as any);

        expect(api.on).not.toHaveBeenCalled();
        expect(handlers.has(HOOKS.TOOL_RESULT_PERSIST)).toBe(false);
        expect(handlers.has(HOOKS.MESSAGE_SENDING)).toBe(false);
        expect(api.logger.info).toHaveBeenCalledWith("[berry-shield][runtime] Berry.Pulp layer disabled");
    });

    it("registers tool_result_persist and message_sending hooks when enabled", () => {
        const { api, handlers } = createApi();
        registerBerryPulp(api as any, createConfig() as any);

        expect(api.on).toHaveBeenCalledWith(
            HOOKS.TOOL_RESULT_PERSIST,
            expect.any(Function),
            { priority: 200 }
        );
        expect(api.on).toHaveBeenCalledWith(
            HOOKS.MESSAGE_SENDING,
            expect.any(Function),
            { priority: 200 }
        );
        expect(handlers.has(HOOKS.TOOL_RESULT_PERSIST)).toBe(true);
        expect(handlers.has(HOOKS.MESSAGE_SENDING)).toBe(true);
        expect(api.logger.debug).toHaveBeenCalledWith("[berry-shield][layer-trace] Berry.Pulp layer registered (Output Scanner)");
    });

    it("redacts tool_result_persist content in enforce mode", () => {
        const { api, handlers } = createApi();
        registerBerryPulp(api as any, createConfig("enforce") as any);

        const callback = handlers.get(HOOKS.TOOL_RESULT_PERSIST)!;
        const result = callback({
            toolName: "config_get",
            message: "token=sk-abc123def456ghi789jkl012",
        });

        expect(result.message).not.toContain("sk-abc123def456ghi789jkl012");
        expect(result.message).toContain("[OPENAI_KEY_REDACTED]");
        expect(appendAuditEventMock).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: "enforce",
                decision: "redacted",
                layer: "pulp",
                hook: "tool_result_persist",
            })
        );
        expect(api.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining("[berry-shield][security] Berry.Pulp redacted")
        );
    });

    it("keeps original tool_result_persist content in audit mode and emits would_redact", () => {
        const { api, handlers } = createApi();
        registerBerryPulp(api as any, createConfig("audit") as any);

        const callback = handlers.get(HOOKS.TOOL_RESULT_PERSIST)!;
        const event = {
            toolName: "config_get",
            message: "token=sk-abc123def456ghi789jkl012",
        };
        const result = callback(event);

        expect(result).toEqual(event);
        expect(appendAuditEventMock).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: "audit",
                decision: "would_redact",
                layer: "pulp",
                hook: "tool_result_persist",
            })
        );
        expect(api.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining("[berry-shield][security] Berry.Pulp:")
        );
    });

    it("strips leaked policy block from outgoing message even without secret matches", () => {
        const { api, handlers } = createApi();
        registerBerryPulp(api as any, createConfig("enforce") as any);

        const callback = handlers.get(HOOKS.MESSAGE_SENDING)!;
        const result = callback({
            content: "<berry_shield_policy>secret policy</berry_shield_policy>\n\nhello user",
        });

        expect(result).toEqual({ content: "hello user" });
        expect(api.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining("Pulp stripped leaked <berry_shield_policy> block")
        );
    });

    it("returns undefined when outgoing message needs no changes", () => {
        const { api, handlers } = createApi();
        registerBerryPulp(api as any, createConfig("enforce") as any);

        const callback = handlers.get(HOOKS.MESSAGE_SENDING)!;
        const result = callback({
            content: "hello from berry shield",
        });

        expect(result).toBeUndefined();
        expect(api.logger.warn).not.toHaveBeenCalled();
    });
});
