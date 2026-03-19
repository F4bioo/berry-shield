import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerBerryLeaf } from "../src/layers/leaf";
import { DEFAULT_CONFIG } from "../src/config/defaults";
import { HOOKS } from "../src/constants";

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

function createConfig() {
    return {
        ...DEFAULT_CONFIG,
        layers: { ...DEFAULT_CONFIG.layers, leaf: true },
    };
}

describe("Berry.Leaf", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("does not register hooks when layer is disabled", () => {
        const { api, handlers } = createApi();
        registerBerryLeaf(api as any, {
            ...createConfig(),
            layers: { ...createConfig().layers, leaf: false },
        } as any);

        expect(api.on).not.toHaveBeenCalled();
        expect(handlers.has(HOOKS.MESSAGE_RECEIVED)).toBe(false);
        expect(api.logger.info).toHaveBeenCalledWith("[berry-shield][runtime] Berry.Leaf layer disabled");
    });

    it("registers message_received hook when enabled", () => {
        const { api, handlers } = createApi();
        registerBerryLeaf(api as any, createConfig() as any);

        expect(api.on).toHaveBeenCalledWith(
            HOOKS.MESSAGE_RECEIVED,
            expect.any(Function),
            { priority: 50 }
        );
        expect(handlers.has(HOOKS.MESSAGE_RECEIVED)).toBe(true);
        expect(api.logger.debug).toHaveBeenCalledWith("[berry-shield][layer-trace] Berry.Leaf layer registered (Input Audit)");
    });

    it("logs warning when sensitive input is detected", () => {
        const { api, handlers } = createApi();
        registerBerryLeaf(api as any, createConfig() as any);

        const callback = handlers.get(HOOKS.MESSAGE_RECEIVED)!;
        const result = callback(
            {
                content: "my email is user@example.com and token is sk-1234567890abcdef1234567890abcdef",
                from: "u1",
                timestamp: "2026-02-22T00:00:00.000Z",
            },
            { conversationId: "c1" }
        );

        expect(result).toBeUndefined();
        expect(api.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining("[berry-shield][security] Berry.Leaf sensitive content detected")
        );
        expect(api.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining("berry:pii:email")
        );
        expect(api.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining("berry:secret:openai-key")
        );
    });

    it("logs debug-only audit entry for non-sensitive input", () => {
        const { api, handlers } = createApi();
        registerBerryLeaf(api as any, createConfig() as any);

        const callback = handlers.get(HOOKS.MESSAGE_RECEIVED)!;
        const result = callback(
            {
                content: "hello from a normal message",
                from: "u1",
                timestamp: "2026-02-22T00:00:00.000Z",
            },
            { conversationId: "c1" }
        );

        expect(result).toBeUndefined();
        expect(api.logger.warn).not.toHaveBeenCalledWith(
            expect.stringContaining("Leaf sensitive content detected")
        );
    });

    it("ignores empty message content", () => {
        const { api, handlers } = createApi();
        registerBerryLeaf(api as any, createConfig() as any);

        const callback = handlers.get(HOOKS.MESSAGE_RECEIVED)!;
        const beforeWarnCalls = (api.logger.warn as any).mock.calls.length;

        const result = callback(
            {
                content: "",
                from: "u1",
            },
            { conversationId: "c1" }
        );

        expect(result).toBeUndefined();
        expect((api.logger.warn as any).mock.calls.length).toBe(beforeWarnCalls);
    });
});
