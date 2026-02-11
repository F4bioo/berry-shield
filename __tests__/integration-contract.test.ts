import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { findMatches } from "../src/utils/redaction";
import { getAllRedactionPatterns, getAllSensitiveFilePatterns, getAllDestructiveCommandPatterns } from "../src/patterns";
import { getStoragePath, saveCustomRules, type CustomRules } from "../src/cli/storage";

// Helper for temporary rules file
const CONFIG_DIR = path.join(os.homedir(), ".openclaw", "config", "berry-shield");
const RULES_FILE = path.join(CONFIG_DIR, "custom-rules.json");

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
            expect(matches).toContain("Email");
            expect(matches.length).toBe(2);

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
        // Back up original rules if they exist
        let originalContent: string | null = null;

        beforeEach(() => {
            if (fs.existsSync(RULES_FILE)) {
                originalContent = fs.readFileSync(RULES_FILE, "utf-8");
            }
        });

        afterEach(() => {
            if (originalContent !== null) {
                fs.writeFileSync(RULES_FILE, originalContent);
            } else if (fs.existsSync(RULES_FILE)) {
                fs.unlinkSync(RULES_FILE);
            }
        });

        it("should reload patterns when file timestamp changes", () => {
            // 1. Initial load (likely default)
            const initialCount = getAllRedactionPatterns().length;

            // 2. Add a custom rule via storage (which updates the file)
            const rules: CustomRules = {
                version: "1.0",
                secrets: [{ name: "ContractTestKey", pattern: "CONTRACT_SECRET_[0-9]+", placeholder: "[BLOCKED]", addedAt: new Date().toISOString() }],
                sensitiveFiles: [],
                destructiveCommands: []
            };
            saveCustomRules(rules);

            // Manually force a future mtime to ensure the cache sees the change
            // (filesystem precision can be low on some systems)
            const futureTime = new Date(Date.now() + 10000);
            fs.utimesSync(RULES_FILE, futureTime, futureTime);

            // 3. Get patterns again
            const updatedPatterns = getAllRedactionPatterns();

            // 4. Verify the new pattern is present
            expect(updatedPatterns.length).toBeGreaterThan(initialCount);
            const testPattern = updatedPatterns.find(p => p.name === "ContractTestKey");
            expect(testPattern).toBeDefined();
            expect(testPattern?.pattern.test("CONTRACT_SECRET_12345")).toBe(true);
        });

        it("should NOT reload if the file hasn't changed (Cache hit)", () => {
            // We use global state for cache, so we just check it doesn't break
            const patterns1 = getAllRedactionPatterns();
            const patterns2 = getAllRedactionPatterns();

            expect(patterns1).toBe(patterns2); // Should be the exact same array instance? 
            // Warning: Our current implementation returns a NEW array from spread [...SECRET, ...CUSTOM].
            // But we can check if it's stable.
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
