import { describe, expect, it, vi } from "vitest";
import { registerBerryStem } from "../src/layers/stem";
import { DEFAULT_CONFIG } from "../src/config/defaults";
import { HOOKS } from "../src/constants";

function createApi() {
    const handlers = new Map<string, (...args: any[]) => any>();
    const api = {
        on: vi.fn((hook: string, handler: (...args: any[]) => any) => {
            handlers.set(hook, handler);
        }),
        registerTool: vi.fn(),
        logger: {
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
            error: vi.fn(),
        },
    };
    return { api, handlers };
}

describe("Berry.Stem berry_check sessionKey auto-injection", () => {
    it("injects ctx.sessionKey when berry_check params.sessionKey is missing", () => {
        const { api, handlers } = createApi();
        registerBerryStem(api as any, DEFAULT_CONFIG);

        const beforeToolCall = handlers.get(HOOKS.BEFORE_TOOL_CALL);
        expect(beforeToolCall).toBeDefined();

        const result = beforeToolCall?.(
            {
                toolName: "berry_check",
                params: {
                    operation: "exec",
                    target: "bash -lc 'printf test > /tmp/proof.txt'",
                },
            },
            {
                toolName: "berry_check",
                sessionKey: "agent:main:main",
            }
        );

        expect(result?.params?.sessionKey).toBe("agent:main:main");
    });

    it("does not override explicit params.sessionKey", () => {
        const { api, handlers } = createApi();
        registerBerryStem(api as any, DEFAULT_CONFIG);

        const beforeToolCall = handlers.get(HOOKS.BEFORE_TOOL_CALL);
        const result = beforeToolCall?.(
            {
                toolName: "berry_check",
                params: {
                    operation: "exec",
                    target: "bash -lc 'printf test > /tmp/proof.txt'",
                    sessionKey: "agent:custom:session",
                },
            },
            {
                toolName: "berry_check",
                sessionKey: "agent:main:main",
            }
        );

        expect(result).toBeUndefined();
    });

    it("does nothing for non-berry_check tools", () => {
        const { api, handlers } = createApi();
        registerBerryStem(api as any, DEFAULT_CONFIG);

        const beforeToolCall = handlers.get(HOOKS.BEFORE_TOOL_CALL);
        const result = beforeToolCall?.(
            {
                toolName: "web_fetch",
                params: { url: "https://example.com" },
            },
            {
                toolName: "web_fetch",
                sessionKey: "agent:main:main",
            }
        );

        expect(result).toBeUndefined();
    });

    it("does not inject when context has no sessionKey", () => {
        const { api, handlers } = createApi();
        registerBerryStem(api as any, DEFAULT_CONFIG);

        const beforeToolCall = handlers.get(HOOKS.BEFORE_TOOL_CALL);
        const result = beforeToolCall?.(
            {
                toolName: "berry_check",
                params: {
                    operation: "exec",
                    target: "bash -lc 'printf test > /tmp/proof.txt'",
                },
            },
            {
                toolName: "berry_check",
            }
        );

        expect(result).toBeUndefined();
    });
});

