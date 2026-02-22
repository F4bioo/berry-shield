import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    headerMock,
    rowMock,
    successMsgMock,
    failureMsgMock,
    footerMock,
    confirmMock,
    cancelMock,
    loadCustomRulesMock,
    saveCustomRulesMock,
} = vi.hoisted(() => ({
    headerMock: vi.fn(),
    rowMock: vi.fn(),
    successMsgMock: vi.fn(),
    failureMsgMock: vi.fn(),
    footerMock: vi.fn(),
    confirmMock: vi.fn(),
    cancelMock: vi.fn(),
    loadCustomRulesMock: vi.fn(),
    saveCustomRulesMock: vi.fn(),
}));

vi.mock("@clack/prompts", () => ({
    confirm: confirmMock,
    isCancel: (value: unknown) => value === "__cancel__",
    cancel: cancelMock,
}));

vi.mock("../src/cli/ui/tui.js", () => ({
    ui: {
        scaffold: ({ header, content, bottom }: any) => {
            const slot = {
                header: headerMock,
                row: rowMock,
                successMsg: successMsgMock,
                failureMsg: failureMsgMock,
                footer: footerMock,
                section: vi.fn(),
                table: vi.fn(),
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
    saveCustomRules: saveCustomRulesMock,
}));

import { resetCommand } from "../src/cli/commands/reset";

describe("resetCommand", () => {
    const wrapper = { set: vi.fn(), get: vi.fn() };
    const context = { logger: { error: vi.fn() } } as any;

    beforeEach(() => {
        vi.clearAllMocks();
        loadCustomRulesMock.mockResolvedValue({
            version: "1.0",
            secrets: [{ name: "x", pattern: "x", placeholder: "[X]", addedAt: "now" }],
            sensitiveFiles: [{ pattern: "x", addedAt: "now" }],
            destructiveCommands: [{ pattern: "x", addedAt: "now" }],
            disabledBuiltInIds: ["secret:openai-key"],
        });
        saveCustomRulesMock.mockResolvedValue(undefined);
        wrapper.set.mockResolvedValue(undefined);
        wrapper.get.mockResolvedValue({
            customRules: {
                secrets: [{ name: "x", pattern: "x", placeholder: "[X]" }],
                sensitiveFiles: [{ pattern: "x" }],
                destructiveCommands: [{ pattern: "x" }],
            },
        });
    });

    it("resets builtins scope by default", async () => {
        await resetCommand("defaults", { yes: true }, context, wrapper as any);
        expect(saveCustomRulesMock).toHaveBeenCalled();
        expect(wrapper.set).not.toHaveBeenCalled();
        expect(successMsgMock).toHaveBeenCalled();
    });

    it("resets all scope and restores policy", async () => {
        await resetCommand("defaults", { scope: "all", yes: true }, context, wrapper as any);
        expect(saveCustomRulesMock).toHaveBeenCalled();
        expect(wrapper.set).toHaveBeenCalled();
    });

    it("cancels when confirmation is denied", async () => {
        confirmMock.mockResolvedValue(false);
        await resetCommand("defaults", {}, context, wrapper as any);
        expect(cancelMock).toHaveBeenCalled();
        expect(saveCustomRulesMock).not.toHaveBeenCalled();
    });
});
