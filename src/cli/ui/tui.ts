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

        let marker = ` ${symbols.marker} `;
        if (type === "success") marker = ` ${symbols.success} `;
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
     * Error message with the same style
     */
    error(message: string) {
        console.log(`\n   ${symbols.brand} ${theme.error("Error:")} ${message}\n`);
    }
};
