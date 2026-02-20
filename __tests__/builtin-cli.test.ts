import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    headerMock,
    tableMock,
    successMsgMock,
    failureMsgMock,
    footerMock,
    loadCustomRulesMock,
    disableBuiltInRuleMock,
} = vi.hoisted(() => ({
    headerMock: vi.fn(),
    tableMock: vi.fn(),
    successMsgMock: vi.fn(),
    failureMsgMock: vi.fn(),
    footerMock: vi.fn(),
    loadCustomRulesMock: vi.fn(),
    disableBuiltInRuleMock: vi.fn(),
}));

vi.mock("../src/cli/ui/tui.js", () => ({
    ui: {
        scaffold: ({ header, content, bottom }: any) => {
            const slot = {
                header: headerMock,
                table: tableMock,
                successMsg: successMsgMock,
                failureMsg: failureMsgMock,
                footer: footerMock,
                row: vi.fn(),
                section: vi.fn(),
                spacer: vi.fn(),
                divider: vi.fn(),
                warningMsg: vi.fn(),
            };
            if (header) header(slot);
            content(slot);
            if (bottom) bottom(slot);
            else footerMock();
        },
    },
}));

vi.mock("../src/cli/storage", () => ({
    loadCustomRules: loadCustomRulesMock,
    disableBuiltInRule: disableBuiltInRuleMock,
}));

vi.mock("../src/patterns/index.js", () => ({
    SECRET_PATTERNS: [{ id: "secret:openai-key", name: "OpenAI Key", pattern: /x/, category: "secret", placeholder: "x" }],
    PII_PATTERNS: [{ id: "pii:email", name: "Email", pattern: /x/, category: "pii", placeholder: "x" }],
    INTERNAL_SENSITIVE_FILE_PATTERNS: [{ id: "file:env", pattern: /\.env/i }],
    INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS: [{ id: "command:rm-family", pattern: /\brm\b/i }],
}));

import { builtinListCommand, builtinRemoveCommand } from "../src/cli/commands/builtin";

describe("builtinCommand", () => {
    const logger = { info: vi.fn() } as any;

    beforeEach(() => {
        vi.clearAllMocks();
        loadCustomRulesMock.mockResolvedValue({ disabledBuiltInIds: [] });
        disableBuiltInRuleMock.mockResolvedValue({ success: true });
    });

    it("lists built-in rules", async () => {
        await builtinListCommand({}, logger);
        expect(headerMock).toHaveBeenCalledWith("Built-in Rules");
        expect(tableMock).toHaveBeenCalled();
    });

    it("removes built-in by id", async () => {
        await builtinRemoveCommand("secret:openai-key", {}, logger);
        expect(disableBuiltInRuleMock).toHaveBeenCalledWith("secret:openai-key");
        expect(successMsgMock).toHaveBeenCalled();
    });

    it("fails when built-in id is unknown", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);

        await expect(builtinRemoveCommand("secret:unknown", {}, logger)).rejects.toThrow("EXIT_1");
        expect(failureMsgMock).toHaveBeenCalled();
        exitSpy.mockRestore();
    });
});
