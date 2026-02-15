import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    selectQueue,
    textQueue,
    confirmQueue,
    selectMock,
    textMock,
    confirmMock,
    isCancelMock,
    cancelMock,
    headerMock,
    rowMock,
    successMsgMock,
} = vi.hoisted(() => {
    const localSelectQueue: unknown[] = [];
    const localTextQueue: unknown[] = [];
    const localConfirmQueue: unknown[] = [];

    const localSelectMock = vi.fn(async () => {
        if (localSelectQueue.length === 0) {
            throw new Error("select queue exhausted");
        }
        return localSelectQueue.shift();
    });

    const localTextMock = vi.fn(async () => {
        if (localTextQueue.length === 0) {
            throw new Error("text queue exhausted");
        }
        return localTextQueue.shift();
    });

    const localConfirmMock = vi.fn(async () => {
        if (localConfirmQueue.length === 0) {
            throw new Error("confirm queue exhausted");
        }
        return localConfirmQueue.shift();
    });

    return {
        selectQueue: localSelectQueue,
        textQueue: localTextQueue,
        confirmQueue: localConfirmQueue,
        selectMock: localSelectMock,
        textMock: localTextMock,
        confirmMock: localConfirmMock,
        isCancelMock: vi.fn((value: unknown) => value === "__CANCEL__"),
        cancelMock: vi.fn(),
        headerMock: vi.fn(),
        rowMock: vi.fn(),
        successMsgMock: vi.fn(),
    };
});

vi.mock("@clack/prompts", () => ({
    select: selectMock,
    text: textMock,
    confirm: confirmMock,
    isCancel: isCancelMock,
    cancel: cancelMock,
}));

vi.mock("../src/cli/ui/tui.js", () => ({
    ui: {
        header: headerMock,
        row: rowMock,
        successMsg: successMsgMock,
        footer: vi.fn(),
        formatFooter: vi.fn(),
        error: vi.fn(),
    },
}));

import { RuleWizardSession } from "../src/cli/ui/wizard.js";

function queueSelect(...values: unknown[]) {
    selectQueue.push(...values);
}

function queueText(...values: unknown[]) {
    textQueue.push(...values);
}

function queueConfirm(...values: unknown[]) {
    confirmQueue.push(...values);
}

describe("RuleWizardSession", () => {
    beforeEach(() => {
        selectQueue.length = 0;
        textQueue.length = 0;
        confirmQueue.length = 0;
        vi.clearAllMocks();
    });

    it("returns null when user cancels at type selection", async () => {
        queueSelect("cancel");

        const wizard = new RuleWizardSession();
        const result = await wizard.execute();

        expect(result).toBeNull();
        expect(cancelMock).toHaveBeenCalled();
        expect(headerMock).toHaveBeenCalled();
    });

    it("returns preset-based secret rule after interactive preview and save", async () => {
        queueSelect(
            "secret",          // askType
            "Vercel Token",    // askPreset
            "0",               // askPreviewSample
            "save",            // askValidationAction
        );

        const wizard = new RuleWizardSession();
        const result = await wizard.execute();

        expect(result).not.toBeNull();
        expect(result?.type).toBe("secret");
        expect(result?.options.name).toBe("Vercel Token");
        expect(result?.options.pattern).toBe("vercel_[a-zA-Z0-9]{24}");
        expect(result?.options.placeholder).toBe("[VERCEL_TOKEN_REDACTED]");
        expect(successMsgMock).toHaveBeenCalled();
    });

    it("supports custom command flow with edit and then save", async () => {
        queueSelect(
            "command",         // askType
            "custom",          // askPreset
            "skip",            // askPreviewSample (round 1)
            "edit",            // askValidationAction (round 1)
            "0",               // askPreviewSample (round 2)
            "save",            // askValidationAction (round 2)
        );
        queueText(
            "ls",                         // askPattern (initial custom)
            "curl.*\\|\\s*(?:ba)?sh",     // askPattern (after edit)
        );
        queueConfirm(true); // broad pattern confirmation for "ls"

        const wizard = new RuleWizardSession();
        const result = await wizard.execute();

        expect(result).not.toBeNull();
        expect(result?.type).toBe("command");
        expect(result?.options.pattern).toBe("curl.*\\|\\s*(?:ba)?sh");
    });
});
