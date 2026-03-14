import { VERSION } from "../../constants.js";
import { theme, symbols } from "./theme.js";

/**
 * Berry Shield TUI Layout Utilities
 */

export const TIPS = [
    "Audit mode is your playground: test rules safely before you enforce.",
    "Enforce mode actively blocks any action that matches a security pattern.",
    "Custom rules are persistent and stored in your home directory.",
    "Profile controls prompt-injection behavior: strict, balanced, minimal.",
    "Policy tuning controls escalation turns, stale windows, and heartbeats.",
    "Root layer injects runtime safety policy before agent execution starts.",
    "Leaf layer audits incoming messages to track sensitive-signal exposure.",
    "The 'test' command helps you validate regex patterns against strings.",
    "Use 'openclaw bshield rules list' to inspect baseline and custom rules.",
    "Use 'openclaw bshield rules disable baseline <id>' for scoped hardening.",
    "Thorn layer blocks destructive commands via hooks in real-time.",
    "Stem layer acts as a mandatory security gate for file operations.",
    "Pulp layer scans and redacts secrets from all outgoing logs.",
    "Vine layer guards against external-untrusted instruction escalation.",
    "Vine confirmation 1:1 requires one code per sensitive action.",
    "Vine confirmation 1:N reuses one code for multiple sensitive actions within the active window.",
    "Redaction replaces sensitive data with markers to ensure privacy.",
];

type HeaderSlot = {
    header: (title: string) => void;
};

type ContentSlot = {
    section: (title: string) => void;
    row: (label: string, value: string) => void;
    table: (rows: ReadonlyArray<{ label: string; value: string }>, minLabelWidth?: number) => void;
    divider: (width?: number) => void;
    spacer: (lines?: number) => void;
    successMsg: (message: string) => void;
    warningMsg: (message: string) => void;
    failureMsg: (message: string) => void;
};

type BottomSlot = {
    footer: (customMessage?: string) => void;
};

export const ui = {
    /**
   * ◇ Title ────────────────────────────────────────────
   */
    header(title: string) {
        const termWidth = process.stdout.columns || 80;

        // Keep section headers visually neutral (diamond).
        // Success/failure state should be expressed in content rows.
        const marker = ` ${symbols.marker} `;

        const formattedTitle = theme.accentBold(title);
        const lineLength = Math.max(0, termWidth - title.length - 6);
        const line = theme.border("─".repeat(lineLength));

        console.log(`\n${marker}${formattedTitle} ${line}\n`);
    },

    /**
     *   Label       Value
     */
    row(label: string, value: string) {
        const paddedLabel = theme.muted(label.padEnd(12));
        console.log(`   ${paddedLabel} ${value}`);
    },

    /**
     * Section subtitle inside scaffold content.
     */
    section(title: string) {
        console.log(`   ${symbols.marker} ${theme.accent(title)}`);
    },

    /**
     * Renders a two-column table with dynamic label width.
     */
    table(rows: ReadonlyArray<{ label: string; value: string }>, minLabelWidth = 12) {
        if (rows.length === 0) {
            return;
        }

        const computedLabelWidth = Math.max(
            minLabelWidth,
            ...rows.map((row) => row.label.length),
        );

        for (const row of rows) {
            const paddedLabel = theme.muted(row.label.padEnd(computedLabelWidth));
            console.log(`   ${paddedLabel} ${row.value}`);
        }
    },

    /**
     * Visual divider for grouped content sections.
     */
    divider(width = 20) {
        console.log(theme.dim("   " + "─".repeat(width)));
    },

    /**
     * Vertical spacing between content blocks.
     */
    spacer(lines = 1) {
        const safeLines = Number.isInteger(lines) && lines > 0 ? lines : 1;
        for (let i = 0; i < safeLines; i += 1) {
            console.log("");
        }
    },

    /**
     * Standard command screen composition.
     * - header: optional
     * - content: required
     * - bottom: optional (defaults to ui.footer())
     */
    scaffold(options: {
        header?: (h: HeaderSlot) => void;
        content: (c: ContentSlot) => void;
        bottom?: (f: BottomSlot) => void;
    }) {
        const headerSlot: HeaderSlot = {
            header: (title) => this.header(title),
        };
        const contentSlot: ContentSlot = {
            section: (title) => this.section(title),
            row: (label, value) => this.row(label, value),
            table: (rows, minLabelWidth = 12) => this.table(rows, minLabelWidth),
            divider: (width = 20) => this.divider(width),
            spacer: (lines = 1) => this.spacer(lines),
            successMsg: (message) => this.successMsg(message),
            warningMsg: (message) => this.warningMsg(message),
            failureMsg: (message) => this.failureMsg(message),
        };
        const bottomSlot: BottomSlot = {
            footer: (customMessage) => this.footer(customMessage),
        };

        if (options.header) {
            options.header(headerSlot);
        }

        options.content(contentSlot);

        if (options.bottom) {
            options.bottom(bottomSlot);
        } else {
            this.footer();
        }
    },


    /**
     * Berry Shield $version - Tip: $message
     */
    footer(customMessage?: string) {
        console.log(this.formatFooter(customMessage));
    },

    formatFooter(customMessage?: string) {
        const msg = customMessage || TIPS[Math.floor(Math.random() * TIPS.length)];
        const main = theme.accentBold("Berry Shield");
        const ver = theme.version(VERSION);
        const tipStr = theme.tipText(`Tip: ${msg}`);

        return `\n   ${symbols.brand} ${main} ${ver} - ${tipStr}\n`;
    },

    /**
     * Helper for standardized success message lines
     */
    successMsg(message: string) {
        console.log(`   ${symbols.success} ${message}`);
    },

    /**
     * Helper for standardized warning message lines
     */
    warningMsg(message: string) {
        console.log(`   ${symbols.warning} ${message}`);
    },

    /**
     * Helper for standardized failure message lines
     */
    failureMsg(message: string) {
        console.log(`   ${symbols.failure} ${theme.error("Error:")} ${message}`);
    },
};
