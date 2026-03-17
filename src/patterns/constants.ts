/**
 * Pattern Governance Constants.
 * 
 * This module defines the canonical namespaces and structural contracts
 * for security patterns within Berry Shield. It prevents ID collisions
 * and ensures deterministic categorization across the scanning engine.
 */

/**
 * Canonical namespace identifiers.
 * 
 * Used to distinguish the origin and authority of security patterns.
 */
export const NAMESPACES = {
    /** Native Berry Shield logic and core patterns */
    BERRY: "berry",
    /** Automated community patterns sourced from Gitleaks baseline */
    GITLEAKS: "gitleaks",
} as const;

/**
 * Pattern classification categories.
 * 
 * Defines the functional bucket for a pattern within the scanner.
 */
export const CATEGORIES = {
    SECRET: "secret",
    PII: "pii",
    FILE: "file",
    COMMAND: "command",
} as const;

/**
 * Pre-composed prefixes for common pattern IDs.
 * Use these to avoid repetitive template literals.
 */
export const PREFIXES = {
    BERRY_SECRET: `${NAMESPACES.BERRY}:${CATEGORIES.SECRET}`,
    GITLEAKS_SECRET: `${NAMESPACES.GITLEAKS}:${CATEGORIES.SECRET}`,
    BERRY_PII: `${NAMESPACES.BERRY}:${CATEGORIES.PII}`,
    BERRY_FILE: `${NAMESPACES.BERRY}:${CATEGORIES.FILE}`,
    BERRY_COMMAND: `${NAMESPACES.BERRY}:${CATEGORIES.COMMAND}`,
} as const;
