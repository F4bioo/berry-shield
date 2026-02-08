import { describe, expect, it } from "vitest";
import { SECRET_PATTERNS, PII_PATTERNS } from "../src/patterns";

describe("SECRET_PATTERNS", () => {
    describe("AWS Access Key", () => {
        const pattern = SECRET_PATTERNS.find((p) => p.name === "AWS Access Key")!;

        it("detects valid AWS Access Key", () => {
            expect(pattern.pattern.test("AKIAIOSFODNN7EXAMPLE")).toBe(true);
        });

        it("does not detect invalid key", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test("NOTAKEY12345")).toBe(false);
        });
    });

    describe("OpenAI Key", () => {
        const pattern = SECRET_PATTERNS.find((p) => p.name === "OpenAI Key")!;

        it("detects valid OpenAI key", () => {
            expect(pattern.pattern.test("sk-abc123def456ghi789jkl012")).toBe(true);
        });

        it("does not detect short strings", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test("sk-short")).toBe(false);
        });
    });

    describe("GitHub Token", () => {
        const pattern = SECRET_PATTERNS.find((p) => p.name === "GitHub Token")!;

        it("detects ghp_ token", () => {
            expect(pattern.pattern.test("ghp_abcdefghijklmnopqrstuvwxyz1234567890")).toBe(true);
        });

        it("detects gho_ token", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test("gho_abcdefghijklmnopqrstuvwxyz1234567890")).toBe(true);
        });
    });

    describe("JWT", () => {
        const pattern = SECRET_PATTERNS.find((p) => p.name === "JWT")!;

        it("detects valid JWT structure", () => {
            const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
            expect(pattern.pattern.test(jwt)).toBe(true);
        });

        it("does not detect random text", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test("not.a.jwt")).toBe(false);
        });
    });

    describe("Private Key", () => {
        const pattern = SECRET_PATTERNS.find((p) => p.name === "Private Key")!;

        it("detects RSA private key header", () => {
            expect(pattern.pattern.test("-----BEGIN RSA PRIVATE KEY-----")).toBe(true);
        });

        it("detects generic private key header", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test("-----BEGIN PRIVATE KEY-----")).toBe(true);
        });
    });
});

describe("PII_PATTERNS", () => {
    describe("Email", () => {
        const pattern = PII_PATTERNS.find((p) => p.name === "Email")!;

        it("detects valid email", () => {
            expect(pattern.pattern.test("user@example.com")).toBe(true);
        });

        it("detects email with subdomain", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test("user@mail.example.com")).toBe(true);
        });
    });

    describe("CPF (Brazil)", () => {
        const pattern = PII_PATTERNS.find((p) => p.name === "CPF (Brazil)")!;

        it("detects CPF with dots and dash", () => {
            expect(pattern.pattern.test("123.456.789-00")).toBe(true);
        });

        it("detects CPF without formatting", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test("12345678900")).toBe(true);
        });
    });

    describe("Credit Card", () => {
        const pattern = PII_PATTERNS.find((p) => p.name === "Credit Card")!;

        it("detects Visa card", () => {
            expect(pattern.pattern.test("4111111111111111")).toBe(true);
        });

        it("detects card with spaces", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test("4111 1111 1111 1111")).toBe(true);
        });

        it("detects card with dashes", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test("4111-1111-1111-1111")).toBe(true);
        });
    });
});
