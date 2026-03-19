import { describe, expect, it } from "vitest";
import { redactString } from "../src/utils/redaction";
import type { SecurityPattern } from "../src/patterns";

function makePattern(
    id: string,
    category: SecurityPattern["category"],
    regex: RegExp,
    placeholder: string
): SecurityPattern {
    return {
        id,
        name: id,
        category,
        pattern: regex,
        placeholder,
        includeHash: false,
    };
}

function makeLargeNoMatchPattern(index: number): SecurityPattern {
    const filler = "a".repeat(2_400);
    return makePattern(
        `test:secret:oversized-${index}`,
        "secret",
        new RegExp(`${filler}${index}[A-Z]{6}`, "g"),
        `[OVERSIZED_${index}]`
    );
}

describe("Redaction Engine: fallback hardening", () => {
    it("uses fallback scanning when a composite bucket exceeds source limit", () => {
        const patterns: SecurityPattern[] = [];
        for (let i = 0; i < 30; i++) {
            patterns.push(makeLargeNoMatchPattern(i));
        }

        patterns.push(
            makePattern(
                "test:secret:aws-access-key",
                "secret",
                /AKIA[0-9A-Z]{16}/g,
                "[AWS_KEY]"
            )
        );

        const input = "token=AKIA1234567890123456";
        const result = redactString(input, patterns);

        expect(result.redactionCount).toBe(1);
        expect(result.content).toBe("token=[AWS_KEY]");
        expect(result.redactedTypes).toEqual(["test:secret:aws-access-key"]);
    }, 1000);

    it("keeps output parity between compiled and fallback paths within same flag bucket", () => {
        const basePatterns: SecurityPattern[] = [
            makePattern("test:secret:api-key", "secret", /sk-[a-z0-9]{8}/gi, "[API_KEY]"),
            makePattern("test:pii:user-id", "pii", /user_[0-9]{4}/g, "[USER_ID]"),
        ];

        const fallbackPatterns = [...basePatterns];
        for (let i = 0; i < 30; i++) {
            fallbackPatterns.push(makeLargeNoMatchPattern(i));
        }

        const input = "auth sk-abc123de owner user_1234";
        const compiledResult = redactString(input, basePatterns);
        const fallbackResult = redactString(input, fallbackPatterns);

        expect(fallbackResult.content).toBe(compiledResult.content);
        expect(fallbackResult.redactionCount).toBe(compiledResult.redactionCount);
        expect(new Set(fallbackResult.redactedTypes)).toEqual(new Set(compiledResult.redactedTypes));
    }, 1000);

    it("respects path gating even when path bucket runs through fallback", () => {
        const pathPatterns: SecurityPattern[] = [
            {
                id: "test:file:path-token",
                name: "path-token",
                category: "file",
                pattern: /SENSITIVE_PATH_TOKEN/g,
                placeholder: "[PATH_TOKEN]",
            },
        ];

        for (let i = 0; i < 30; i++) {
            const filler = "b".repeat(2_400);
            pathPatterns.push({
                id: `test:file:oversized-${i}`,
                name: `oversized-${i}`,
                category: "file",
                pattern: new RegExp(`${filler}${i}[0-9]{6}`, "g"),
                placeholder: `[FILE_OVERSIZED_${i}]`,
            });
        }

        const nonPathInput = "token=SENSITIVE_PATH_TOKEN";
        const nonPathResult = redactString(nonPathInput, pathPatterns);
        expect(nonPathResult.redactionCount).toBe(0);
        expect(nonPathResult.content).toBe(nonPathInput);

        // Synthetic path string used only for regex gating checks (no filesystem writes).
        const pathInput = "C:\\\\temp\\\\report.txt token=SENSITIVE_PATH_TOKEN";
        const pathResult = redactString(pathInput, pathPatterns);
        expect(pathResult.redactionCount).toBe(1);
        expect(pathResult.content).toContain("[PATH_TOKEN]");
    }, 1000);
});
