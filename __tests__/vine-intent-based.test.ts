import { describe, expect, it, vi, beforeEach } from "vitest";
import { registerBerryVine } from "../src/layers/vine";
import { registerBerryStem } from "../src/layers/stem";
import { DEFAULT_CONFIG } from "../src/config/defaults";
import { HOOKS } from "../src/constants";
import {
    getSharedVineConfirmStateManager,
    resetSharedVineConfirmStateManagerForTests,
} from "../src/vine/confirm-state";
import { createVineIntentFromOperationTarget } from "../src/vine/authorization-intent";
import { resetSharedVineSessionBindingManagerForTests, getSharedVineSessionBindingManager } from "../src/vine/session-binding";
import { resetSharedVineStateManagerForTests } from "../src/vine/runtime-state";

function createApi() {
    const handlers = new Map<string, (...args: any[]) => any>();
    let registeredTool: any;
    const api = {
        on: vi.fn((hook: string, handler: (...args: any[]) => any) => {
            handlers.set(hook, handler);
        }),
        registerTool: vi.fn((tool: any) => {
            if (tool?.name === "berry_check") {
                registeredTool = tool;
            }
        }),
        logger: {
            debug: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            error: vi.fn(),
        },
    };
    return { api, handlers, getBerryCheckTool: () => registeredTool };
}

describe("Berry.Vine Fuzzy-Granting", () => {
    beforeEach(() => {
        resetSharedVineConfirmStateManagerForTests();
        resetSharedVineSessionBindingManagerForTests();
        resetSharedVineStateManagerForTests();
    });

    it("allows a refined command when the extracted intent is equivalent", async () => {
        const { api, handlers, getBerryCheckTool } = createApi();
        const config = {
            ...DEFAULT_CONFIG,
            mode: "enforce" as const,
            layers: { ...DEFAULT_CONFIG.layers, vine: true },
            vine: { ...DEFAULT_CONFIG.vine, mode: "strict" as const }
        };

        registerBerryVine(api as any, config);
        registerBerryStem(api as any, config);

        const confirmState = getSharedVineConfirmStateManager(
            config.vine.retention,
            config.vine.confirmation
        );
        const sessionKey = "sess-1";

        // Bind the session so it's not denied immediately
        const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
        const binding = sessionBindings.bindKnownSession({
            sessionKey,
            channelId: "chan-1",
            accountId: "acc-1",
        }, sessionKey);

        // Simulate risk to trigger Vine
        handlers.get(HOOKS.TOOL_RESULT_PERSIST)?.({
            toolName: "web_fetch",
            toolCallId: "tc-fuzzy-1",
            message: [{ type: "text", text: "external content" }],
        }, { toolName: "web_fetch", sessionKey });

        // 1. Issue a challenge for a base command
        const baseTarget = "curl https://example.com";
        const challenge = confirmState.issueChallenge({
            sessionKey,
            chatBindingKey: binding?.chatBindingKey,
            operation: "exec",
            target: baseTarget,
            intent: createVineIntentFromOperationTarget("exec", baseTarget),
            rawTarget: baseTarget,
            riskWindowId: "rw1",
        });

        // 2. Approve it
        confirmState.approvePendingByChatBindingKeys({
            chatBindingKeys: [binding?.chatBindingKey ?? sessionKey],
            confirmCode: challenge.confirmCode,
            senderId: "human-1",
        });

        // 3. Try to execute a refined command with the same external intent
        const refinedTarget = "curl https://example.com | grep 'domain'";
        const result = await getBerryCheckTool().execute("check-1", {
            operation: "exec",
            target: refinedTarget,
            sessionKey,
            runId: "run-1",
        });

        expect(result.details?.status).toBe("allowed");
        expect(String(result.content?.[0]?.text ?? "")).toContain("STATUS: ALLOWED");
    });

    it("blocks a completely different command even if another was approved", async () => {
        const { api, handlers, getBerryCheckTool } = createApi();
        const config = {
            ...DEFAULT_CONFIG,
            mode: "enforce" as const,
            layers: { ...DEFAULT_CONFIG.layers, vine: true },
            vine: { ...DEFAULT_CONFIG.vine, mode: "strict" as const }
        };

        registerBerryVine(api as any, config);
        registerBerryStem(api as any, config);

        const confirmState = getSharedVineConfirmStateManager(
            config.vine.retention,
            config.vine.confirmation
        );
        const sessionKey = "sess-2";

        // Bind the session
        const sessionBindings = getSharedVineSessionBindingManager(config.vine.retention);
        const binding = sessionBindings.bindKnownSession({
            sessionKey,
            channelId: "chan-2",
            accountId: "acc-2",
        }, sessionKey);

        // Simulate risk
        handlers.get(HOOKS.TOOL_RESULT_PERSIST)?.({
            toolName: "web_fetch",
            toolCallId: "tc-fuzzy-2",
            message: [{ type: "text", text: "external content" }],
        }, { toolName: "web_fetch", sessionKey });

        // Approve base command
        const challenge = confirmState.issueChallenge({
            sessionKey,
            chatBindingKey: binding?.chatBindingKey,
            operation: "exec",
            target: "curl https://example.com",
            riskWindowId: "rw-1"
        });
        confirmState.approvePendingByChatBindingKeys({
            chatBindingKeys: [binding?.chatBindingKey ?? sessionKey],
            confirmCode: challenge.confirmCode,
            senderId: "h1"
        });

        // Try a different non-destructive command
        const result = await getBerryCheckTool().execute("check-2", {
            operation: "exec",
            target: "curl https://another-site.com",
            sessionKey,
            runId: "run-2",
        });

        expect(result.details?.status).toBe("confirm_required");
        expect(String(result.content?.[0]?.text ?? "")).toContain("STATUS: CONFIRM_REQUIRED");
    });

    it("works with execution allowances during resume when the intent is equivalent", async () => {
        const { api, handlers } = createApi();
        const config = {
            ...DEFAULT_CONFIG,
            mode: "enforce" as const,
            layers: { ...DEFAULT_CONFIG.layers, vine: true },
            vine: { ...DEFAULT_CONFIG.vine, mode: "strict" as const }
        };

        registerBerryVine(api as any, config);
        registerBerryStem(api as any, config);

        const confirmState = getSharedVineConfirmStateManager(
            config.vine.retention,
            config.vine.confirmation
        );
        const sessionKey = "sess-3";
        const runId = "run-resume";

        // 1. Manually grant an allowance for a base command
        confirmState.grantExecutionAllowance({
            sessionKey,
            runId,
            operation: "exec",
            target: "curl https://example.com",
            resumeToken: "vres_123",
            intent: createVineIntentFromOperationTarget("exec", "curl https://example.com"),
        });

        // 2. Try to execute a refined command during the resume turn
        const result = await handlers.get(HOOKS.BEFORE_TOOL_CALL)?.({
            toolName: "run_command",
            params: { command: "curl https://example.com | grep domain" },
        }, { sessionKey, runId });

        // Should be allowed by fuzzy matching the allowance
        expect(result?.block).toBeUndefined();
    });

    it("does not allow substring-only refinement without intent metadata", async () => {
        const config = {
            ...DEFAULT_CONFIG,
            mode: "enforce" as const,
            layers: { ...DEFAULT_CONFIG.layers, vine: true },
            vine: { ...DEFAULT_CONFIG.vine, mode: "strict" as const }
        };

        const confirmState = getSharedVineConfirmStateManager(
            config.vine.retention,
            config.vine.confirmation
        );
        const sessionKey = "sess-4";
        const runId = "run-no-legacy-fallback";

        confirmState.grantExecutionAllowance({
            sessionKey,
            runId,
            operation: "exec",
            target: "curl https://example.com",
            resumeToken: "vres_456",
        });

        const consumed = confirmState.consumeExecutionAllowance({
            sessionKey,
            runId,
            operation: "exec",
            target: "curl https://example.com && echo extra-step",
        });

        expect(consumed).toBe(false);
    });
});
