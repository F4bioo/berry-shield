import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { clearAuditLog, readAuditEvents } from "../../audit/reader.js";
import type { AuditEvent } from "../../types/audit-event.js";
import { ui } from "../ui/tui.js";
import { theme } from "../ui/theme.js";

type PluginLogger = OpenClawPluginApi["logger"];

interface ReportOptions {
    clear?: boolean;
}

function buildSummary(events: AuditEvent[]): Array<{ label: string; value: string }> {
    const counts = new Map<string, number>();
    for (const event of events) {
        counts.set(event.decision, (counts.get(event.decision) ?? 0) + 1);
    }

    return [
        { label: "would_block", value: String(counts.get("would_block") ?? 0) },
        { label: "would_redact", value: String(counts.get("would_redact") ?? 0) },
        { label: "blocked", value: String(counts.get("blocked") ?? 0) },
        { label: "redacted", value: String(counts.get("redacted") ?? 0) },
    ];
}

function formatPeriod(events: AuditEvent[]): string {
    const first = events[0]?.ts;
    const last = events[events.length - 1]?.ts;
    if (!first || !last) {
        return "n/a";
    }
    return `${first.slice(0, 10)} -> ${last.slice(0, 10)}`;
}

function eventDetail(event: AuditEvent): string {
    if ("reason" in event) {
        return `${event.reason} | ${event.target}`;
    }
    const types = event.types.length > 0 ? event.types.join(", ") : "n/a";
    return `${types} | ${event.toolName}`;
}

export async function reportCommand(options: ReportOptions, logger: PluginLogger): Promise<void> {
    try {
        if (options.clear) {
            const { cleared } = await clearAuditLog();
            ui.scaffold({
                header: (s) => s.header("Global Report"),
                content: (s) => s.successMsg(`Audit log cleared (${cleared} event(s)).`),
                bottom: (s) => s.footer("Best-effort clear: in-flight buffered events may be written after this command."),
            });
            return;
        }

        const events = await readAuditEvents();
        if (events.length === 0) {
            ui.scaffold({
                header: (s) => s.header("Global Report"),
                content: (s) => s.warningMsg("No audit events found."),
                bottom: (s) => s.footer("Generate activity, then run 'openclaw bshield report' again."),
            });
            return;
        }

        const summary = buildSummary(events);
        const recentEvents = events.slice(-8);

        ui.scaffold({
            header: (s) => s.header("Global Report"),
            content: (s) => {
                s.table([
                    { label: "Events", value: theme.bold(String(events.length)) },
                    { label: "Period", value: formatPeriod(events) },
                ]);

                s.spacer();
                s.section("Summary");
                s.table(summary);

                s.spacer();
                s.section("Details");
                for (const event of recentEvents) {
                    s.row(event.layer, `${event.decision} | ${eventDetail(event)}`);
                }
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg(`Failed to generate report: ${message}`),
        });
        logger.error(`[berry-shield] CLI error: Failed to generate report: ${message}`);
        process.exit(1);
    }
}
