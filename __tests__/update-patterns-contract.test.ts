import { describe, expect, it } from "vitest";
import {
    assertGeneratedRulesContract,
    collectGeneratedPatterns,
    isValidGitleaksId,
    type GitleaksConfig,
} from "../scripts/update-patterns";

describe("update-patterns contract", () => {
    it("accepts unique ids and unique patterns", () => {
        const config: GitleaksConfig = {
            title: "test",
            rules: [
                { id: "alpha-token", description: "alpha", regex: "^ALPHA$" },
                { id: "beta-token", description: "beta", regex: "^BETA$" },
            ],
        };

        const { validRules, skippedRules } = collectGeneratedPatterns(config);

        expect(skippedRules).toEqual([]);
        expect(validRules).toHaveLength(2);
    });

    it("fails when ids are duplicated", () => {
        expect(() => {
            assertGeneratedRulesContract([
                { id: "dup-id", description: "a", pattern: "^A$", tags: [] },
                { id: "dup-id", description: "b", pattern: "^B$", tags: [] },
            ]);
        }).toThrow(/Duplicate gitleaks ids/);
    });

    it("fails when patterns are duplicated", () => {
        expect(() => {
            assertGeneratedRulesContract([
                { id: "first", description: "a", pattern: "^SAME$", tags: [] },
                { id: "second", description: "b", pattern: "^SAME$", tags: [] },
            ]);
        }).toThrow(/Duplicate gitleaks regex patterns/);
    });

    it("fails for invalid id format", () => {
        expect(isValidGitleaksId("bad id with spaces")).toBe(false);

        expect(() => {
            assertGeneratedRulesContract([
                { id: "bad id with spaces", description: "invalid", pattern: "^X$", tags: [] },
            ]);
        }).toThrow(/Invalid gitleaks id/);
    });

    it("skips invalid regex patterns", () => {
        const config: GitleaksConfig = {
            title: "test",
            rules: [
                { id: "valid-id", description: "valid", regex: "^OK$" },
                { id: "invalid-id", description: "invalid", regex: "[unclosed" },
            ],
        };

        const { validRules, skippedRules } = collectGeneratedPatterns(config);

        expect(validRules).toHaveLength(1);
        expect(validRules[0].id).toBe("valid-id");
        expect(skippedRules).toHaveLength(1);
        expect(skippedRules[0]).toContain("invalid-id");
    });
});