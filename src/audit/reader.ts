/**
 * Audit log reader for the Berry Shield CLI.
 *
 * Reads and parses the JSONL audit log file.
 * Resilient to malformed lines (skips them).
 */

import { readFile, writeFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AuditEvent } from "../types/audit-event.js";
import { AUDIT_LOG } from "../constants.js";

/**
 * Resolve the audit log file path.
 */
export function getAuditLogPath(logDir?: string): string {
    const baseDir = logDir ?? join(homedir(), ".openclaw", AUDIT_LOG.DIR);
    return join(baseDir, AUDIT_LOG.FILE);
}

/**
 * Read and parse all audit events from the JSONL log.
 * Returns empty array if file doesn't exist or is empty.
 * Silently skips malformed/incomplete lines.
 */
export async function readAuditEvents(logDir?: string): Promise<AuditEvent[]> {
    const logPath = getAuditLogPath(logDir);

    let raw: string;
    try {
        raw = await readFile(logPath, "utf-8");
    } catch {
        return [];
    }

    if (!raw.trim()) return [];

    const events: AuditEvent[] = [];
    const lines = raw.split("\n");

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed === "object" && "decision" in parsed && "layer" in parsed && "ts" in parsed) {
                events.push(parsed as AuditEvent);
            }
        } catch {
            // Skip malformed lines
        }
    }

    return events;
}

/**
 * Clear the audit log. Returns the number of events that were in the file.
 * Best-effort: concurrent writes from the gateway may result in
 * partial data loss of buffered events not yet flushed.
 */
export async function clearAuditLog(logDir?: string): Promise<{ cleared: number }> {
    const logPath = getAuditLogPath(logDir);

    let count = 0;
    try {
        const events = await readAuditEvents(logDir);
        count = events.length;
        await writeFile(logPath, "", "utf-8");
    } catch {
        // File doesn't exist or can't be cleared
    }

    return { cleared: count };
}

/**
 * Check if the audit log file exists and has content.
 */
export async function auditLogExists(logDir?: string): Promise<boolean> {
    const logPath = getAuditLogPath(logDir);
    try {
        const stats = await stat(logPath);
        return stats.size > 0;
    } catch {
        return false;
    }
}
