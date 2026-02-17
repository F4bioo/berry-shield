/**
 * Async batch audit log writer.
 *
 * Singleton pattern — initialized once via initAuditWriter().
 * Events are buffered and flushed periodically or on SIGTERM.
 * Never throws — write failures are silently dropped (best-effort).
 */

import { appendFile, rename, stat, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AuditEvent } from "../types/audit-event.js";
import { formatAuditEvent } from "../types/audit-event.js";
import { AUDIT_LOG } from "../constants.js";

let instance: AuditWriter | null = null;

export class AuditWriter {
    private buffer: string[] = [];
    private timer: ReturnType<typeof setInterval> | null = null;
    private flushing = false;
    private flushInFlight: Promise<void> | null = null;
    private _droppedEvents = 0;
    private readonly ready: Promise<void>;
    private readonly logPath: string;
    private readonly backupPath: string;

    constructor(logDir?: string) {
        const baseDir = logDir ?? join(homedir(), ".openclaw", AUDIT_LOG.DIR);
        this.logPath = join(baseDir, AUDIT_LOG.FILE);
        this.backupPath = join(baseDir, `audit.1.jsonl`);

        this.ready = mkdir(baseDir, { recursive: true }).then(() => undefined).catch(() => undefined);
        this.startTimer();
        this.registerShutdown();
    }

    /** Push an event to the buffer. Never throws. */
    push(event: AuditEvent): void {
        try {
            if (this.buffer.length >= AUDIT_LOG.MAX_BUFFER_SIZE) {
                this.buffer.shift();
                this._droppedEvents++;
            }
            this.buffer.push(formatAuditEvent(event));

            if (this.buffer.length >= AUDIT_LOG.FLUSH_BATCH_SIZE) {
                void this.flush();
            }
        } catch {
            // Never propagate errors to the security hook
        }
    }

    /** Flush buffered events to disk. Async, best-effort. */
    async flush(): Promise<void> {
        if (this.flushing) {
            return this.flushInFlight ?? Promise.resolve();
        }
        if (this.buffer.length === 0) return;
        this.flushing = true;

        this.flushInFlight = (async () => {
            const lines = this.buffer.splice(0);
            const data = lines.join("\n") + "\n";

            try {
                await this.ready;
                await this.rotateIfNeeded();
                await appendFile(this.logPath, data, "utf-8");
            } catch {
                // Best-effort: silently drop on write failure
            } finally {
                this.flushing = false;
                this.flushInFlight = null;
            }
        })();

        return this.flushInFlight;
    }

    /** Clean up timer and flush remaining events. */
    async destroy(): Promise<void> {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        await this.flush();
    }

    /** Number of events dropped due to buffer overflow. */
    get droppedEvents(): number {
        return this._droppedEvents;
    }

    /** Absolute path to the audit log file. */
    get path(): string {
        return this.logPath;
    }

    private startTimer(): void {
        this.timer = setInterval(() => {
            void this.flush();
        }, AUDIT_LOG.FLUSH_INTERVAL_MS);

        // Unref so the timer doesn't keep the process alive
        this.timer.unref();
    }

    private registerShutdown(): void {
        const handler = () => {
            void this.flush();
        };
        process.once("SIGTERM", handler);
    }

    private async rotateIfNeeded(): Promise<void> {
        try {
            const stats = await stat(this.logPath);
            if (stats.size >= AUDIT_LOG.MAX_FILE_SIZE) {
                await rename(this.logPath, this.backupPath);
            }
        } catch {
            // File doesn't exist yet or stat failed — no rotation needed
        }
    }

}

/**
 * Initialize the singleton AuditWriter.
 * Safe to call multiple times — returns existing instance.
 */
export function initAuditWriter(logDir?: string): AuditWriter {
    if (!instance) {
        instance = new AuditWriter(logDir);
    }
    return instance;
}

/**
 * Get the current AuditWriter instance (for layers).
 * Returns null if not initialized.
 */
export function getAuditWriter(): AuditWriter | null {
    return instance;
}

/**
 * Append an audit event using the singleton writer.
 * Safe no-op when writer is not initialized.
 */
export function appendAuditEvent(event: AuditEvent): void {
    instance?.push(event);
}

/** Reset singleton (for testing only). */
export function resetAuditWriter(): void {
    if (instance) {
        void instance.destroy();
        instance = null;
    }
}
