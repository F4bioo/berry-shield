import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { AUDIT_LOG } from "../src/constants";
import { AuditWriter, initAuditWriter, resetAuditWriter } from "../src/audit/writer";
import type { AuditBlockEvent } from "../src/types/audit-event";

function makeEvent(index = 0): AuditBlockEvent {
    return {
        mode: "audit",
        decision: "would_block",
        layer: "stem",
        reason: `reason-${index}`,
        target: `target-${index}`,
        ts: new Date().toISOString(),
    };
}

describe("AuditWriter", () => {
    it("writes valid JSONL after flush", async () => {
        const dir = await mkdtemp(join(tmpdir(), "berry-writer-"));
        const writer = new AuditWriter(dir);
        writer.push(makeEvent(1));
        await writer.flush();

        const content = await readFile(writer.path, "utf-8");
        const parsed = JSON.parse(content.trim()) as AuditBlockEvent;
        expect(parsed.reason).toBe("reason-1");
        await writer.destroy();
    });

    it("drops oldest events when buffer exceeds max", async () => {
        const dir = await mkdtemp(join(tmpdir(), "berry-writer-"));
        const writer = new AuditWriter(dir);
        const total = AUDIT_LOG.MAX_BUFFER_SIZE + AUDIT_LOG.FLUSH_BATCH_SIZE + 5;

        for (let i = 0; i < total; i++) {
            writer.push(makeEvent(i));
        }
        await writer.flush();
        await writer.flush();

        expect(writer.droppedEvents).toBe(5);
        const content = await readFile(writer.path, "utf-8");
        const lines = content.trim().split("\n");
        expect(lines.length).toBe(AUDIT_LOG.MAX_BUFFER_SIZE + AUDIT_LOG.FLUSH_BATCH_SIZE);
        await writer.destroy();
    });

    it("rotates file when size exceeds max limit", async () => {
        const dir = await mkdtemp(join(tmpdir(), "berry-writer-"));
        const logPath = join(dir, AUDIT_LOG.FILE);
        await writeFile(logPath, "x".repeat(AUDIT_LOG.MAX_FILE_SIZE + 1), "utf-8");

        const writer = new AuditWriter(dir);
        writer.push(makeEvent());
        await writer.flush();

        const backupPath = join(dir, "audit.1.jsonl");
        const backupStats = await stat(backupPath);
        expect(backupStats.size).toBeGreaterThanOrEqual(AUDIT_LOG.MAX_FILE_SIZE);
        await writer.destroy();
    });

    it("does not throw on write errors (best-effort)", async () => {
        const writer = new AuditWriter("bad\0dir");
        writer.push(makeEvent());
        await expect(writer.flush()).resolves.toBeUndefined();
        await writer.destroy();
    });

    it("returns the same singleton instance on repeated init", () => {
        const a = initAuditWriter();
        const b = initAuditWriter();
        expect(a).toBe(b);
        resetAuditWriter();
    });
});
