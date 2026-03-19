import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    headerMock,
    tableMock,
    sectionMock,
    footerMock,
    failureMsgMock,
} = vi.hoisted(() => ({
    headerMock: vi.fn(),
    tableMock: vi.fn(),
    sectionMock: vi.fn(),
    footerMock: vi.fn(),
    failureMsgMock: vi.fn(),
}));

vi.mock("../src/cli/ui/tui.js", () => ({
    ui: {
        scaffold: ({ header, content, bottom }: any) => {
            const slot = {
                header: headerMock,
                table: tableMock,
                section: sectionMock,
                footer: footerMock,
                failureMsg: failureMsgMock,
                row: vi.fn(),
                successMsg: vi.fn(),
                warningMsg: vi.fn(),
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

import { statusCommand } from "../src/cli/commands/status";
import { CONFIG_PATHS } from "../src/constants";

describe("Status CLI command", () => {
    const wrapper = {
        get: vi.fn(),
    };

    const context = {
        logger: { error: vi.fn() },
    } as any;

    beforeEach(() => {
        vi.clearAllMocks();
        wrapper.get.mockImplementation(async (path: string) => {
            if (path === CONFIG_PATHS.PLUGIN_CONFIG) {
                return {};
            }
            if (path === CONFIG_PATHS.ENABLED) {
                return true;
            }
            return undefined;
        });
    });

    it("renders the default status tables", async () => {
        await statusCommand(context, wrapper as any);

        const renderedTables = tableMock.mock.calls.map(([rows]) => rows);

        expect(headerMock).toHaveBeenCalledWith("Berry Shield");
        expect(sectionMock).toHaveBeenCalledWith("Policy");
        expect(sectionMock).toHaveBeenCalledWith("Vine");
        expect(sectionMock).toHaveBeenCalledWith("Vine Confirmation");
        expect(sectionMock).toHaveBeenCalledWith("Security Layers");

        expect(renderedTables).toContainEqual(expect.arrayContaining([
            { label: "Rules", value: "Built-in (186) - Custom (0)" },
            expect.objectContaining({ label: "Status", value: expect.stringContaining("ENABLED") }),
            expect.objectContaining({ label: "Mode", value: expect.stringContaining("ENFORCE") }),
        ]));
        expect(renderedTables).toContainEqual(expect.arrayContaining([
            { label: "Confirmation Strategy", value: "1:N" },
            { label: "Code TTL (sec)", value: "180" },
            expect.objectContaining({ label: "1:1", value: expect.stringContaining("OFF") }),
            expect.objectContaining({ label: "1:N", value: expect.stringContaining("ACTIVE") }),
        ]));
        expect(footerMock).toHaveBeenCalledWith("Use 'openclaw bshield add' to create custom rules.");
    });

    it("renders a failure state when config lookup throws", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`EXIT_${code}`);
        }) as never);
        wrapper.get.mockRejectedValueOnce(new Error("boom"));

        await expect(statusCommand(context, wrapper as any)).rejects.toThrow("EXIT_1");

        expect(headerMock).toHaveBeenCalledWith("Operation Failed");
        expect(failureMsgMock).toHaveBeenCalledWith("Failed to get status: boom");
        expect(context.logger.error).toHaveBeenCalledWith("[berry-shield] CLI error: Failed to get status: boom");

        exitSpy.mockRestore();
    });
});
