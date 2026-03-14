/**
 * Policy card contract types.
 *
 * Centralizes XML-like policy payloads injected into the host prompt context.
 * These are not user-facing decision cards; they are machine-oriented policy blocks.
 */

/** Stable policy payload variants used by Berry Shield layers. */
export const POLICY_CARD_KIND = {
    SESSION_START: "SESSION_START",
    SESSION_REMINDER: "SESSION_REMINDER",
    SESSION_EXTERNAL: "SESSION_EXTERNAL",
} as const;

export type PolicyCardType =
    typeof POLICY_CARD_KIND[keyof typeof POLICY_CARD_KIND];
