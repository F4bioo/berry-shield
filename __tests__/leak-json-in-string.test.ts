
import { describe, it, expect } from "vitest";
import { walkAndRedact } from "../src/utils/redaction";
import { SECRET_PATTERNS } from "../src/patterns";

// Mock a simple pattern for testing
const MOCK_PATTERNS = [
    ...SECRET_PATTERNS,
    {
        id: "secret:mock-key",
        name: "Mock Key",
        category: "secret" as const,
        pattern: /MOCK-[A-Z0-9]+/g,
        placeholder: "[MOCK_REDACTED]",
    },
];

describe("Adversarial JSON-in-String Redaction", () => {

    it("should redact secrets in a simple JSON string", () => {
        // Use a non-sensitive key to test that the CONTENT regex works
        const input = JSON.stringify({ myCustomValue: "MOCK-SECRET123" });
        // Expected: "{\"myCustomValue\":\"[MOCK_REDACTED]\"}"

        // We expect the walkAndRedact to eventually handle this parsed string
        // Current implementation fails this because it treats it as a raw string
        const { content } = walkAndRedact(input, MOCK_PATTERNS);

        expect(content).toContain("[MOCK_REDACTED]");
        expect(content).not.toContain("MOCK-SECRET123");
    });

    it("should redact secrets in a nested escaped JSON string (Level 2)", () => {
        // Represents: raw: "{\"config\": \"{\\\"myCustomKey\\\": \\\"MOCK-SECRET456\\\"}\"}"
        const nestedJson = JSON.stringify({ myCustomKey: "MOCK-SECRET456" });
        const outerJson = JSON.stringify({ config: nestedJson });

        const { content } = walkAndRedact(outerJson, MOCK_PATTERNS);

        expect(content).toContain("[MOCK_REDACTED]");
        expect(content).not.toContain("MOCK-SECRET456");
    });

    it("should redact secrets inside a stringified list of objects", () => {
        // Use non-sensitive key to test content regex
        const input = JSON.stringify([{ id: 1, myField: "MOCK-TOKEN789" }]);

        const { content } = walkAndRedact(input, MOCK_PATTERNS);

        expect(content).toContain("[MOCK_REDACTED]");
        expect(content).not.toContain("MOCK-TOKEN789");
    });

    it("should NOT corrupt non-JSON strings that look like JSON", () => {
        const trickyString = "{ this is just a bracketed string }";

        const { content } = walkAndRedact(trickyString, MOCK_PATTERNS);

        expect(content).toBe(trickyString);
    });

    it("should handle mixed content safely", () => {
        const input = {
            normalField: "MOCK-VISIBLE",
            rawField: JSON.stringify({ hidden: "MOCK-HIDDEN" }),
            deeplyNested: {
                data: JSON.stringify({
                    inner: JSON.stringify({ myDeepValue: "MOCK-DEEP" })
                })
            }
        };

        const { content } = walkAndRedact(input, MOCK_PATTERNS);

        const result = content as any;
        expect(result.normalField).toContain("[MOCK_REDACTED]");

        // rawField should be a string, but redacted
        expect(typeof result.rawField).toBe("string");
        expect(result.rawField).toContain("[MOCK_REDACTED]");
        expect(result.rawField).not.toContain("MOCK-HIDDEN");

        // deeplyNested should be handled recursively
        expect(result.deeplyNested.data).toContain("[MOCK_REDACTED]");
        expect(result.deeplyNested.data).not.toContain("MOCK-DEEP");
    });

    it("should handle broken JSON gracefully without crashing", () => {
        const broken = '{"key": "MOCK-VAL"'; // Missing closing brace
        const { content } = walkAndRedact(broken, MOCK_PATTERNS);

        // Should fall back to normal string redaction
        expect(content).toContain("[MOCK_REDACTED]");
    });
});
