import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    readAuditEventsMock,
    clearAuditLogMock,
    headerMock,
    sectionMock,
    tableMock,
    rowMock,
    footerMock,
    warningMsgMock,
    successMsgMock,
    failureMsgMock,
} = vi.hoisted(() => ({
    readAuditEventsMock: vi.fn(),
    clearAuditLogMock: vi.fn(),
    headerMock: vi.fn(),
    sectionMock: vi.fn(),
    tableMock: vi.fn(),
    rowMock: vi.fn(),
    footerMock: vi.fn(),
    warningMsgMock: vi.fn(),
    successMsgMock: vi.fn(),
    failureMsgMock: vi.fn(),
}));

vi.mock("../src/audit/reader", () => ({
    readAuditEvents: readAuditEventsMock,
    clearAuditLog: clearAuditLogMock,
}));

vi.mock("../src/cli/ui/tui.js", () => ({
    ui: {
        header: headerMock,
        section: sectionMock,
        table: tableMock,
        row: rowMock,
        footer: footerMock,
        warningMsg: warningMsgMock,
        successMsg: successMsgMock,
        failureMsg: failureMsgMock,
        spacer: vi.fn(),
        scaffold: ({ header, content, bottom }: any) => {
            const helpers = {
                header: headerMock,
                section: sectionMock,
                table: tableMock,
                row: rowMock,
                footer: footerMock,
                warningMsg: warningMsgMock,
                successMsg: successMsgMock,
                failureMsg: failureMsgMock,
                spacer: vi.fn(),
            };
            if (header) header(helpers);
            content(helpers);
            if (bottom) bottom(helpers);
            else footerMock();
        },
    },
}));

import { reportCommand } from "../src/cli/commands/report";

describe("reportCommand", () => {
    const logger = { error: vi.fn() } as any;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows no-events state when log is empty", async () => {
        readAuditEventsMock.mockResolvedValue([]);

        await reportCommand({}, logger);

        expect(headerMock).toHaveBeenCalledWith("Global Report");
        expect(warningMsgMock).toHaveBeenCalled();
    });

    it("renders aggregated report when events exist", async () => {
        readAuditEventsMock.mockResolvedValue([
            { mode: "audit", decision: "would_block", layer: "stem", reason: "x", target: "y", ts: "2026-01-01T00:00:00.000Z" },
            { mode: "enforce", decision: "redacted", layer: "pulp", hook: "message_sending", toolName: "message", count: 1, types: ["Email"], ts: "2026-01-02T00:00:00.000Z" },
        ]);

        await reportCommand({}, logger);

        expect(tableMock).toHaveBeenCalled();
        expect(rowMock).toHaveBeenCalled();
        expect(sectionMock).toHaveBeenCalledWith("Summary");
        expect(sectionMock).toHaveBeenCalledWith("Details");
        expect(footerMock).toHaveBeenCalled();
    });

    it("clears log when --clear is used", async () => {
        clearAuditLogMock.mockResolvedValue({ cleared: 3 });

        await reportCommand({ clear: true }, logger);

        expect(clearAuditLogMock).toHaveBeenCalled();
        expect(successMsgMock).toHaveBeenCalledWith("Audit log cleared (3 event(s)).");
    });
});
