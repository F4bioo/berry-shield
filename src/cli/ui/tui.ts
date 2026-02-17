import { VERSION } from "../../constants.js";
import { theme, symbols } from "./theme.js";

/**
 * Berry Shield TUI Layout Utilities
 */

const TIPS = [
    "Audit mode is your playground: test rules safely before you enforce.",
    "Enforce mode actively blocks any action that matches a security pattern.",
    "Custom rules are persistent and stored in your home directory.",
    "The 'test' command helps you validate regex patterns against strings.",
    "Thorn layer blocks destructive commands via hooks in real-time.",
    "Stem layer acts as a mandatory security gate for file operations.",
    "Pulp layer scans and redacts secrets from all outgoing logs.",
    "Redaction replaces sensitive data with markers to ensure privacy.",
];

export const ui = {
    /**
   * ◇ Title ────────────────────────────────────────────
   */
    header(title: string, type: "info" | "success" | "error" = "info") {
        const termWidth = process.stdout.columns || 80;

        // Keep section headers visually neutral (diamond).
        // Success/error state should be expressed in content rows (successMsg/warningMsg/error).
        let marker = ` ${symbols.marker} `;
        if (type === "error") marker = ` ${symbols.error} `;

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
