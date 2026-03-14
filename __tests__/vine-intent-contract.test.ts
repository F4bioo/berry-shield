import { describe, expect, it } from "vitest";
import {
    createIntentSignature,
    isEquivalentApprovedIntent,
} from "../src/vine/vine-intent";
import {
    createVineIntentFromOperationTarget,
    extractVineIntent,
} from "../src/vine/authorization-intent";

describe("Vine intent contract", () => {
    it("treats refined external-read commands as equivalent intent", () => {
        const approved = createVineIntentFromOperationTarget(
            "exec",
            "curl -L https://example.com"
        );
        const requested = createVineIntentFromOperationTarget(
            "exec",
            "curl -Ls https://example.com | grep domain"
        );

        expect(isEquivalentApprovedIntent(approved, requested)).toBe(true);
    });

    it("keeps materially different external sources separated", () => {
        const approved = createVineIntentFromOperationTarget(
            "exec",
            "curl -L https://example.com"
        );
        const requested = createVineIntentFromOperationTarget(
            "exec",
            "curl -L https://another-site.com"
        );

        expect(isEquivalentApprovedIntent(approved, requested)).toBe(false);
        expect(createIntentSignature(approved)).not.toBe(createIntentSignature(requested));
    });

    it("treats interpreter execution as a material change", () => {
        const approved = createVineIntentFromOperationTarget(
            "exec",
            "curl -L https://example.com"
        );
        const requested = createVineIntentFromOperationTarget(
            "exec",
            "curl -L https://example.com | sh"
        );

        expect(isEquivalentApprovedIntent(approved, requested)).toBe(false);
    });

    it("does not let non-sensitive local output path dominate the signature", () => {
        const first = createVineIntentFromOperationTarget(
            "exec",
            "curl -L https://example.com > /tmp/a.txt"
        );
        const second = createVineIntentFromOperationTarget(
            "exec",
            "curl -L https://example.com > /tmp/b.txt"
        );

        expect(createIntentSignature(first)).toBe(createIntentSignature(second));
    });

    it("keeps sensitive local writes separated from non-sensitive local writes", () => {
        const nonSensitive = createVineIntentFromOperationTarget(
            "exec",
            "curl -L https://example.com > /tmp/result.txt"
        );
        const sensitive = createVineIntentFromOperationTarget(
            "exec",
            "curl -L https://example.com > /home/user/.ssh/config"
        );

        expect(isEquivalentApprovedIntent(nonSensitive, sensitive)).toBe(false);
        expect(createIntentSignature(nonSensitive)).not.toBe(createIntentSignature(sensitive));
    });

    it("extracts the same intent from a tool call and a raw operation target", () => {
        const fromTool = extractVineIntent("run_command", {
            command: "curl -L https://example.com > /tmp/result.txt",
        });
        const fromStem = createVineIntentFromOperationTarget(
            "exec",
            "curl -L https://example.com > /tmp/result.txt"
        );

        expect(createIntentSignature(fromTool)).toBe(createIntentSignature(fromStem));
    });
});
