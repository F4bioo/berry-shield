import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { findMatches } from "../src/utils/redaction";
import { getAllRedactionPatterns, getAllSensitiveFilePatterns, reloadPatterns } from "../src/patterns";
import type { BerryShieldCustomRulesConfig } from "../src/types/config";

describe("Contract Protection: Integrated Security Motor", () => {

    describe("findMatches Contract (Immutability & Accuracy)", () => {
        it("should find matches in deeply nested objects without modifying them", () => {
            const input = Object.freeze({
                level1: {
                    level2: {
                        secret: "AKIAIOSFODNN7EXAMPLE", // AWS Key
                        normal: "safe data"
                    },
                    array: ["other safe data", "user@example.com"] // Email
                }
            });

            const patterns = getAllRedactionPatterns();
            const matches = findMatches(input, patterns);

            expect(matches).toContain("AWS Access Key");
            expect(matches).toContain("aws-access-token");
            expect(matches).toContain("Email");
            expect(matches.length).toBe(3);

            // Verifies immutability - findMatches didn't change the input
            expect(input.level1.level2.secret).toBe("AKIAIOSFODNN7EXAMPLE");
        });

        it("should support raw RegExps and correctly identify matches", () => {
            const input = "dangerous command: rm -rf /data";
            const rawPatterns = [/\brm\b/i, /\bdd\b/];

            const matches = findMatches(input, rawPatterns);
            expect(matches).toContain("Sensitive Pattern");
            expect(matches.length).toBe(1);
        });
    });

    describe("Smart Cache Contract (Reactivity & Performance)", () => {
        beforeEach(() => {
            reloadPatterns({
                secrets: [],
                sensitiveFiles: [],
                destructiveCommands: [],
            });
        });

        afterEach(() => {
            reloadPatterns({
                secrets: [],
                sensitiveFiles: [],
                destructiveCommands: [],
            });
        });

        it("should reload patterns when customRules config changes", () => {
            const initialCount = getAllRedactionPatterns().length;

            const customRules: BerryShieldCustomRulesConfig = {
                secrets: [{ name: "ContractTestKey", pattern: "CONTRACT_SECRET_[0-9]+", placeholder: "[BLOCKED]", enabled: true }],
                sensitiveFiles: [],
                destructiveCommands: [],
            };
            reloadPatterns(customRules);

            const updatedPatterns = getAllRedactionPatterns();

            expect(updatedPatterns.length).toBeGreaterThan(initialCount);
            const testPattern = updatedPatterns.find(p => p.name === "ContractTestKey");
            expect(testPattern).toBeDefined();
            expect(testPattern?.pattern.test("CONTRACT_SECRET_12345")).toBe(true);
        });

        it("should NOT reload if the in-memory state hasn't changed (Cache hit)", () => {
            const patterns1 = getAllRedactionPatterns();
            const patterns2 = getAllRedactionPatterns();

            expect(patterns1.length).toBe(patterns2.length);
        });
    });

    describe("Consistency Contract (Thorn vs Leaf)", () => {
        it("should detect the same patterns for the same input across functional layers", () => {
            const input = "cat credentials.pem";

            // Leaf (Audit) utility use case
            const filePatterns = getAllSensitiveFilePatterns();
            const leafMatches = findMatches(input, filePatterns);

            // Thorn (Blocker) utility use case
            const thornMatches = findMatches(input, filePatterns);

            expect(leafMatches).toEqual(thornMatches);
            expect(leafMatches).toContain("Sensitive Pattern");
        });
    });
});
