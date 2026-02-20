import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    headerMock,
    rowMock,
    successMsgMock,
    failureMsgMock,
    footerMock,
    cancelMock,
    selectMock,
    textMock,
    confirmMock,
} = vi.hoisted(() => ({
    headerMock: vi.fn(),
    rowMock: vi.fn(),
    successMsgMock: vi.fn(),
    failureMsgMock: vi.fn(),
    footerMock: vi.fn(),
    cancelMock: vi.fn(),
    selectMock: vi.fn(),
    textMock: vi.fn(),
    confirmMock: vi.fn(),
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

vi.mock("@clack/prompts", () => ({
    select: selectMock,
    text: textMock,
    confirm: confirmMock,
    isCancel: (value: unknown) => value === "__cancel__",
    cancel: cancelMock,
}));

import { profileCommand } from "../src/cli/commands/profile";
import { policyCommand } from "../src/cli/commands/policy";

describe("Policy/Profile CLI commands", () => {
    const wrapper = {
        get: vi.fn(),
        set: vi.fn(),
    };
    const context = {
        logger: { error: vi.fn() },
    } as any;

    beforeEach(() => {
        vi.clearAllMocks();
        wrapper.get.mockResolvedValue({});
        wrapper.set.mockResolvedValue(undefined);
    });

    it("profile command sets a valid profile", async () => {
        await profileCommand("minimal", context, wrapper as any);
        expect(wrapper.set).toHaveBeenCalledWith(
            "plugins.entries.berry-shield.config.policy.profile",
            "minimal"
        );
        expect(successMsgMock).toHaveBeenCalled();
    });

    it("profile command rejects invalid profile", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);

        await expect(profileCommand("invalid", context, wrapper as any)).rejects.toThrow("EXIT_1");
        expect(wrapper.set).not.toHaveBeenCalled();
        expect(failureMsgMock).toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it("policy set parses and writes numeric value", async () => {
        await policyCommand("set", "adaptive.escalationTurns", "5", context, wrapper as any);
        expect(wrapper.set).toHaveBeenCalledWith(
            "plugins.entries.berry-shield.config.policy.adaptive.escalationTurns",
            5
        );
    });

    it("policy set rejects unknown path", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);

        await expect(policyCommand("set", "adaptive.unknown", "1", context, wrapper as any)).rejects.toThrow("EXIT_1");
        expect(wrapper.set).not.toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it("policy get without path prints effective snapshot", async () => {
        wrapper.get.mockResolvedValue({});
        await policyCommand("get", undefined, undefined, context, wrapper as any);
        expect(rowMock).toHaveBeenCalledWith("profile", "balanced");
        expect(rowMock).toHaveBeenCalledWith("adaptive.escalationTurns", "3");
    });

    it("policy wizard cancels without writes", async () => {
        selectMock.mockResolvedValue("cancel");

        await policyCommand(undefined, undefined, undefined, context, wrapper as any);
        expect(wrapper.set).not.toHaveBeenCalled();
        expect(cancelMock).toHaveBeenCalled();
    });

    it("policy wizard writes all fields on confirmation", async () => {
        selectMock.mockResolvedValue("strict");
        textMock
            .mockResolvedValueOnce("10")   // staleAfterMinutes
            .mockResolvedValueOnce("2")    // escalationTurns
            .mockResolvedValueOnce("0")    // heartbeatEveryTurns
            .mockResolvedValueOnce("50")   // maxEntries
            .mockResolvedValueOnce("120"); // ttlSeconds
        confirmMock
            .mockResolvedValueOnce(true)   // allowGlobalEscalation
            .mockResolvedValueOnce(true);  // save confirmation

        await policyCommand(undefined, undefined, undefined, context, wrapper as any);

        expect(wrapper.set).toHaveBeenCalledTimes(7);
        expect(wrapper.set).toHaveBeenCalledWith(
            "plugins.entries.berry-shield.config.policy.profile",
            "strict"
        );
        expect(wrapper.set).toHaveBeenCalledWith(
            "plugins.entries.berry-shield.config.policy.adaptive.allowGlobalEscalation",
            true
        );
        expect(wrapper.set).toHaveBeenCalledWith(
            "plugins.entries.berry-shield.config.policy.retention.ttlSeconds",
            120
        );
    });
});

