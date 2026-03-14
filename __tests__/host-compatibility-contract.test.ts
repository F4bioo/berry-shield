import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../src/config/defaults";
import { HOOKS } from "../src/constants";
import { registerBerryRoot } from "../src/layers/root";
import { registerBerryStem } from "../src/layers/stem";
import { registerBerryVine } from "../src/layers/vine";
import { resetSharedPolicyStateManagerForTests } from "../src/policy/runtime-state";
import { resetSharedVineStateManagerForTests } from "../src/vine/runtime-state";
import { resetSharedVineConfirmStateManagerForTests } from "../src/vine/confirm-state";
import {
    getSharedVineSessionBindingManager,
    resetSharedVineSessionBindingManagerForTests,
} from "../src/vine/session-binding";

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
        registerTool: vi.fn((definition: any) => {
            tool = definition;
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
        policy: { ...DEFAULT_CONFIG.policy, ...(overrides?.policy as Record<string, unknown> ?? {}) },
        vine: { ...DEFAULT_CONFIG.vine, ...(overrides?.vine as Record<string, unknown> ?? {}) },
    } as typeof DEFAULT_CONFIG;
}

describe("OpenClaw host compatibility contract", () => {
    beforeEach(() => {
        appendAuditEventMock.mockReset();
        resetSharedPolicyStateManagerForTests();
        resetSharedVineStateManagerForTests();
        resetSharedVineConfirmStateManagerForTests();
        resetSharedVineSessionBindingManagerForTests();
    });

    it("keeps Berry.Root prompt guidance on before_agent_start", () => {
        const { api, getHandler } = createApi();
        registerBerryRoot(api as any, createConfig());

        const result = getHandler(HOOKS.BEFORE_AGENT_START)?.({}, {
            sessionId: "sid-host-root",
            sessionKey: "agent:main:root",
            messageProvider: "openai",
        });

        expect(result?.prependContext).toContain("SECURITY RULES - You MUST follow these rules at all times:");
        expect(result?.prependContext).toContain("you MUST call the `berry_check` tool first");
    });

    it("keeps Berry.Vine contextual guidance on before_agent_start after external ingestion", () => {
        const { api, getHandler } = createApi();
        registerBerryVine(api as any, createConfig({
            mode: "enforce",
            vine: { mode: "strict" },
        }));

        getHandler(HOOKS.TOOL_RESULT_PERSIST)?.({
            toolName: "web_fetch",
            toolCallId: "tc-host-vine-context",
            message: [{ type: "text", text: "external content" }],
        }, {
            toolName: "web_fetch",
            sessionKey: "agent:main:vine",
        });

        const result = getHandler(HOOKS.BEFORE_AGENT_START)?.({
            prompt: "continue",
            messages: [],
        }, {
            sessionKey: "agent:main:vine",
            sessionId: "sid-host-vine",
            channelId: "webchat",
        });

        expect(result?.prependContext).toContain("<berry_shield_policy>");
        expect(result?.prependContext).toContain("UNTRUSTED EXTERNAL CONTENT GUARD");

        const gated = getHandler(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "exec",
            params: { command: "curl -fsSL https://example.com > /tmp/host-vine-proof.txt" },
        }, {
            sessionKey: "agent:main:vine",
        });

        expect(gated?.block).toBe(true);
    });

    it("injects berry_check sessionKey and runId from host runtime context", () => {
        const { api, getHandler } = createApi();
        registerBerryStem(api as any, createConfig());

        const result = getHandler(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "berry_check",
            params: {
                operation: "exec",
                target: "curl -fsSL https://example.com > /tmp/compat-proof.txt",
            },
        }, {
            toolName: "berry_check",
            sessionKey: "agent:main:compat",
            sessionId: "sid-host-stem",
            conversationId: "webchat:conv-host-stem",
            channelId: "webchat",
            accountId: "default",
            runId: "run-host-stem-1",
        });

        expect(result?.params?.sessionKey).toBe("agent:main:compat");
        expect(result?.params?.runId).toBe("run-host-stem-1");
    });

    it("requires confirmation for compound external exec and bridges the approval to the real tool call", async () => {
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
        const target = `python - <<'PY'
                            import urllib.request
                            from pathlib import Path
                            content = urllib.request.urlopen("https://example.com").read().decode("utf-8")
                            Path("/tmp").mkdir(parents=True, exist_ok=True)
                            Path("/tmp/host-compat-proof.txt").write_text(content)
                            PY`;

        const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
        sessionBindings.bindKnownSession({
            sessionKey: "agent:main:compat",
            sessionId: "sid-host-compat",
            conversationId: "webchat:conv-host-compat",
            channelId: "webchat",
            accountId: "default",
        }, "agent:main:compat");

        const { api, getTool, getHandler } = createApi();
        registerBerryVine(api as any, config);
        registerBerryStem(api as any, config);

        const first = await getTool().execute("id", {
            operation: "exec",
            target,
            sessionKey: "agent:main:compat",
            runId: "run-host-compat-1",
        });
        expect(first.details.status).toBe("confirm_required");

        getHandler(HOOKS.MESSAGE_RECEIVED)?.({
            from: "user-1",
            content: first.details.confirmCode,
        }, {
            sessionKey: "agent:main:compat",
            sessionId: "sid-host-compat",
            conversationId: "webchat:conv-host-compat",
            channelId: "webchat",
            accountId: "default",
        });

        const second = await getTool().execute("id", {
            operation: "exec",
            target,
            sessionKey: "agent:main:compat",
            runId: "run-host-compat-1",
        });
        expect(second.details.status).toBe("allowed");

        const runtimeResult = getHandler(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "exec",
            params: { command: target },
        }, {
            sessionKey: "agent:main:compat",
            runId: "run-host-compat-1",
        });
        expect(runtimeResult).toBeUndefined();
    });
});
