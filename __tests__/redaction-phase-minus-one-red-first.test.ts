import { describe, expect, it } from "vitest";
import { redactString } from "../src/utils/redaction";
import type { SecurityPattern } from "../src/patterns";
import { getAllRedactionPatterns } from "../src/patterns";

function makePattern(id: string, source: RegExp): SecurityPattern {
    return {
        id,
        name: id,
        category: "secret",
        pattern: source,
        includeHash: true,
    };
}

describe("Redaction Engine: overlap behavior in large buckets", () => {
    it("prefers the most specific overlap even when bucket size is greater than 24", () => {
        const patterns: SecurityPattern[] = [];
        for (let i = 0; i < 24; i++) {
            patterns.push(makePattern(`test:secret:generic-${i}`, /token/g));
        }
        patterns.push(makePattern("test:secret:specific", /token-abc123/g));

        const result = redactString("value=token-abc123", patterns);

        expect(result.content).toContain("TEST:SECRET_SPECIFIC");
        expect(result.content).not.toContain("TEST:SECRET_GENERIC_0");
    }, 1000);

    it("keeps deterministic selection for same-length overlaps in buckets greater than 24", () => {
        const patterns: SecurityPattern[] = [];
        for (let i = 0; i < 24; i++) {
            patterns.push(makePattern(`test:secret:filler-${i}`, /filler/g));
        }

        patterns.push({
            id: "test:secret:first-same-length",
            name: "first-same-length",
            category: "secret",
            pattern: /token-XYZ1/g,
            placeholder: "[FIRST]",
        });
        patterns.push({
            id: "test:secret:second-same-length",
            name: "second-same-length",
            category: "secret",
            pattern: /token-XYZ1/g,
            placeholder: "[SECOND]",
        });

        const result = redactString("value=token-XYZ1", patterns);
        expect(result.content).toContain("[FIRST]");
        expect(result.content).not.toContain("[SECOND]");
    }, 1000);

    it("resolves same-start overlaps by category when probing is enabled", () => {
        const patterns: SecurityPattern[] = [
            {
                id: "test:pii:longer",
                name: "pii-longer",
                category: "pii",
                pattern: /key-1234-pii-5678/g,
                placeholder: "[PII_LONG]",
            },
            {
                id: "test:secret:shorter",
                name: "secret-shorter",
                category: "secret",
                pattern: /key-1234/g,
                placeholder: "[SECRET_SHORT]",
            },
        ];

        const result = redactString("value=key-1234-pii-5678", patterns);
        expect(result.content).toContain("[SECRET_SHORT]-pii-5678");
    }, 1000);

    it("keeps deterministic winner in adversarial three-way overlap ordering", () => {
        const patterns: SecurityPattern[] = [
            {
                id: "test:secret:a",
                name: "A",
                category: "secret",
                pattern: /abc123xyz/g,
                placeholder: "[A]",
            },
            {
                id: "test:secret:b",
                name: "B",
                category: "secret",
                pattern: /abc123/g,
                placeholder: "[B]",
            },
            {
                id: "test:secret:c",
                name: "C",
                category: "secret",
                pattern: /abc123xy/g,
                placeholder: "[C]",
            },
        ];

        const result = redactString("token=abc123xyz", patterns);
        expect(result.content).toContain("[A]");
        expect(result.content).not.toContain("[B]");
        expect(result.content).not.toContain("[C]");
    }, 1000);

    it("keeps deterministic longer-first behavior in large buckets without probing", () => {
        const patterns: SecurityPattern[] = [];
        for (let i = 0; i < 22; i++) {
            patterns.push(makePattern(`test:secret:filler-cat-${i}`, /zzzz/g));
        }

        patterns.push({
            id: "test:pii:long",
            name: "pii-long",
            category: "pii",
            pattern: /abc123xyz/g,
            placeholder: "[PII_LONG]",
        });
        patterns.push({
            id: "test:secret:mid",
            name: "secret-mid",
            category: "secret",
            pattern: /abc123xy/g,
            placeholder: "[SECRET_MID]",
        });
        patterns.push({
            id: "test:command:short",
            name: "command-short",
            category: "command",
            pattern: /abc123/g,
            placeholder: "[COMMAND_SHORT]",
        });

        const result = redactString("value=abc123xyz", patterns);
        expect(result.content).toContain("[PII_LONG]");
        expect(result.content).not.toContain("[COMMAND_SHORT]");
        expect(result.content).not.toContain("[SECRET_MID]");
    }, 1000);
});

describe("Redaction Engine: context-required patterns", () => {
    it("requires external context and must not self-validate from match payload", () => {
        const patterns = getAllRedactionPatterns();
        const text = "0x1234567890123456789012345678901234567890123456789012345678901234";

        const result = redactString(text, patterns);

        expect(result.content).toBe(text);
        expect(result.redactionCount).toBe(0);
    }, 1000);

    it("redacts wallet key references with common synonym context (metamask)", () => {
        const patterns = getAllRedactionPatterns();
        const text = "my metamask key: 1234567890123456789012345678901234567890123456789012345678901234";

        const result = redactString(text, patterns);

        expect(result.redactionCount).toBe(1);
        expect(result.content).toMatch(/\[BERRY:SECRET_ETH_PRIVATE_KEY#[A-F0-9]{6}\]/);
    }, 1000);

    it("handles broad custom patterns on large payloads without runtime instability", () => {
        const broadCustom: SecurityPattern = {
            id: "custom:secret:broad-alpha",
            name: "broad-alpha",
            category: "secret",
            pattern: /[a-z]{20}/g,
            placeholder: "[CUSTOM_BROAD]",
        };

        const payload = "loremipsumdolorsitamet ".repeat(15_000);
        const result = redactString(payload, [broadCustom]);

        expect(result.redactionCount).toBeGreaterThan(0);
        expect(result.content).toContain("[CUSTOM_BROAD]");
    }, 1000);
});

describe("Redaction Engine: fallback and resilience", () => {
    it("keeps redaction functional when composite compilation is not viable", () => {
        const longPrefix = "a".repeat(2_500);
        const heavyPatterns: SecurityPattern[] = [];

        for (let i = 0; i < 26; i++) {
            heavyPatterns.push(
                makePattern(
                    `test:secret:heavy-${i}`,
                    new RegExp(`${longPrefix}${i}[a-z]{10}`, "g")
                )
            );
        }
        heavyPatterns.push(makePattern("test:secret:target", /AKIA[0-9A-Z]{16}/g));

        const result = redactString("key=AKIA1234567890123456", heavyPatterns);
        expect(result.redactionCount).toBe(1);
        expect(result.content).toContain("TEST:SECRET_TARGET");
    }, 1000);

    it("rejects pathological regex patterns instead of accepting them silently", () => {
        const pathological = makePattern("test:secret:pathological", /(a+)+b/g);

        expect(() => redactString("aaaa", [pathological])).toThrow();
    }, 1000);
});

describe("Redaction Engine: path-aware gating behavior", () => {
    const fileBucketPattern: SecurityPattern = {
        id: "test:file:gating-probe",
        name: "gating-probe",
        category: "file",
        pattern: /SENSITIVE_FILE_TOKEN/g,
        placeholder: "[FILE_PROBE]",
    };

    it("skips path buckets for non-path-heavy payloads", () => {
        const text = "metric=123.456.789 token=SENSITIVE_FILE_TOKEN";
        const result = redactString(text, [fileBucketPattern]);

        expect(result.redactionCount).toBe(0);
        expect(result.content).toBe(text);
    }, 1000);

    it("activates path buckets when path indicators are present", () => {
        const text = "report.txt token=SENSITIVE_FILE_TOKEN";
        const result = redactString(text, [fileBucketPattern]);

        expect(result.redactionCount).toBe(1);
        expect(result.content).toContain("[FILE_PROBE]");
    }, 1000);
});

describe("Redaction Engine: repeated-call consistency", () => {
    it("keeps identical results across repeated calls with the same pattern array", () => {
        const patterns = getAllRedactionPatterns();
        const input = "token=sk-1234567890abcdef1234567890abcdef path=/home/user/.env";

        const first = redactString(input, patterns);
        const second = redactString(input, patterns);

        expect(second.content).toBe(first.content);
        expect(second.redactionCount).toBe(first.redactionCount);
        expect(second.redactedTypes).toEqual(first.redactedTypes);
    }, 1000);
});
