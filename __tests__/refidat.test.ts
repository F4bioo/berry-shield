import { describe, test, expect } from "vitest";
import { redactString } from "../src/utils/redaction";
import { SecurityPattern } from "../src/patterns";

describe("Refidat: Redaction Consistency & Dynamic Placeholders", () => {
    const mockPattern: SecurityPattern = {
        id: "berry:pii-test",
        name: "Test PII",
        category: "pii",
        pattern: /SECRET\d{3}/g,
        includeHash: true
    };

    test("should generate dynamic placeholder from ID when placeholder is missing", () => {
        const input = "Value: SECRET123";
        const result = redactString(input as string, [mockPattern]);
        // [BERRY:PII_TEST#XXXXXX]
        expect(result.content).toMatch(/\[BERRY:PII_TEST#[A-F0-9]{6}\]/);
    });

    test("should maintain consistent hash for same value in same session", () => {
        const input = "User1: SECRET123, User2: SECRET123";
        const result = redactString(input as string, [mockPattern]);
        
        const matches = (result.content as string).match(/#[A-F0-9]{6}/g);
        expect(matches).not.toBeNull();
        expect(matches![0]).toBe(matches![1]);
    });

    test("should produce different hashes for different values", () => {
        const input = "User1: SECRET123, User2: SECRET456";
        const result = redactString(input as string, [mockPattern]);
        
        const matches = (result.content as string).match(/#[A-F0-9]{6}/g);
        expect(matches).not.toBeNull();
        expect(matches![0]).not.toBe(matches![1]);
    });

    test("should respect manual placeholder if provided", () => {
        const patternWithManual: SecurityPattern = {
            ...mockPattern,
            placeholder: "[MANUAL-REDACTED]"
        };
        const input = "Value: SECRET123";
        const result = redactString(input as string, [patternWithManual]);
        
        // [MANUAL-REDACTED#XXXXXX]
        expect(result.content).toMatch(/\[MANUAL-REDACTED#[A-F0-9]{6}\]/);
    });
});
