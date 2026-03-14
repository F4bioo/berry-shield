/**
 * ANSI-colored decision card formatter for TUI output.
 *
 * Uses the Berry Shield theme palette for terminal rendering.
 * Only this file depends on `src/cli/ui/theme.ts`; the rest of
 * the decision-card module is channel-agnostic.
 */

import { theme, symbols } from "../../cli/ui/theme.js";
import { MAX_TARGET_LENGTH, DEFAULT_REASON } from "../../constants.js";
import type { DecisionCard, DecisionStatus } from "./types.js";

const STATUS_SYMBOL: Record<DecisionStatus, string> = {
    ALLOWED: symbols.success,
    DENIED: symbols.failure,
    BLOCKED: symbols.failure,
    CONFIRM_REQUIRED: symbols.warning,
    HUMAN_CONFIRM_REQUIRED: symbols.warning,
};

const STATUS_COLOR: Record<DecisionStatus, (text: string) => string> = {
    ALLOWED: theme.success,
    DENIED: theme.error,
    BLOCKED: theme.error,
    CONFIRM_REQUIRED: theme.warning,
    HUMAN_CONFIRM_REQUIRED: theme.warning,
};

function truncateTarget(target: string): string {
    if (target.length <= MAX_TARGET_LENGTH) {
        return target;
    }
    return `${target.substring(0, MAX_TARGET_LENGTH)}...`;
}

/**
 * Formats a DecisionCard with ANSI colors for terminal display.
 */
export function formatCardForTui(card: DecisionCard): string {
    const icon = STATUS_SYMBOL[card.status];
    const colorFn = STATUS_COLOR[card.status];
    const reason = (card.status !== "ALLOWED")
        ? (card.reason || DEFAULT_REASON)
        : undefined;

    const lines: string[] = [
        `${icon} ${theme.accentBold("Berry Shield")} ${colorFn(card.status)}`,
    ];

    if (card.operation) {
        lines.push(`   ${theme.muted("OPERATION")}  ${card.operation}`);
    }

    if (card.target) {
        lines.push(`   ${theme.muted("TARGET")}     ${truncateTarget(card.target)}`);
    }

    if (reason) {
        lines.push(`   ${theme.muted("REASON")}     ${reason}`);
    }

    if (card.confirm) {
        lines.push(`   ${theme.muted("CODE")}       ${theme.warning(card.confirm.confirmCode)}`);
        lines.push(`   ${theme.muted("TTL")}        ${card.confirm.ttlSeconds}s`);
        if (typeof card.confirm.attemptsRemaining === "number") {
            lines.push(`   ${theme.muted("ATTEMPTS")}   ${card.confirm.attemptsRemaining} remaining`);
        }
    }

    if (card.action) {
        lines.push(`   ${theme.dim(card.action)}`);
    }

    return lines.join("\n");
}
