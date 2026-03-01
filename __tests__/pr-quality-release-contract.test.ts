import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

type PrQualityContract = {
    releaseTitlePattern: string;
    releaseHeadPattern: string;
};

function loadContract(): PrQualityContract {
    return JSON.parse(readFileSync(".github/common-contract.json", "utf8"));
}

describe("PR Quality Release Contract", () => {
    const contract = loadContract();
    const titlePattern = new RegExp(contract.releaseTitlePattern);
    const headPattern = new RegExp(contract.releaseHeadPattern);

    it("accepts valid release title format for master PRs", () => {
        expect(titlePattern.test("chore(release): v2026.2.28")).toBe(true);
        expect(titlePattern.test("chore(release): v2026.2.28-1")).toBe(true);
    });

    it("rejects invalid release title format for master PRs", () => {
        expect(titlePattern.test("chore(release): publish berry-shield version 2026.2.28")).toBe(false);
        expect(titlePattern.test("fix(release): v2026.2.28")).toBe(false);
    });

    it("accepts valid release branch format for master PRs", () => {
        expect(headPattern.test("release/v2026.2.28")).toBe(true);
        expect(headPattern.test("release/v2026.2.28-2")).toBe(true);
    });

    it("rejects invalid release branch format for master PRs", () => {
        expect(headPattern.test("develop")).toBe(false);
        expect(headPattern.test("release/2026.2.28")).toBe(false);
    });
});
