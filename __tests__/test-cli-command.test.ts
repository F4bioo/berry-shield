import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    headerMock,
    failureMsgMock,
    warningMsgMock,
    successMsgMock,
    rowMock,
    loadCustomRulesMock,
    matchAgainstPatternMock,
} = vi.hoisted(() => ({
    headerMock: vi.fn(),
    failureMsgMock: vi.fn(),
    warningMsgMock: vi.fn(),
    successMsgMock: vi.fn(),
    rowMock: vi.fn(),
    loadCustomRulesMock: vi.fn(),
    matchAgainstPatternMock: vi.fn(),
}));

vi.mock("../src/cli/ui/tui.js", () => ({
    ui: {
        scaffold: ({ header, content }: any) => {
            const slot = {
                header: headerMock,
                successMsg: successMsgMock,
                warningMsg: warningMsgMock,
                failureMsg: failureMsgMock,
                row: rowMock,
                divider: vi.fn(),
            };
            if (header) header(slot);
            content(slot);
        },
    },
}));

vi.mock("../src/cli/custom-rules-config.js", () => ({
    loadCustomRulesFromConfig: loadCustomRulesMock,
}));

vi.mock("../src/cli/utils/match.js", () => ({
    matchAgainstPattern: matchAgainstPatternMock,
}));

vi.mock("../src/patterns/index.js", () => ({
    SECRET_PATTERNS: [
        { name: "OpenAI Key", pattern: /sk-.+/, placeholder: "[OPENAI_KEY_REDACTED]" },
        { name: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/, placeholder: undefined },
    ],
    PII_PATTERNS: [{ name: "Email", pattern: /@/, placeholder: "[EMAIL_REDACTED]" }],
}));

import { testCommand } from "../src/cli/commands/test.js";

describe("test command", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        loadCustomRulesMock.mockResolvedValue({
            secrets: [],
            sensitiveFiles: [],
            destructiveCommands: [],
            disabledBuiltInIds: [],
            version: "1.0",
        });
    });

    it("shows explicit guidance when no matches are found", async () => {
        matchAgainstPatternMock.mockReturnValue(false);

        const logger = { debug: vi.fn() } as any;
        await testCommand("SMOKE_WEB_CMD", {} as any, logger, {} as any);

        expect(headerMock).toHaveBeenCalledWith("Pattern Test");
        expect(failureMsgMock).toHaveBeenCalledWith("No matches found");
        expect(warningMsgMock).toHaveBeenCalledWith("Scope: baseline secret/pii + custom secret (enabled rules only).");
        expect(rowMock).toHaveBeenCalledWith("Inspect", expect.stringContaining("openclaw bshield rules list --detailed"));
    });

    it("shows rule-id specific guidance for command/file typed input", async () => {
        matchAgainstPatternMock.mockReturnValue(false);

        const logger = { debug: vi.fn() } as any;
        await testCommand("command:smoke-web-cmd", {} as any, logger, {} as any);

        expect(warningMsgMock).toHaveBeenCalledWith("Input looks like a custom rule ID, not a payload value.");
    });

    it("renders dynamic placeholder label when a built-in pattern has no static placeholder", async () => {
        matchAgainstPatternMock.mockImplementation((input: string, pattern: string) => {
            return input.includes("AKIA") && pattern.includes("AKIA");
        });

        const logger = { debug: vi.fn() } as any;
        await testCommand("AKIA1234567890123456", {} as any, logger, {} as any);

        expect(successMsgMock).toHaveBeenCalledWith("1 match(es) found");
        expect(rowMock).toHaveBeenCalledWith("Redaction", expect.stringContaining("(dynamic placeholder)"));
    });
});
