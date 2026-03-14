/**
 * Plain-text decision card formatters.
 *
 * Used by tool results (berry_check) and hook blockReason.
 * No ANSI escapes — output is consumed by OpenClaw host as-is.
 */

import { BRAND_SYMBOL, MAX_TARGET_LENGTH, DEFAULT_REASON } from "../../constants.js";
import type { DecisionCard, DecisionStatus } from "./types.js";

const DEFAULT_LAYER = "Shield";

const STATUS_ICON: Record<DecisionStatus, string> = {
    ALLOWED: "✓",
    DENIED: "✗",
    BLOCKED: "✗",
    CONFIRM_REQUIRED: "!",
    HUMAN_CONFIRM_REQUIRED: "!",
};

function resolveLayer(card: DecisionCard): string {
    return card.layer || DEFAULT_LAYER;
}

function truncateTarget(target: string): string {
    if (target.length <= MAX_TARGET_LENGTH) {
        return target;
    }
    return `${target.substring(0, MAX_TARGET_LENGTH)}...`;
}

function resolveReason(card: DecisionCard): string | undefined {
    if (card.status === "ALLOWED") {
        return undefined;
    }
    return card.reason || DEFAULT_REASON;
}

/**
 * Formats a DecisionCard for tool result output (berry_check).
 *
 * Produces a multi-line plain-text block displayed inside the
 * host's collapsible tool card.
 */
export function formatCardForToolResult(card: DecisionCard): string {
    const icon = STATUS_ICON[card.status];
    const lines: string[] = [
        `${BRAND_SYMBOL} Berry Shield`,
        "",
        `STATUS: ${card.status} ${icon}`,
    ];

    if (card.operation) {
        lines.push(`OPERATION: ${card.operation}`);
    }

    if (card.target) {
        lines.push(`TARGET: ${truncateTarget(card.target)}`);
    }

    const reason = resolveReason(card);
    if (reason) {
        lines.push(`REASON: ${reason}`);
    }

    if (card.confirm) {
        lines.push(`CONFIRM_CODE: ${card.confirm.confirmCode}`);
        lines.push(`TTL_SECONDS: ${card.confirm.ttlSeconds}`);
        lines.push(`MAX_ATTEMPTS: ${card.confirm.maxAttempts}`);
        if (typeof card.confirm.attemptsRemaining === "number") {
            lines.push(`ATTEMPTS_REMAINING: ${card.confirm.attemptsRemaining}`);
        }
    }

    lines.push("");

    if (card.action) {
        lines.push(card.action);
    } else if (card.status === "ALLOWED") {
        lines.push("You may proceed with this operation.");
    } else if (card.status === "CONFIRM_REQUIRED") {
        const retryHint = card.confirm?.invalidCode
            ? `\nLast code was invalid.${typeof card.confirm.attemptsRemaining === "number" ? ` Attempts remaining: ${card.confirm.attemptsRemaining}.` : ""}`
            : "";
        lines.push(`Your session is marked as external-untrusted.`);
        lines.push(`Reply with a message containing ${card.confirm?.confirmCode ?? "****"} to proceed once.${retryHint}`);
    } else if (card.status === "HUMAN_CONFIRM_REQUIRED") {
        lines.push("Human confirmation is required before proceeding.");
    } else if (card.status === "DENIED") {
        lines.push(`This operation was denied by security policy.`);
    } else if (card.status === "BLOCKED") {
        lines.push(`This operation was blocked by runtime security hook.`);
    }

    if (card.status === "DENIED" && !card.action) {
        lines.push("Note: Berry Shield uses layered controls. A gate result and runtime hook decision may differ by context.");
    }

    return lines.join("\n");
}

/**
 * Formats a DecisionCard for hook blockReason (before_tool_call).
 *
 * Produces a compact single-purpose string that the host wraps
 * inside an error envelope ({status:'error', error: ...}).
 *
 * OpenClaw exposes `blockReason` as a plain string in the
 * `before_tool_call` hook contract. The host currently renders
 * that value through the error envelope rather than a rich card,
 * so multi-line formatting is surfaced as escaped `\n` sequences.
 * Keep this formatter single-line and compact for readability.
 */
export function formatCardForBlockReason(card: DecisionCard): string {
    const layer = resolveLayer(card);
    const reason = card.reason || DEFAULT_REASON;
    const parts: string[] = [
        `${BRAND_SYMBOL} Berry Shield`,
        `STATUS: BLOCKED ${STATUS_ICON.BLOCKED}`,
        `LAYER: ${layer}`,
    ];

    if (card.operation) {
        parts.push(`OPERATION: ${card.operation}`);
    }

    if (card.target) {
        parts.push(`TARGET: ${truncateTarget(card.target)}`);
    }

    parts.push(`REASON: ${reason}`);

    if (card.action) {
        parts.push(card.action);
    } else {
        parts.push("This operation was blocked by runtime security hook.");
        parts.push("ACTION: Request explicit user confirmation and retry via berry_check.");
    }

    return parts.join(" | ");
}
