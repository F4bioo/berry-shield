import { afterEach, describe, expect, it, vi } from "vitest";
import type { SecurityPattern } from "../src/patterns";

function extractHash(value: string): string {
    const match = value.match(/#([A-F0-9]{6})\]/);
    if (!match) {
        throw new Error(`hash_not_found:${value}`);
    }
    return match[1];
}

async function loadRedactStringWithSaltByte(fillByte: number) {
    vi.resetModules();
    vi.doMock("crypto", async () => {
        const actual = await vi.importActual<typeof import("crypto")>("crypto");
        return {
            ...actual,
            randomBytes: (size: number) => Buffer.alloc(size, fillByte),
        };
    });

    const mod = await import("../src/utils/redaction");
    return mod.redactString;
}

const TEST_PATTERN: SecurityPattern = {
    id: "test:secret:session-hash",
    name: "session-hash",
    category: "secret",
    pattern: /AKIA[0-9A-Z]{16}/g,
    includeHash: true,
};

describe("Redaction hash contract", () => {
    afterEach(() => {
        vi.doUnmock("crypto");
        vi.resetModules();
    });

    it("keeps the same hash for the same value in one session", async () => {
        const redactString = await loadRedactStringWithSaltByte(0x11);
        const input = "A=AKIA1234567890123456 B=AKIA1234567890123456";

        const first = redactString(input, [TEST_PATTERN]);
        const second = redactString(input, [TEST_PATTERN]);

        const firstHashes = first.content.match(/#([A-F0-9]{6})\]/g) ?? [];
        const secondHashes = second.content.match(/#([A-F0-9]{6})\]/g) ?? [];

        expect(firstHashes.length).toBe(2);
        expect(secondHashes.length).toBe(2);
        expect(firstHashes[0]).toBe(firstHashes[1]);
        expect(secondHashes[0]).toBe(secondHashes[1]);
        expect(firstHashes[0]).toBe(secondHashes[0]);
    });

    it("changes hash across sessions for the same value", async () => {
        const redactA = await loadRedactStringWithSaltByte(0x11);
        const outA = redactA("AKIA1234567890123456", [TEST_PATTERN]).content;
        const hashA = extractHash(outA);

        const redactB = await loadRedactStringWithSaltByte(0x22);
        const outB = redactB("AKIA1234567890123456", [TEST_PATTERN]).content;
        const hashB = extractHash(outB);

        expect(hashA).not.toBe(hashB);
    });
});
