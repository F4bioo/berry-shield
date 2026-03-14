import { describe, expect, it, vi } from "vitest";
import { registerBerryStem } from "../src/layers/stem";
import { DEFAULT_CONFIG } from "../src/config/defaults";
import { HOOKS } from "../src/constants";
import {
    getSharedVineSessionBindingManager,
    resetSharedVineSessionBindingManagerForTests,
} from "../src/vine/session-binding";

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
    it("warms the session binding from berry_check runtime context", () => {
        resetSharedVineSessionBindingManagerForTests();
        const { api, handlers } = createApi();
        registerBerryStem(api as any, DEFAULT_CONFIG);

        const beforeToolCall = handlers.get(HOOKS.BEFORE_TOOL_CALL);
        const result = beforeToolCall?.(
            {
                toolName: "berry_check",
                params: {
                    operation: "exec",
                    target: "curl -fsSL https://example.com > /tmp/proof.txt",
                },
            },
            {
                toolName: "berry_check",
                sessionKey: "agent:main:main",
                sessionId: "sid-1",
                conversationId: "conv-1",
                channelId: "webchat",
                accountId: "default",
            }
        );

        const bindings = getSharedVineSessionBindingManager(DEFAULT_CONFIG.vine.retention);
        const binding = bindings.getBindingForSession("agent:main:main");

        expect(result?.params?.sessionKey).toBe("agent:main:main");
        expect(binding?.conversationId).toBe("conv-1");
        expect(binding?.channelId).toBe("webchat");
    });

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

    it("injects a resolved sessionKey from sessionId when ctx.sessionKey is missing", () => {
        resetSharedVineSessionBindingManagerForTests();
        const bindings = getSharedVineSessionBindingManager(DEFAULT_CONFIG.vine.retention);
        bindings.bindKnownSession({
            sessionKey: "agent:main:main",
            sessionId: "sid-restore-1",
            conversationId: "conv-restore-1",
            channelId: "webchat",
            accountId: "default",
        }, "agent:main:main");

        const { api, handlers } = createApi();
        registerBerryStem(api as any, DEFAULT_CONFIG);

        const beforeToolCall = handlers.get(HOOKS.BEFORE_TOOL_CALL);
        const result = beforeToolCall?.(
            {
                toolName: "berry_check",
                params: {
                    operation: "write",
                    target: "/tmp/proof.txt",
                },
            },
            {
                toolName: "berry_check",
                sessionId: "sid-restore-1",
                conversationId: "conv-restore-1",
                channelId: "webchat",
                accountId: "default",
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
