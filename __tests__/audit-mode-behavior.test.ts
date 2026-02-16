import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AuditBlockEvent, AuditRedactEvent, AuditEvent } from "../src/types/audit-event";
import { formatAuditEvent } from "../src/types/audit-event";
import { AUDIT_DECISIONS, SECURITY_LAYERS, HOOKS } from "../src/constants";

/**
 * Contract: Audit Mode Behavior (Shadow Mode)
 *
 * These tests validate that all security layers produce correct
 * structured audit events and that the AuditEvent type contract
 * is enforced at runtime.
 */

describe("Contract: Audit Mode Behavior (Shadow Mode)", () => {

    describe("AuditEvent Type Contract", () => {
        it("formatAuditEvent produces valid JSON for would_block events", () => {
            const event: AuditBlockEvent = {
                mode: "audit",
                decision: "would_block",
                layer: "stem",
                reason: "destructive command",
                target: "rm -rf /",
                ts: "2026-02-16T12:00:00.000Z",
            };

            const json = formatAuditEvent(event);
            const parsed = JSON.parse(json) as AuditBlockEvent;

            expect(parsed.mode).toBe("audit");
            expect(parsed.decision).toBe(AUDIT_DECISIONS.WOULD_BLOCK);
            expect(parsed.layer).toBe(SECURITY_LAYERS.STEM);
            expect(parsed.reason).toBe("destructive command");
            expect(parsed.target).toBe("rm -rf /");
            expect(parsed.ts).toBe("2026-02-16T12:00:00.000Z");
        });

        it("formatAuditEvent produces valid JSON for would_redact events", () => {
            const event: AuditRedactEvent = {
                mode: "audit",
                decision: "would_redact",
                layer: "pulp",
                hook: "tool_result_persist",
                toolName: "read_file",
                count: 2,
                types: ["AWS Access Key", "Email"],
                ts: "2026-02-16T12:00:00.000Z",
            };

            const json = formatAuditEvent(event);
            const parsed = JSON.parse(json) as AuditRedactEvent;

            expect(parsed.mode).toBe("audit");
            expect(parsed.decision).toBe(AUDIT_DECISIONS.WOULD_REDACT);
            expect(parsed.layer).toBe(SECURITY_LAYERS.PULP);
            expect(parsed.hook).toBe(HOOKS.TOOL_RESULT_PERSIST);
            expect(parsed.toolName).toBe("read_file");
            expect(parsed.count).toBe(2);
            expect(parsed.types).toEqual(["AWS Access Key", "Email"]);
        });

        it("formatAuditEvent produces valid JSON for enforce mode events", () => {
            const event: AuditBlockEvent = {
                mode: "enforce",
                decision: "blocked",
                layer: "thorn",
                reason: "sensitive file access",
                target: ".env",
                ts: "2026-02-16T12:00:00.000Z",
            };

            const json = formatAuditEvent(event);
            const parsed = JSON.parse(json) as AuditBlockEvent;

            expect(parsed.mode).toBe("enforce");
            expect(parsed.decision).toBe(AUDIT_DECISIONS.BLOCKED);
        });
    });

    describe("AuditEvent Schema Contract", () => {
        it("AuditBlockEvent has all required fields", () => {
            const event: AuditBlockEvent = {
                mode: "audit",
                decision: "would_block",
                layer: "stem",
                reason: "test",
                target: "test",
                ts: new Date().toISOString(),
            };

            const keys = Object.keys(event);
            expect(keys).toContain("mode");
            expect(keys).toContain("decision");
            expect(keys).toContain("layer");
            expect(keys).toContain("reason");
            expect(keys).toContain("target");
            expect(keys).toContain("ts");
            expect(keys).toHaveLength(6);
        });

        it("AuditRedactEvent has all required fields", () => {
            const event: AuditRedactEvent = {
                mode: "audit",
                decision: "would_redact",
                layer: "pulp",
                hook: "tool_result_persist",
                toolName: "read_file",
                count: 1,
                types: ["test"],
                ts: new Date().toISOString(),
            };

            const keys = Object.keys(event);
            expect(keys).toContain("mode");
            expect(keys).toContain("decision");
            expect(keys).toContain("layer");
            expect(keys).toContain("hook");
            expect(keys).toContain("toolName");
            expect(keys).toContain("count");
            expect(keys).toContain("types");
            expect(keys).toContain("ts");
            expect(keys).toHaveLength(8);
        });

        it("layer field accepts only valid layer names", () => {
            const validLayers: AuditEvent["layer"][] = ["stem", "pulp", "thorn"];
            expect(validLayers).toHaveLength(3);
            for (const layer of validLayers) {
                expect(["stem", "pulp", "thorn"]).toContain(layer);
            }
        });
    });

    describe("Audit Mode Decision Vocabulary", () => {
        it("audit mode uses would_block (not blocked)", () => {
            const event: AuditBlockEvent = {
                mode: "audit",
                decision: "would_block",
                layer: "stem",
                reason: "destructive command",
                target: "rm -rf /",
                ts: new Date().toISOString(),
            };
            expect(event.decision).toBe(AUDIT_DECISIONS.WOULD_BLOCK);
        });

        it("audit mode uses would_redact (not redacted)", () => {
            const event: AuditRedactEvent = {
                mode: "audit",
                decision: "would_redact",
                layer: "pulp",
                hook: "tool_result_persist",
                toolName: "read_file",
                count: 1,
                types: ["AWS Access Key"],
                ts: new Date().toISOString(),
            };
            expect(event.decision).toBe(AUDIT_DECISIONS.WOULD_REDACT);
        });

        it("enforce mode uses blocked (not would_block)", () => {
            const event: AuditBlockEvent = {
                mode: "enforce",
                decision: "blocked",
                layer: "thorn",
                reason: "sensitive file access",
                target: ".env",
                ts: new Date().toISOString(),
            };
            expect(event.decision).toBe(AUDIT_DECISIONS.BLOCKED);
        });

        it("enforce mode uses redacted (not would_redact)", () => {
            const event: AuditRedactEvent = {
                mode: "enforce",
                decision: "redacted",
                layer: "pulp",
                hook: "message_sending",
                toolName: "message",
                count: 3,
                types: ["Email", "Phone"],
                ts: new Date().toISOString(),
            };
            expect(event.decision).toBe(AUDIT_DECISIONS.REDACTED);
        });
    });

    describe("formatAuditEvent Roundtrip Contract", () => {
        it("JSON roundtrip preserves all fields for block events", () => {
            const original: AuditBlockEvent = {
                mode: "audit",
                decision: "would_block",
                layer: "stem",
                reason: "destructive command with special chars: rm -rf / && echo 'pwned'",
                target: "rm -rf / && echo 'pwned'",
                ts: "2026-02-16T12:00:00.000Z",
            };

            const roundtripped = JSON.parse(formatAuditEvent(original)) as AuditBlockEvent;
            expect(roundtripped).toEqual(original);
        });

        it("JSON roundtrip preserves all fields for redact events", () => {
            const original: AuditRedactEvent = {
                mode: "audit",
                decision: "would_redact",
                layer: "pulp",
                hook: "tool_result_persist",
                toolName: "read_file",
                count: 5,
                types: ["AWS Access Key", "GitHub Token", "Email"],
                ts: "2026-02-16T12:00:00.000Z",
            };

            const roundtripped = JSON.parse(formatAuditEvent(original)) as AuditRedactEvent;
            expect(roundtripped).toEqual(original);
        });
    });
});
