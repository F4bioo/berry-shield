import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerBerryStem } from "../src/layers/stem";
import { DEFAULT_CONFIG } from "../src/config/defaults";
import { HOOKS } from "../src/constants";
import { resetSharedVineStateManagerForTests } from "../src/vine/runtime-state";
import { resetSharedVineConfirmStateManagerForTests } from "../src/vine/confirm-state";
import {
    getSharedVineSessionBindingManager,
    resetSharedVineSessionBindingManagerForTests,
} from "../src/vine/session-binding";

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
        resetSharedVineStateManagerForTests();
        resetSharedVineConfirmStateManagerForTests();
        resetSharedVineSessionBindingManagerForTests();
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
        expect(api.logger.info).toHaveBeenCalledWith("[berry-shield][runtime] Berry.Stem layer registered (Security Gate)");
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

    it("requires confirmation for compound exec with external fetch and inline local write without prior vine state", async () => {
        const { api, tools } = createApi();
        const config = {
            ...createConfig("enforce"),
            vine: {
                ...createConfig("enforce").vine,
                mode: "strict",
            },
        };
        const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
        sessionBindings.bindKnownSession({
            sessionKey: "s1",
            conversationId: "webchat:conv-exec-smoke",
            channelId: "webchat",
            accountId: "default",
        }, "s1");

        registerBerryStem(api as any, config as any);

        const execute = tools.find((tool) => tool.name === "berry_check")!.execute;
        const result = await execute("test-id", {
            operation: "exec",
            target: `python - <<'PY'
                        import urllib.request
                        from pathlib import Path
                        content = urllib.request.urlopen("https://example.com").read().decode("utf-8")
                        Path("/temp").mkdir(parents=True, exist_ok=True)
                        Path("/temp/google_first_button_word.txt").write_text(content)
                        PY`,
            sessionKey: "s1",
        });

        expect(result.details.status).toBe("confirm_required");
        expect(result.details.reason).toBe("external untrusted content risk (vine)");
        expect(result.details.confirmCode).toMatch(/^\d{4}$/);
        expect(result.details.confirmationStrategy).toBe("one_to_many");
        expect(result.details.confirmationStrategyLabel).toBe("1:N");
        expect(result.details.windowSeconds).toBeGreaterThan(0);
        expect(result.details.maxActionsPerWindow).toBeGreaterThan(0);
    });

    it("returns CONFIRM_REQUIRED for degraded Vine write confirmation without session identity", async () => {
        const { api, tools } = createApi();
        const config = {
            ...createConfig("enforce"),
            vine: {
                ...createConfig("enforce").vine,
                mode: "strict",
            },
        };

        registerBerryStem(api as any, config as any);

        const execute = tools.find((tool) => tool.name === "berry_check")!.execute;
        const result = await execute("test-id", {
            operation: "write",
            target: "/tmp/degraded-binding-proof.txt",
        });

        expect(result.details.status).toBe("confirm_required");
        expect(result.details.reason).toBe("external untrusted content risk (vine)");
        expect(result.details.confirmCode).toMatch(/^\d{4}$/);
        expect(result.details.confirmationStrategy).toBe("one_to_many");
        expect(String(result.content?.[0]?.text ?? "")).toContain("STATUS: CONFIRM_REQUIRED");
        expect(String(result.content?.[0]?.text ?? "")).toContain("CONFIRM_STRATEGY: 1:N");
    });
});
