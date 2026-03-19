
import { describe, it, expect } from "vitest";
import { redactString } from "../src/utils/redaction";
import { getAllRedactionPatterns } from "../src/patterns";

describe("Unified Redaction Engine: End-to-End Verification", () => {
    const patterns = getAllRedactionPatterns();

    describe("Secrets (Phase 4.1 Refidat Validation)", () => {
        it("should redact AWS credentials with session-salted hashes", () => {
            const result = redactString("Key: AKIA1234567890123456", patterns);
            expect(result.content).toMatch(/\[BERRY:SECRET_AWS_ACCESS_KEY#[A-F0-9]{6}\]/);
        });

        it("should redact OpenAI keys", () => {
            const result = redactString("sk-1234567890abcdef1234567890abcdef", patterns);
            expect(result.content).toMatch(/\[BERRY:SECRET_OPENAI_KEY#[A-F0-9]{6}\]/);
        });

        it("should redact High-Collision ETH Private Keys when external context is present", () => {
            const result = redactString(
                "ethereum private key: 0x1234567890123456789012345678901234567890123456789012345678901234",
                patterns
            );
            expect(result.content).toMatch(/\[BERRY:SECRET_ETH_PRIVATE_KEY#[A-F0-9]{6}\]/);
        });

        it("should redact Database URLs", () => {
            const result = redactString("postgres://user:pass@localhost:5432/db", patterns);
            expect(result.content).toMatch(/\[BERRY:SECRET_DATABASE_URL#[A-F0-9]{6}\]/);
        });
    });

    describe("PII (Context-Aware Refidat Validation)", () => {
        it("should redact CPF with context", () => {
            const result = redactString("O CPF é 123.456.789-01", patterns);
            expect(result.content).toMatch(/\[BERRY:PII_CPF_BR#[A-F0-9]{6}\]/);
        });

        it("should NOT redact CPF-like strings without context (Safe mode)", () => {
            const result = redactString("Count matches: 123456789", patterns); 
            expect(result.content).toBe("Count matches: 123456789");
        });
    });

    describe("Destructive Commands (Phase 3 Sniper Validation)", () => {
        it("should redact dangerous filesystem commands", () => {
            const result = redactString("sudo rm -rf /", patterns);
            expect(result.content).toMatch(/\[BERRY:COMMAND_FILESYSTEM_RM#[A-F0-9]{6}\]/);
        });

        it("should redact database drops with context", () => {
            const result = redactString("DROP DATABASE production;", patterns);
            expect(result.content).toMatch(/\[BERRY:COMMAND_DB_DESTRUCTIVE#[A-F0-9]{6}\]/);
        });
    });

    describe("Sensitive Files (Audit alignment)", () => {
        it("should redact .env filenames", () => {
            const result = redactString("Reading file .env.production", patterns);
            expect(result.content).toMatch(/\[BERRY:FILE_ENV#[A-F0-9]{6}\]/);
        });
    });

    describe("Performance Stability (Refidat Load Test Simulation)", () => {
        it("should process a heavy workload with consistent session hashing", () => {
            const value = "sk-1234567890abcdef1234567890abcdef";
            const chunk = `Line ${value} with some noise\n`.repeat(100);
            
            const start = Date.now();
            const result = redactString(chunk, patterns);
            const duration = Date.now() - start;

            const matches = result.content.match(/#[A-F0-9]{6}/g);
            const uniqueHashes = new Set(matches);
            
            expect(uniqueHashes.size).toBe(1);
            expect(duration).toBeLessThan(100); 
        });
    });
});
