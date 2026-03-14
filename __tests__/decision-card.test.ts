import { describe, it, expect } from "vitest";
import {
    formatCardForToolResult,
    formatCardForBlockReason,
} from "../src/ui/decision-card/format-text.js";
import { formatCardForTui } from "../src/ui/decision-card/format-tui.js";
import type { DecisionCard } from "../src/ui/decision-card/types.js";
import { BRAND_SYMBOL } from "../src/constants.js";

describe("decision-card / format-text", () => {
    describe("formatCardForToolResult", () => {
        it("renders ALLOWED card with required fields", () => {
            const card: DecisionCard = {
                status: "ALLOWED",
                layer: "Stem",
                operation: "exec",
                target: "echo hello",
            };
            const result = formatCardForToolResult(card);
            expect(result).toContain(`${BRAND_SYMBOL} Berry Shield`);
            expect(result).toContain("STATUS: ALLOWED ✓");
            expect(result).toContain("OPERATION: exec");
            expect(result).toContain("TARGET: echo hello");
            expect(result).toContain("You may proceed with this operation.");
            expect(result).not.toContain("REASON:");
        });

        it("renders DENIED card with reason and default action", () => {
            const card: DecisionCard = {
                status: "DENIED",
                layer: "Stem",
                operation: "exec",
                target: "rm -rf /",
                reason: "Destructive command detected",
            };
            const result = formatCardForToolResult(card);
            expect(result).toContain("STATUS: DENIED ✗");
            expect(result).toContain("REASON: Destructive command detected");
            expect(result).toContain("This operation was denied by security policy.");
        });

        it("renders DENIED with custom action text", () => {
            const card: DecisionCard = {
                status: "DENIED",
                layer: "Stem",
                reason: "Sensitive file detected",
                action: "Do NOT read this file. Inform the user it is blocked by security policy.",
            };
            const result = formatCardForToolResult(card);
            expect(result).toContain("Do NOT read this file.");
            expect(result).not.toContain("This operation was denied");
        });

        it("renders BLOCKED card with required fields", () => {
            const card: DecisionCard = {
                status: "BLOCKED",
                layer: "Thorn",
                operation: "exec",
                target: "cat .env",
                reason: "Sensitive file reference",
            };
            const result = formatCardForToolResult(card);
            expect(result).toContain("STATUS: BLOCKED ✗");
            expect(result).toContain("REASON: Sensitive file reference");
            expect(result).toContain("This operation was blocked by runtime security hook.");
        });

        it("renders CONFIRM_REQUIRED with confirmation details", () => {
            const card: DecisionCard = {
                status: "CONFIRM_REQUIRED",
                layer: "Vine",
                operation: "exec",
                target: "bash -lc \"printf VINE_PROOF\"",
                reason: "External untrusted content risk (Vine)",
                confirm: {
                    confirmCode: "8750",
                    ttlSeconds: 90,
                    maxAttempts: 3,
                },
            };
            const result = formatCardForToolResult(card);
            expect(result).toContain("STATUS: CONFIRM_REQUIRED !");
            expect(result).toContain("CONFIRM_CODE: 8750");
            expect(result).toContain("TTL_SECONDS: 90");
            expect(result).toContain("MAX_ATTEMPTS: 3");
            expect(result).toContain("Reply with a message containing 8750 to proceed once.");
            expect(result).not.toContain("ATTEMPTS_REMAINING:");
        });

        it("renders CONFIRM_REQUIRED with retry hint on invalid code", () => {
            const card: DecisionCard = {
                status: "CONFIRM_REQUIRED",
                layer: "Vine",
                operation: "exec",
                target: "some-command",
                confirm: {
                    confirmCode: "1234",
                    ttlSeconds: 90,
                    maxAttempts: 3,
                    attemptsRemaining: 2,
                    invalidCode: true,
                },
            };
            const result = formatCardForToolResult(card);
            expect(result).toContain("ATTEMPTS_REMAINING: 2");
            expect(result).toContain("Last code was invalid.");
            expect(result).toContain("Attempts remaining: 2.");
        });

        it("renders HUMAN_CONFIRM_REQUIRED with explicit degraded-binding action", () => {
            const card: DecisionCard = {
                status: "HUMAN_CONFIRM_REQUIRED",
                layer: "Vine",
                operation: "write",
                target: "/tmp/proof.txt",
                reason: "External untrusted content risk (Vine)",
                action: "Binding degraded; confirm explicitly to proceed with this single action.",
            };
            const result = formatCardForToolResult(card);
            expect(result).toContain("STATUS: HUMAN_CONFIRM_REQUIRED !");
            expect(result).toContain("REASON: External untrusted content risk (Vine)");
            expect(result).toContain("Binding degraded; confirm explicitly to proceed with this single action.");
        });

        it("omits optional fields when absent", () => {
            const card: DecisionCard = {
                status: "DENIED",
                reason: "Test reason",
            };
            const result = formatCardForToolResult(card);
            expect(result).not.toContain("OPERATION:");
            expect(result).not.toContain("TARGET:");
            expect(result).toContain("REASON: Test reason");
        });

        it("uses fallback reason when reason is missing on DENIED", () => {
            const card: DecisionCard = {
                status: "DENIED",
                layer: "Stem",
            };
            const result = formatCardForToolResult(card);
            expect(result).toContain("REASON: Security policy violation");
        });

        it("truncates target longer than 120 characters", () => {
            const longTarget = "x".repeat(200);
            const card: DecisionCard = {
                status: "ALLOWED",
                layer: "Stem",
                operation: "exec",
                target: longTarget,
            };
            const result = formatCardForToolResult(card);
            expect(result).toContain("TARGET: " + "x".repeat(120) + "...");
        });
    });

    describe("formatCardForBlockReason", () => {
        it("produces structured multiline block reason with layer and reason", () => {
            const card: DecisionCard = {
                status: "BLOCKED",
                layer: "Vine",
                operation: "exec",
                target: "/tmp/proof.txt",
                reason: "external content risk",
            };
            const result = formatCardForBlockReason(card);
            expect(result).toContain(`${BRAND_SYMBOL} Berry Shield`);
            expect(result).toContain("STATUS: BLOCKED ✗");
            expect(result).toContain("LAYER: Vine");
            expect(result).toContain("OPERATION: exec");
            expect(result).toContain("TARGET: /tmp/proof.txt");
            expect(result).toContain("REASON: external content risk");
            expect(result).toContain("This operation was blocked by runtime security hook.");
        });

        it("uses default layer when layer is missing", () => {
            const card: DecisionCard = {
                status: "BLOCKED",
                reason: "some risk",
            };
            const result = formatCardForBlockReason(card);
            expect(result).toContain("LAYER: Shield");
        });

        it("uses default reason when reason is missing", () => {
            const card: DecisionCard = {
                status: "BLOCKED",
                layer: "Thorn",
            };
            const result = formatCardForBlockReason(card);
            expect(result).toContain("REASON: Security policy violation");
        });

        it("omits TARGET line when target is absent", () => {
            const card: DecisionCard = {
                status: "BLOCKED",
                layer: "Vine",
                reason: "external content risk",
            };
            const result = formatCardForBlockReason(card);
            expect(result).not.toContain("TARGET:");
        });
    });

    describe("copy snapshots", () => {
        it("keeps stable copy for ALLOWED tool card", () => {
            const result = formatCardForToolResult({
                status: "ALLOWED",
                layer: "Stem",
                operation: "exec",
                target: "echo hello",
            });
            expect(result).toMatchInlineSnapshot(`
              "🍓 Berry Shield
              
              STATUS: ALLOWED ✓
              OPERATION: exec
              TARGET: echo hello
              
              You may proceed with this operation."
            `);
        });

        it("keeps stable copy for DENIED tool card", () => {
            const result = formatCardForToolResult({
                status: "DENIED",
                layer: "Stem",
                operation: "read",
                target: "/home/user/.env",
                reason: "Sensitive file access",
            });
            expect(result).toMatchInlineSnapshot(`
              "🍓 Berry Shield
              
              STATUS: DENIED ✗
              OPERATION: read
              TARGET: /home/user/.env
              REASON: Sensitive file access
              
              This operation was denied by security policy.
              Note: Berry Shield uses layered controls. A gate result and runtime hook decision may differ by context."
            `);
        });

        it("keeps stable copy for BLOCKED hook card", () => {
            const result = formatCardForBlockReason({
                status: "BLOCKED",
                layer: "Vine",
                operation: "exec",
                target: "/tmp/strawberry-journal-proof.txt",
                reason: "External content risk",
            });
            expect(result).toMatchInlineSnapshot(`
              "🍓 Berry Shield | STATUS: BLOCKED ✗ | LAYER: Vine | OPERATION: exec | TARGET: /tmp/strawberry-journal-proof.txt | REASON: External content risk | This operation was blocked by runtime security hook. | ACTION: Request explicit user confirmation and retry via berry_check."
            `);
        });

        it("keeps stable copy for CONFIRM_REQUIRED tool card", () => {
            const result = formatCardForToolResult({
                status: "CONFIRM_REQUIRED",
                layer: "Vine",
                operation: "exec",
                target: "bash -lc 'printf test > /tmp/a.txt'",
                reason: "External untrusted content risk (Vine)",
                confirm: {
                    confirmCode: "1234",
                    ttlSeconds: 90,
                    maxAttempts: 3,
                },
            });
            expect(result).toMatchInlineSnapshot(`
              "🍓 Berry Shield
              
              STATUS: CONFIRM_REQUIRED !
              OPERATION: exec
              TARGET: bash -lc 'printf test > /tmp/a.txt'
              REASON: External untrusted content risk (Vine)
              CONFIRM_CODE: 1234
              TTL_SECONDS: 90
              MAX_ATTEMPTS: 3
              
              Your session is marked as external-untrusted.
              Reply with a message containing 1234 to proceed once."
            `);
        });
    });
});

describe("decision-card / format-tui", () => {
    describe("formatCardForTui", () => {
        it("renders ALLOWED card with ANSI escape codes", () => {
            const card: DecisionCard = {
                status: "ALLOWED",
                layer: "Stem",
                operation: "exec",
                target: "echo hello",
            };
            const result = formatCardForTui(card);
            // ANSI escape codes present
            expect(result).toContain("\x1b[");
            expect(result).toContain("Berry Shield");
            expect(result).toContain("ALLOWED");
            expect(result).toContain("OPERATION");
            expect(result).toContain("exec");
        });

        it("renders DENIED card with reason", () => {
            const card: DecisionCard = {
                status: "DENIED",
                layer: "Stem",
                reason: "Destructive command",
            };
            const result = formatCardForTui(card);
            expect(result).toContain("\x1b[");
            expect(result).toContain("DENIED");
            expect(result).toContain("Destructive command");
        });

        it("renders CONFIRM_REQUIRED with code and TTL", () => {
            const card: DecisionCard = {
                status: "CONFIRM_REQUIRED",
                layer: "Vine",
                operation: "exec",
                target: "some-cmd",
                confirm: {
                    confirmCode: "4321",
                    ttlSeconds: 90,
                    maxAttempts: 3,
                    attemptsRemaining: 2,
                },
            };
            const result = formatCardForTui(card);
            expect(result).toContain("CONFIRM_REQUIRED");
            expect(result).toContain("4321");
            expect(result).toContain("90s");
            expect(result).toContain("2 remaining");
        });

        it("renders HUMAN_CONFIRM_REQUIRED with warning styling", () => {
            const card: DecisionCard = {
                status: "HUMAN_CONFIRM_REQUIRED",
                layer: "Vine",
                reason: "External untrusted content risk (Vine)",
                action: "Binding degraded; confirm explicitly to proceed with this single action.",
            };
            const result = formatCardForTui(card);
            expect(result).toContain("HUMAN_CONFIRM_REQUIRED");
            expect(result).toContain("Binding degraded; confirm explicitly to proceed with this single action.");
        });

        it("truncates long target", () => {
            const card: DecisionCard = {
                status: "BLOCKED",
                layer: "Thorn",
                target: "y".repeat(200),
            };
            const result = formatCardForTui(card);
            expect(result).toContain("y".repeat(120) + "...");
        });

        it("omits optional fields when absent", () => {
            const card: DecisionCard = {
                status: "BLOCKED",
                layer: "Thorn",
                reason: "test",
            };
            const result = formatCardForTui(card);
            expect(result).not.toContain("OPERATION");
            expect(result).not.toContain("TARGET");
        });
    });
});
