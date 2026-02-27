import { describe, expect, it } from "vitest";
import { remapDisabledBuiltInIds } from "../src/patterns/id-aliases";

describe("baseline id aliases", () => {
    it("remaps known alias to canonical id", () => {
        const remapped = remapDisabledBuiltInIds([
            "secret:gitleaks:gitlab-runner-token",
        ]);
        expect(remapped).toEqual(["secret:gitleaks:gitlab-runner-authentication-token"]);
    });

    it("is idempotent and deduplicates output", () => {
        const first = remapDisabledBuiltInIds([
            "secret:gitleaks:gitlab-runner-token",
            "secret:gitleaks:gitlab-runner-authentication-token",
        ]);
        const second = remapDisabledBuiltInIds(first);
        expect(second).toEqual(["secret:gitleaks:gitlab-runner-authentication-token"]);
    });

    it("resolves chains and guards circular aliases", () => {
        const aliases = {
            "secret:gitleaks:old-a": "secret:gitleaks:old-b",
            "secret:gitleaks:old-b": "secret:gitleaks:new-c",
            "secret:gitleaks:loop-a": "secret:gitleaks:loop-b",
            "secret:gitleaks:loop-b": "secret:gitleaks:loop-a",
        };

        const remapped = remapDisabledBuiltInIds(
            ["secret:gitleaks:old-a", "secret:gitleaks:loop-a"],
            aliases
        );

        expect(remapped).toContain("secret:gitleaks:new-c");
        // Circular alias path should not crash and should keep one stable value.
        expect(remapped.some((id) => id.startsWith("secret:gitleaks:loop-"))).toBe(true);
    });
});

