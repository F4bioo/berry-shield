import { describe, expect, it, beforeEach } from "vitest";
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

    describe("AWS Secret Key", () => {
        const pattern = SECRET_PATTERNS.find((p) => p.name === "AWS Secret Key")!;

        it("detects AWS secret key assignment", () => {
            expect(pattern.pattern.test("aws_secret_access_key=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY")).toBe(true);
        });

        it("detects with colon separator", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test("aws_secret_access_key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY")).toBe(true);
        });
    });

    describe("Stripe Key", () => {
        const pattern = SECRET_PATTERNS.find((p) => p.name === "Stripe Key")!;

        it("detects live secret key", () => {
            expect(pattern.pattern.test("sk_live_1234567890abcdefghij")).toBe(true);
        });

        it("detects test secret key", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test("sk_test_abcdefghij1234567890")).toBe(true);
        });

        it("detects restricted key", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test("rk_live_abcdefghij1234567890")).toBe(true);
        });
    });

    describe("GitHub PAT", () => {
        const pattern = SECRET_PATTERNS.find((p) => p.name === "GitHub PAT")!;

        it("detects GitHub PAT", () => {
            expect(pattern.pattern.test("github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz")).toBe(true);
        });
    });

    describe("Anthropic Key", () => {
        const pattern = SECRET_PATTERNS.find((p) => p.name === "Anthropic Key")!;

        it("detects Anthropic API key", () => {
            expect(pattern.pattern.test("sk-ant-api03-abcdefghij1234567890")).toBe(true);
        });
    });

    describe("Slack Token", () => {
        const pattern = SECRET_PATTERNS.find((p) => p.name === "Slack Token")!;

        it("detects bot token", () => {
            expect(pattern.pattern.test("xoxb-123456789012-1234567890123-abcdefgh")).toBe(true);
        });

        it("detects user token", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test("xoxp-123456789012-1234567890123-abcdefgh")).toBe(true);
        });
    });

    describe("SendGrid Key", () => {
        const pattern = SECRET_PATTERNS.find((p) => p.name === "SendGrid Key")!;

        it("detects SendGrid API key", () => {
            expect(pattern.pattern.test("SG.abcdefghijklmnopqrstuv.wxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abc")).toBe(true);
        });
    });

    describe("NPM Token", () => {
        const pattern = SECRET_PATTERNS.find((p) => p.name === "NPM Token")!;

        it("detects npm token", () => {
            expect(pattern.pattern.test("npm_abcdefghijklmnopqrstuvwxyz1234567890")).toBe(true);
        });
    });

    describe("Bearer Token", () => {
        const pattern = SECRET_PATTERNS.find((p) => p.name === "Bearer Token")!;

        it("detects Authorization header with Bearer", () => {
            expect(pattern.pattern.test("Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9")).toBe(true);
        });

        it("detects with equals sign", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test("Authorization=Bearer abcdefghij1234567890abcd")).toBe(true);
        });
    });

    describe("Generic API Key", () => {
        const pattern = SECRET_PATTERNS.find((p) => p.name === "Generic API Key")!;

        it("detects api_key assignment", () => {
            expect(pattern.pattern.test("api_key=abcdefghij1234567890abcd")).toBe(true);
        });

        it("detects apiKey with colon", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test("apiKey: abcdefghij1234567890abcd")).toBe(true);
        });
    });

    describe("Telegram Bot Token", () => {
        const pattern = SECRET_PATTERNS.find((p) => p.name === "Telegram Bot Token")!;

        it("detects Telegram bot token", () => {
            expect(pattern.pattern.test("123456789:ABCdefGHIjklMNOpqrSTUvwxYZ1234567890")).toBe(true);
        });

        it("detects with 10-digit bot ID", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test("1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ1234567890ab")).toBe(true);
        });
    });

    describe("Generic JSON Secret", () => {
        const pattern = SECRET_PATTERNS.find((p) => p.name === "Generic JSON Secret")!;

        it("detects apiKey in JSON", () => {
            expect(pattern.pattern.test('"apiKey": "abc123def456ghi789"')).toBe(true);
        });

        it("detects token in JSON", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test('"token": "secret-value-here"')).toBe(true);
        });

        it("detects password in JSON", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test('"password": "mysecretpassword"')).toBe(true);
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

    describe("SSN (USA)", () => {
        const pattern = PII_PATTERNS.find((p) => p.name === "SSN (USA)")!;

        it("detects valid SSN", () => {
            expect(pattern.pattern.test("123-45-6789")).toBe(true);
        });

        it("does not detect invalid SSN starting with 000", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test("000-12-3456")).toBe(false);
        });

        it("does not detect invalid SSN starting with 666", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test("666-12-3456")).toBe(false);
        });
    });

    describe("US Phone", () => {
        const pattern = PII_PATTERNS.find((p) => p.name === "US Phone")!;

        it("detects US phone with dashes", () => {
            // Pattern requires area code starting with 2-9, exchange starting with 2-9
            expect(pattern.pattern.test("212-555-1234")).toBe(true);
        });

        it("detects US phone with country code", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test("+1 212 555 1234")).toBe(true);
        });

        it("detects US phone with parentheses", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test("(212) 555-1234")).toBe(true);
        });
    });

    describe("International Phone", () => {
        const pattern = PII_PATTERNS.find((p) => p.name === "International Phone")!;

        beforeEach(() => {
            pattern.pattern.lastIndex = 0;
        });

        it("detects international phone when attached to text", () => {
            expect(pattern.pattern.test("Tel+551199998888")).toBe(true);
        });

        it("detects phone in JSON format (quoted)", () => {
            // New regex handles non-word chars like quotes
            expect(pattern.pattern.test('"phone": "+551199998888"')).toBe(true);
        });
    });

    describe("IBAN", () => {
        const pattern = PII_PATTERNS.find((p) => p.name === "IBAN")!;

        it("detects German IBAN", () => {
            expect(pattern.pattern.test("DE89370400440532013000")).toBe(true);
        });

        it("detects UK IBAN", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test("GB82WEST12345698765432")).toBe(true);
        });
    });

    describe("CNPJ (Brazil)", () => {
        const pattern = PII_PATTERNS.find((p) => p.name === "CNPJ (Brazil)")!;

        it("detects CNPJ with formatting", () => {
            expect(pattern.pattern.test("11.222.333/0001-81")).toBe(true);
        });

        it("detects CNPJ without formatting", () => {
            pattern.pattern.lastIndex = 0;
            expect(pattern.pattern.test("11222333000181")).toBe(true);
        });
    });
});

