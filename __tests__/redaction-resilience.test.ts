import { describe, it, expect } from "vitest";
import { walkAndRedact, redactString } from "../src/utils/redaction";
import { SECRET_PATTERNS } from "../src/patterns/index";

describe("Redaction Engine - Resilience & Performance", () => {

    describe("Circular Reference Protection", () => {
        it("should handle circular references without crashing", () => {
            const circular: any = { a: "1" };
            circular.self = circular;

            const patterns = [{ name: "Test", pattern: /1/, placeholder: "[REDACTED]" }];
            const result = walkAndRedact(circular, patterns as any);

            expect(result.redactionCount).toBe(1);
            expect(result.content.a).toBe("[REDACTED]");
            // The shell of the circular ref is preserved but the loop is broken for processing
            expect(result.content.self).toBe(circular);
        });

        it("should handle deep circular references", () => {
            const a: any = { name: "A" };
            const b: any = { name: "B" };
            a.friend = b;
            b.friend = a;

            const patterns = [{ name: "Test", pattern: /A/, placeholder: "[REDACTED]" }];
            const result = walkAndRedact(a, patterns as any);

            expect(result.redactionCount).toBe(1);
            expect(result.content.name).toBe("[REDACTED]");
        });
    });

    describe("Lazy Cloning (Memory Optimization)", () => {
        it("should return the original object reference if no redaction occurs", () => {
            const original = { safe: "data", nested: { safe: true } };
            const patterns = [{ name: "Empty", pattern: /NOT_FOUND/, placeholder: "X" }];

            const result = walkAndRedact(original, patterns as any);

            // Reference equality check
            expect(result.content).toBe(original);
            expect(result.redactionCount).toBe(0);
        });

        it("should return the original array reference if no redaction occurs", () => {
            const original = ["safe", "data"];
            const patterns = [{ name: "Empty", pattern: /NOT_FOUND/, placeholder: "X" }];

            const result = walkAndRedact(original, patterns as any);

            expect(result.content).toBe(original);
        });

        it("should only clone the modified object branches", () => {
            const nestedSafe = { safe: "data" };
            const original = {
                unsafe: "secret-123",
                safe: nestedSafe
            };
            const patterns = [{ name: "Secret", pattern: /secret-123/, placeholder: "[REDACTED]" }];

            const result = walkAndRedact(original, patterns as any);

            expect(result.content).not.toBe(original); // Root must be cloned
            expect(result.content.safe).toBe(nestedSafe); // Nested safe object MUST be the same reference
            expect(result.content.unsafe).toBe("[REDACTED]");
        });
    });

    describe("Unescape Sniper (Encoded Secrets)", () => {
        it("should redact secrets inside escaped JSON strings (curl style)", () => {
            // Simulated curl output with a long enough key
            const escaped = '{\\"token\\": \\"sk-1234567890abcdef1234567890abcdef\\"}';
            const patterns = [...SECRET_PATTERNS];

            const result = redactString(escaped, patterns);

            expect(result.redactionCount).toBeGreaterThan(0);
            // It might be caught by the generic JSON pattern OR the OpenAI pattern
            expect(result.content).toMatch(/REDACTED/);
        });

        it("should redact secrets with unicode escapes", () => {
            // "sk-" in unicode: \u0073\u006b\u002d
            const encoded = "\\u0073\\u006b\\u002d1234567890abcdef12345678";
            const patterns = [...SECRET_PATTERNS];

            const result = redactString(encoded, patterns);

            expect(result.redactionCount).toBeGreaterThan(0);
            expect(result.content).toBe("[OPENAI_KEY_REDACTED]");
        });
    });

    describe("CPU Optimization (Large Payloads)", () => {
        it("should handle large payloads efficiently", () => {
            const largeArray = Array.from({ length: 1000 }, (_, i) => ({
                id: i,
                desc: `Some normal text ${i}`,
                val: i === 500 ? "sk-1234567890abcdef1234567890abcdef" : "safe"
            }));

            const start = Date.now();
            const result = walkAndRedact(largeArray, SECRET_PATTERNS);
            const duration = Date.now() - start;

            expect(result.redactionCount).toBe(1);
            expect(duration).toBeLessThan(150);
        });
    });

});
