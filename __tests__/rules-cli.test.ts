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
    beforeEach(() => {
        vi.clearAllMocks();
        loadCustomRulesMock.mockResolvedValue({
            version: "1.0",
            secrets: [{ name: "HotTest", pattern: "x", placeholder: "[X]", addedAt: new Date().toISOString() }],
            sensitiveFiles: [],
            destructiveCommands: [],
            disabledBuiltInIds: [],
        });
        disableBuiltInRuleMock.mockResolvedValue({ success: true });
        restoreBuiltInRuleMock.mockResolvedValue({ success: true, restored: true });
        saveCustomRulesMock.mockResolvedValue(undefined);
        confirmMock.mockResolvedValue(true);
        isCancelMock.mockReturnValue(false);
    });

    it("lists baseline and custom rules", async () => {
        await rulesListCommand();

        expect(headerMock).toHaveBeenCalledWith("Security Rules");
        expect(sectionMock).toHaveBeenCalledWith("Baseline (4)");
        expect(sectionMock).toHaveBeenCalledWith("Custom (1)");
        expect(tableMock).toHaveBeenCalledTimes(2);
    });

    it("lists full patterns when --detailed is provided", async () => {
        loadCustomRulesMock.mockResolvedValueOnce({
            version: "1.0",
            secrets: [{ name: "HotTest", pattern: "HOT_[A-Z0-9]{12}", placeholder: "[HOT_REDACTED]", addedAt: new Date().toISOString() }],
            sensitiveFiles: [{ name: "newservice-creds", pattern: "/home/.*/.config/newservice/credentials.json", addedAt: new Date().toISOString() }],
            destructiveCommands: [{ name: "dangerous-rm-tmp", pattern: "^(?:rm\\s+-rf\\s+/tmp/smoke)$", addedAt: new Date().toISOString() }],
            disabledBuiltInIds: [],
        });

        await rulesListCommand(undefined, { detailed: true });

        expect(tableMock).not.toHaveBeenCalled();
        expect(sectionMock).toHaveBeenCalledWith("Baseline (4)");
        expect(sectionMock).toHaveBeenCalledWith("Custom (3)");
        expect(rowMock).toHaveBeenCalledWith("", "pattern: /home/.*/.config/newservice/credentials.json");
        expect(rowMock).toHaveBeenCalledWith("", "pattern: ^(?:rm\\s+-rf\\s+/tmp/smoke)$");
    });

    it("lists baseline patterns with --detailed even when custom section is empty", async () => {
        loadCustomRulesMock.mockResolvedValueOnce({
            version: "1.0",
            secrets: [],
            sensitiveFiles: [],
            destructiveCommands: [],
            disabledBuiltInIds: [],
        });

        await rulesListCommand(undefined, { detailed: true });

        expect(tableMock).not.toHaveBeenCalled();
        expect(sectionMock).toHaveBeenCalledWith("Baseline (4)");
        expect(sectionMock).toHaveBeenCalledWith("Custom (0)");
        expect(rowMock).toHaveBeenCalledWith("BASELINE", expect.stringContaining("id: secret:openai-key"));
    });

    it("removes custom rule when target is custom", async () => {
        await rulesRemoveCommand("custom", "secret:HotTest");
        expect(saveCustomRulesMock).toHaveBeenCalled();
        expect(successMsgMock).toHaveBeenCalled();
    });

    it("fails remove when target is not custom", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);
        await expect(rulesRemoveCommand("baseline", "secret:openai-key")).rejects.toThrow("EXIT_1");
        expect(failureMsgMock).toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it("fails remove when custom target has no name", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);
        await expect(rulesRemoveCommand("custom", undefined)).rejects.toThrow("EXIT_1");
        expect(failureMsgMock).toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it("fails remove when custom id format is invalid", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);
        await expect(rulesRemoveCommand("custom", "HotTest")).rejects.toThrow("EXIT_1");
        expect(failureMsgMock).toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it("removes file custom rule by typed id", async () => {
        loadCustomRulesMock.mockResolvedValueOnce({
            version: "1.0",
            secrets: [],
            sensitiveFiles: [{ name: "smoke-file", pattern: "/tmp/smoke-file\\.txt", addedAt: new Date().toISOString() }],
            destructiveCommands: [],
            disabledBuiltInIds: [],
        });

        await rulesRemoveCommand("custom", "file:smoke-file");
        expect(saveCustomRulesMock).toHaveBeenCalled();
        expect(successMsgMock).toHaveBeenCalled();
    });

    it("fails remove with unknown typed id", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);
        await expect(rulesRemoveCommand("custom", "command:^does-not-exist$")).rejects.toThrow("EXIT_1");
        expect(failureMsgMock).toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it("removes by type:name even when pattern contains colon (windows-style)", async () => {
        loadCustomRulesMock.mockResolvedValueOnce({
            version: "1.0",
            secrets: [],
            sensitiveFiles: [{ name: "win-creds", pattern: "C:\\\\Users\\\\Alice\\\\.aws\\\\credentials", addedAt: new Date().toISOString() }],
            destructiveCommands: [],
            disabledBuiltInIds: [],
        });

        await rulesRemoveCommand("custom", "file:win-creds");
        expect(saveCustomRulesMock).toHaveBeenCalled();
        expect(successMsgMock).toHaveBeenCalled();
    });

    it("disables one baseline rule by id", async () => {
        await rulesDisableCommand("baseline", "secret:openai-key", {});
        expect(disableBuiltInRuleMock).toHaveBeenCalledWith("secret:openai-key");
        expect(successMsgMock).toHaveBeenCalled();
    });

    it("disables all baseline rules with --all", async () => {
        await rulesDisableCommand("baseline", undefined, { all: true, yes: true });
        expect(saveCustomRulesMock).toHaveBeenCalled();
        expect(successMsgMock).toHaveBeenCalled();
    });

    it("fails disable when both id and --all are provided", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);
        await expect(rulesDisableCommand("baseline", "secret:openai-key", { all: true })).rejects.toThrow("EXIT_1");
        expect(failureMsgMock).toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it("fails disable when neither id nor --all is provided", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);
        await expect(rulesDisableCommand("baseline", undefined, {})).rejects.toThrow("EXIT_1");
        expect(failureMsgMock).toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it("is idempotent when disabling an already disabled baseline rule", async () => {
        disableBuiltInRuleMock.mockResolvedValueOnce({ success: false, error: "Rule is already disabled." });
        await rulesDisableCommand("baseline", "secret:openai-key", {});
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
        await rulesEnableCommand("baseline", undefined, { all: true, yes: true });
        expect(headerMock).toHaveBeenCalledWith("No Changes Applied");
        expect(warningMsgMock).toHaveBeenCalledWith("All baseline rules are already enabled.");
    });

    it("fails enable when both id and --all are provided", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);
        await expect(rulesEnableCommand("baseline", "secret:openai-key", { all: true })).rejects.toThrow("EXIT_1");
        expect(failureMsgMock).toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it("fails enable when neither id nor --all is provided", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);
        await expect(rulesEnableCommand("baseline", undefined, {})).rejects.toThrow("EXIT_1");
        expect(failureMsgMock).toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it("fails disable when target is not baseline", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);
        await expect(rulesDisableCommand("custom", "secret:openai-key", {})).rejects.toThrow("EXIT_1");
        expect(failureMsgMock).toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it("fails enable when target is not baseline", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);
        await expect(rulesEnableCommand("custom", "secret:openai-key", {})).rejects.toThrow("EXIT_1");
        expect(failureMsgMock).toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it("fails enable with unknown baseline id", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);
        await expect(rulesEnableCommand("baseline", "secret:unknown", {})).rejects.toThrow("EXIT_1");
        expect(failureMsgMock).toHaveBeenCalledWith("Unknown baseline rule id: secret:unknown");
        exitSpy.mockRestore();
    });
});
