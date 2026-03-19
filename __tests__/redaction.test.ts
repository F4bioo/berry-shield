import { describe, expect, it } from "vitest";
import { redactString, walkAndRedact, redactSensitiveData } from "../src/utils/redaction";
import { SECRET_PATTERNS, PII_PATTERNS, getAllRedactionPatterns } from "../src/patterns";

describe("redactString", () => {
    it("redacts AWS key from text", () => {
        const text = "My key is AKIAIOSFODNN7EXAMPLE";
        const result = redactString(text, SECRET_PATTERNS);

        expect(result.content).toMatch(/\[BERRY:SECRET_AWS_ACCESS_KEY#[A-F0-9]{6}\]/);
        expect(result.redactionCount).toBe(1);
        expect(result.redactedTypes).toContain("berry:secret:aws-access-key");
    });

    it("redacts multiple secrets", () => {
        const text = "AWS: AKIAIOSFODNN7EXAMPLE, OpenAI: sk-abc123def456ghi789jkl012";
        const result = redactString(text, SECRET_PATTERNS);

        expect(result.redactionCount).toBe(2);
        expect(result.redactedTypes).toContain("berry:secret:aws-access-key");
        expect(result.redactedTypes).toContain("berry:secret:openai-key");
    });

    it("redacts email from text", () => {
        const text = "Contact me at user@example.com";
        const result = redactString(text, PII_PATTERNS);

        expect(result.content).toMatch(/\[BERRY:PII_EMAIL#[A-F0-9]{6}\]/);
        expect(result.redactionCount).toBe(1);
    });

    it("returns unchanged text if no matches", () => {
        const text = "Hello, this is normal text";
        const result = redactString(text, SECRET_PATTERNS);

        expect(result.content).toBe(text);
        expect(result.redactionCount).toBe(0);
        expect(result.redactedTypes).toHaveLength(0);
    });
});

describe("walkAndRedact", () => {
    const patterns = getAllRedactionPatterns();

    it("redacts strings", () => {
        const result = walkAndRedact("Key: AKIAIOSFODNN7EXAMPLE", patterns);
        expect(result.content).toMatch(/Key: \[BERRY:SECRET_AWS_ACCESS_KEY#[A-F0-9]{6}\]/);
    });

    it("redacts arrays", () => {
        const input = ["user@example.com", "normal text"];
        const result = walkAndRedact(input, patterns);

        expect((result.content as string[])[0]).toMatch(/\[BERRY:PII_EMAIL#[A-F0-9]{6}\]/);
        expect(result.redactionCount).toBe(1);
    });

    it("redacts nested objects", () => {
        const input = {
            user: {
                email: "user@example.com",
                name: "John",
            },
            awsField: "AKIAIOSFODNN7EXAMPLE",
        };
        const result = walkAndRedact(input, patterns);

        expect((result.content as any).user.email).toMatch(/\[BERRY:PII_EMAIL#[A-F0-9]{6}\]/);
        expect((result.content as any).awsField).toMatch(/\[BERRY:SECRET_AWS_ACCESS_KEY#[A-F0-9]{6}\]/);
        expect(result.redactionCount).toBe(2);
    });

    it("handles primitives unchanged", () => {
        expect(walkAndRedact(42, patterns).content).toBe(42);
        expect(walkAndRedact(true, patterns).content).toBe(true);
        expect(walkAndRedact(null, patterns).content).toBe(null);
    });
});

describe("redactSensitiveData", () => {
    it("redacts all types of sensitive data", () => {
        const input = {
            config: {
                awsAccess: "AKIAIOSFODNN7EXAMPLE",
                email: "admin@company.com",
            },
        };
        const result = redactSensitiveData(input);

        expect((result.content as any).config.awsAccess).toMatch(/\[BERRY:SECRET_AWS_ACCESS_KEY#[A-F0-9]{6}\]/);
        expect((result.content as any).config.email).toMatch(/\[BERRY:PII_EMAIL#[A-F0-9]{6}\]/);
        expect(result.redactionCount).toBe(2);
        expect(result.redactedTypes).toContain("berry:secret:aws-access-key");
        expect(result.redactedTypes).toContain("berry:pii:email");
    });
});
