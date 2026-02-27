import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    headerMock,
    rowMock,
    successMsgMock,
    failureMsgMock,
    warningMsgMock,
    footerMock,
} = vi.hoisted(() => ({
    headerMock: vi.fn(),
    rowMock: vi.fn(),
    successMsgMock: vi.fn(),
    failureMsgMock: vi.fn(),
    warningMsgMock: vi.fn(),
    footerMock: vi.fn(),
}));

vi.mock("../src/cli/ui/tui.js", () => ({
    ui: {
        scaffold: ({ header, content, bottom }: any) => {
            const slot = {
                header: headerMock,
                row: rowMock,
                successMsg: successMsgMock,
                failureMsg: failureMsgMock,
                warningMsg: warningMsgMock,
                footer: footerMock,
                section: vi.fn(),
                table: vi.fn(),
                spacer: vi.fn(),
                divider: vi.fn(),
            };
            if (header) header(slot);
            content(slot);
            if (bottom) bottom(slot);
            else footerMock();
        },
    },
}));

import { vineCommand } from "../src/cli/commands/vine";

describe("Vine CLI command", () => {
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

    it("prints status by default", async () => {
        await vineCommand(undefined, undefined, undefined, context, wrapper as any);
        expect(rowMock).toHaveBeenCalledWith("mode", "BALANCED");
        expect(rowMock).toHaveBeenCalledWith("toolAllowlist.count", "0");
    });

    it("sets vine mode", async () => {
        await vineCommand("set", "mode", "strict", context, wrapper as any);
        expect(wrapper.set).toHaveBeenCalledWith(
            "plugins.entries.berry-shield.config.vine.mode",
            "strict"
        );
        expect(successMsgMock).toHaveBeenCalled();
    });

    it("allow adds tool once", async () => {
        await vineCommand("allow", "web_fetch", undefined, context, wrapper as any);
        expect(wrapper.set).toHaveBeenCalledWith(
            "plugins.entries.berry-shield.config.vine.toolAllowlist",
            ["web_fetch"]
        );
    });

    it("deny removes allowlisted tool", async () => {
        wrapper.get.mockResolvedValueOnce({
            vine: {
                mode: "balanced",
                retention: { maxEntries: 10000, ttlSeconds: 86400 },
                thresholds: { externalSignalsToEscalate: 1, forcedGuardTurns: 3 },
                toolAllowlist: ["web_fetch", "crawler"],
            },
        });

        await vineCommand("deny", "web_fetch", undefined, context, wrapper as any);
        expect(wrapper.set).toHaveBeenCalledWith(
            "plugins.entries.berry-shield.config.vine.toolAllowlist",
            ["crawler"]
        );
    });

    it("fails for invalid set path", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);
        await expect(vineCommand("set", "unknown.path", "1", context, wrapper as any)).rejects.toThrow("EXIT_1");
        expect(failureMsgMock).toHaveBeenCalled();
        exitSpy.mockRestore();
    });
});
