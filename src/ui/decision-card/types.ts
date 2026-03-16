/**
 * Decision Card contract types.
 *
 * Centralizes the shape of every security decision message
 * produced by Berry Shield, regardless of output channel
 * (tool result, hook blockReason, or TUI).
 */

/** Possible decision statuses. */
export type DecisionStatus =
    | "ALLOWED"
    | "DENIED"
    | "BLOCKED"
    | "CONFIRM_REQUIRED";

/** Layers that produce user-visible decision messages. */
export type DecisionLayer = "Stem" | "Thorn" | "Vine";

/** Confirmation challenge details (Vine flow). */
export interface ConfirmDetails {
    readonly confirmCode: string;
    readonly ttlSeconds: number;
    readonly maxAttempts: number;
    readonly strategyLabel?: "1:1" | "1:N";
    readonly windowSeconds?: number;
    readonly maxActionsPerWindow?: number;
    readonly attemptsRemaining?: number;
    readonly invalidCode?: boolean;
}

/**
 * Unified decision card produced by any Berry Shield layer.
 *
 * Every formatter consumes this shape and renders it for a
 * specific channel (plain text, ANSI terminal, etc.).
 */
export interface DecisionCard {
    readonly status: DecisionStatus;
    readonly layer?: DecisionLayer | string;
    readonly operation?: string;
    readonly target?: string;
    readonly reason?: string;
    readonly action?: string;
    readonly confirm?: ConfirmDetails;
}
