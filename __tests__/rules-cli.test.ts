import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    headerMock,
    tableMock,
    sectionMock,
    successMsgMock,
    warningMsgMock,
    failureMsgMock,
    rowMock,
    loadCustomRulesMock,
    removeCustomRuleMock,
    disableBuiltInRuleMock,
    restoreBuiltInRuleMock,
    saveCustomRulesMock,
    confirmMock,
    isCancelMock,
    cancelMock,
} = vi.hoisted(() => ({
    headerMock: vi.fn(),
    tableMock: vi.fn(),
    sectionMock: vi.fn(),
    successMsgMock: vi.fn(),
    warningMsgMock: vi.fn(),
    failureMsgMock: vi.fn(),
    rowMock: vi.fn(),
    loadCustomRulesMock: vi.fn(),
    removeCustomRuleMock: vi.fn(),
    disableBuiltInRuleMock: vi.fn(),
    restoreBuiltInRuleMock: vi.fn(),
    saveCustomRulesMock: vi.fn(),
    confirmMock: vi.fn(),
    isCancelMock: vi.fn(),
    cancelMock: vi.fn(),
}));

vi.mock("../src/cli/ui/tui.js", () => ({
    ui: {
        scaffold: ({ header, content, bottom }: any) => {
            const slot = {
                header: headerMock,
                table: tableMock,
                section: sectionMock,
                successMsg: successMsgMock,
                warningMsg: warningMsgMock,
                failureMsg: failureMsgMock,
                row: rowMock,
                spacer: vi.fn(),
                divider: vi.fn(),
                footer: vi.fn(),
            };
            if (header) header(slot);
            content(slot);
            if (bottom) bottom(slot);
        },
    },
}));

vi.mock("@clack/prompts", () => ({
    confirm: confirmMock,
    isCancel: isCancelMock,
    cancel: cancelMock,
}));

vi.mock("../src/cli/storage.js", () => ({
    loadCustomRules: loadCustomRulesMock,
    removeCustomRule: removeCustomRuleMock,
    disableBuiltInRule: disableBuiltInRuleMock,
    restoreBuiltInRule: restoreBuiltInRuleMock,
    saveCustomRules: saveCustomRulesMock,
}));

vi.mock("../src/patterns/index.js", () => ({
    SECRET_PATTERNS: [{ id: "secret:openai-key", name: "OpenAI Key", pattern: /x/, category: "secret", placeholder: "x" }],
    PII_PATTERNS: [{ id: "pii:email", name: "Email", pattern: /x/, category: "pii", placeholder: "x" }],
    INTERNAL_SENSITIVE_FILE_PATTERNS: [{ id: "file:env", pattern: /\.env/i }],
    INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS: [{ id: "command:rm-family", pattern: /\brm\b/i }],
}));

import {
    rulesListCommand,
    rulesRemoveCommand,
    rulesDisableCommand,
    rulesEnableCommand,
} from "../src/cli/commands/rules.js";

describe("rules command", () => {
    const logger = { info: vi.fn(), warn: vi.fn(), debug: vi.fn() } as any;

    beforeEach(() => {
        vi.clearAllMocks();
        loadCustomRulesMock.mockResolvedValue({
            version: "1.0",
            secrets: [{ name: "HotTest", pattern: "x", placeholder: "[X]", addedAt: new Date().toISOString() }],
            sensitiveFiles: [],
            destructiveCommands: [],
            disabledBuiltInIds: [],
        });
        removeCustomRuleMock.mockResolvedValue({ success: true, removed: true });
        disableBuiltInRuleMock.mockResolvedValue({ success: true });
        restoreBuiltInRuleMock.mockResolvedValue({ success: true, restored: true });
        saveCustomRulesMock.mockResolvedValue(undefined);
        confirmMock.mockResolvedValue(true);
        isCancelMock.mockReturnValue(false);
    });

    it("lists baseline and custom rules", async () => {
        await rulesListCommand(logger);

        expect(headerMock).toHaveBeenCalledWith("Security Rules");
        expect(sectionMock).toHaveBeenCalledWith("Baseline (4)");
        expect(sectionMock).toHaveBeenCalledWith("Custom (1)");
        expect(tableMock).toHaveBeenCalledTimes(2);
    });

    it("removes custom rule when target is custom", async () => {
        await rulesRemoveCommand("custom", "HotTest", logger);
        expect(removeCustomRuleMock).toHaveBeenCalledWith("HotTest");
        expect(successMsgMock).toHaveBeenCalled();
    });

    it("fails remove when target is not custom", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);
        await expect(rulesRemoveCommand("baseline", "secret:openai-key", logger)).rejects.toThrow("EXIT_1");
        expect(failureMsgMock).toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it("fails remove when custom target has no name", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);
        await expect(rulesRemoveCommand("custom", undefined, logger)).rejects.toThrow("EXIT_1");
        expect(failureMsgMock).toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it("disables one baseline rule by id", async () => {
        await rulesDisableCommand("baseline", "secret:openai-key", {}, logger);
        expect(disableBuiltInRuleMock).toHaveBeenCalledWith("secret:openai-key");
        expect(successMsgMock).toHaveBeenCalled();
    });

    it("disables all baseline rules with --all", async () => {
        await rulesDisableCommand("baseline", undefined, { all: true, yes: true }, logger);
        expect(saveCustomRulesMock).toHaveBeenCalled();
        expect(successMsgMock).toHaveBeenCalled();
    });

    it("fails disable when both id and --all are provided", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);
        await expect(rulesDisableCommand("baseline", "secret:openai-key", { all: true }, logger)).rejects.toThrow("EXIT_1");
        expect(failureMsgMock).toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it("fails disable when neither id nor --all is provided", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);
        await expect(rulesDisableCommand("baseline", undefined, {}, logger)).rejects.toThrow("EXIT_1");
        expect(failureMsgMock).toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it("is idempotent when disabling an already disabled baseline rule", async () => {
        disableBuiltInRuleMock.mockResolvedValueOnce({ success: false, error: "Rule is already disabled." });
        await rulesDisableCommand("baseline", "secret:openai-key", {}, logger);
        expect(headerMock).toHaveBeenCalledWith("No Changes Applied");
        expect(warningMsgMock).toHaveBeenCalledWith("Baseline rule is already disabled.");
    });

    it("is idempotent when enabling all baseline rules and none are disabled", async () => {
        loadCustomRulesMock.mockResolvedValueOnce({
            version: "1.0",
            secrets: [],
            sensitiveFiles: [],
            destructiveCommands: [],
            disabledBuiltInIds: [],
        });
        await rulesEnableCommand("baseline", undefined, { all: true, yes: true }, logger);
        expect(headerMock).toHaveBeenCalledWith("No Changes Applied");
        expect(warningMsgMock).toHaveBeenCalledWith("All baseline rules are already enabled.");
    });

    it("fails enable when both id and --all are provided", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);
        await expect(rulesEnableCommand("baseline", "secret:openai-key", { all: true }, logger)).rejects.toThrow("EXIT_1");
        expect(failureMsgMock).toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it("fails enable when neither id nor --all is provided", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);
        await expect(rulesEnableCommand("baseline", undefined, {}, logger)).rejects.toThrow("EXIT_1");
        expect(failureMsgMock).toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it("fails disable when target is not baseline", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);
        await expect(rulesDisableCommand("custom", "secret:openai-key", {}, logger)).rejects.toThrow("EXIT_1");
        expect(failureMsgMock).toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it("fails enable when target is not baseline", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);
        await expect(rulesEnableCommand("custom", "secret:openai-key", {}, logger)).rejects.toThrow("EXIT_1");
        expect(failureMsgMock).toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it("fails enable with unknown baseline id", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);
        await expect(rulesEnableCommand("baseline", "secret:unknown", {}, logger)).rejects.toThrow("EXIT_1");
        expect(failureMsgMock).toHaveBeenCalledWith("Unknown baseline rule id: secret:unknown");
        exitSpy.mockRestore();
    });
});
