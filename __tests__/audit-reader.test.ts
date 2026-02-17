import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { AUDIT_LOG } from "../src/constants";
import { clearAuditLog, readAuditEvents } from "../src/audit/reader";

describe("AuditReader", () => {
    it("reads valid JSONL events", async () => {
        const dir = await mkdtemp(join(tmpdir(), "berry-reader-"));
        const path = join(dir, AUDIT_LOG.FILE);
        const lines = [
            JSON.stringify({
                mode: "audit",
                decision: "would_block",
                layer: "stem",
                reason: "destructive command",
                target: "rm -rf /tmp",
                ts: new Date().toISOString(),
            }),
            JSON.stringify({
                mode: "enforce",
                decision: "redacted",
                layer: "pulp",
                hook: "message_sending",
                toolName: "message",
                count: 1,
                types: ["Email"],
                ts: new Date().toISOString(),
            }),
        ];
        await writeFile(path, lines.join("\n") + "\n", "utf-8");

        const events = await readAuditEvents(dir);
        expect(events.length).toBe(2);
    });

    it("ignores malformed lines", async () => {
        const dir = await mkdtemp(join(tmpdir(), "berry-reader-"));
        const path = join(dir, AUDIT_LOG.FILE);
        const valid = JSON.stringify({
            mode: "audit",
            decision: "would_block",
            layer: "thorn",
            reason: "sensitive file",
            target: ".env",
            ts: new Date().toISOString(),
        });
        await writeFile(path, `${valid}\nnot-json\n{"incomplete":true}\n`, "utf-8");

        const events = await readAuditEvents(dir);
        expect(events.length).toBe(1);
    });

    it("returns empty array for missing or empty files", async () => {
        const dir = await mkdtemp(join(tmpdir(), "berry-reader-"));
        expect(await readAuditEvents(dir)).toEqual([]);

        const path = join(dir, AUDIT_LOG.FILE);
        await writeFile(path, "", "utf-8");
        expect(await readAuditEvents(dir)).toEqual([]);
    });

    it("clearAuditLog truncates file and returns cleared count", async () => {
        const dir = await mkdtemp(join(tmpdir(), "berry-reader-"));
        const path = join(dir, AUDIT_LOG.FILE);
        await writeFile(
            path,
            `${JSON.stringify({
                mode: "audit",
                decision: "would_block",
                layer: "stem",
                reason: "test",
                target: "x",
                ts: new Date().toISOString(),
            })}\n`,
            "utf-8",
        );

        const { cleared } = await clearAuditLog(dir);
        expect(cleared).toBe(1);
        expect(await readAuditEvents(dir)).toEqual([]);
    });
});

