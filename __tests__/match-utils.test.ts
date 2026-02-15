import { describe, it, expect } from 'vitest';
import { matchAgainstPattern } from '../src/cli/utils/match.js';

describe("matchAgainstPattern", () => {
    it("matches basic strings", () => {
        expect(matchAgainstPattern("vercel_abc1234567890123456789012", "vercel_[a-zA-Z0-9]{24}")).toBe(true);
    });

    it("respects (?i) prefix for case-insensitivity", () => {
        expect(matchAgainstPattern("ABC", "(?i)abc")).toBe(true);
    });

    it("is case-insensitive by default (consistent with core)", () => {
        expect(matchAgainstPattern("ABC", "abc")).toBe(true);
    });

    it("fails on non-matching strings", () => {
        expect(matchAgainstPattern("normal_text", "vercel_[a-zA-Z0-9]{24}")).toBe(false);
    });

    it("handles invalid regex gracefully", () => {
        expect(matchAgainstPattern("text", "[")).toBe(false);
    });

    it("detects and stops potential ReDoS", () => {
        // Highly catastrophic pattern: (a|aa)+$
        const evilPattern = "(a|aa)+$";
        const evilInput = "a".repeat(100) + "!";

        expect(() => matchAgainstPattern(evilInput, evilPattern, { timeoutMs: 50 }))
            .toThrow(/Potential ReDoS detected/);
    });
});
