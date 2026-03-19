/**
 * Security patterns for detecting secrets and PII.
 *
 * These patterns are used by Berry.Pulp (Output Scanner) to identify
 * sensitive information that should be redacted from tool outputs.
 */

import type { BerryShieldCustomRulesConfig } from "../types/config.js";
import { GITLEAKS_PATTERNS } from "./generated.js";
import { PREFIXES, CATEGORIES } from "./constants.js";
export { 
    INTERNAL_SECRET_PATTERNS, 
    INTERNAL_PII_PATTERNS,
    INTERNAL_SENSITIVE_FILE_PATTERNS,
    INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS
} from "./extended.js";

import { 
    INTERNAL_SECRET_PATTERNS as _SECRET, 
    INTERNAL_PII_PATTERNS as _PII,
    INTERNAL_SENSITIVE_FILE_PATTERNS as _FILES,
    INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS as _COMMAND
} from "./extended.js";
    
/**
 * Pattern definition with regex and replacement placeholder.
 */
export interface SecurityPattern {
    id: string;
    /** Name of the pattern for logging */
    name: string;
    /** Category of the pattern */
    category: "secret" | "pii" | "file" | "command";
    /** Regex pattern to match sensitive data */
    pattern: RegExp;
    /** Placeholder to replace matched content. If not provided, one will be generated from ID. */
    placeholder?: string;
    /** If true, includes a deterministic session-salted hash in the placeholder. */
    includeHash?: boolean;
    
    // Context-awareness fields for reducing false positives
    /** 
     * If true, pattern requires contextual validation before redaction.
     * Match will only be redacted if at least one contextWord appears within contextWindow.
     */
    isContextRequired?: boolean;
    /** 
     * Keywords that must appear near the match to validate it.
     * Used when isContextRequired is true. Case-insensitive matching.
     */
    contextWords?: string[];
    /** 
     * Character window size for context search (measured in characters, not words).
     * Defines how far to look before/after the match for contextWords.
     * Default: { before: 30, after: 15 }
     */
    contextWindow?: {
        /** Number of characters to search BEFORE the match */
        before: number;
        /** Number of characters to search AFTER the match */
        after: number;
    };
}

/**
 * Secrets patterns - API keys, tokens, credentials.
 */
export const SECRET_PATTERNS: SecurityPattern[] = [
    ..._SECRET,
    ...GITLEAKS_PATTERNS.map((entry) => ({
       id: `${PREFIXES.GITLEAKS_SECRET}:${entry.id.toLowerCase()}`,
       name: entry.id,
       category: CATEGORIES.SECRET,
       pattern: new RegExp(entry.pattern, "g"),
       placeholder: `[${entry.id.toUpperCase().replace(/-/g, "_")}_REDACTED]`,
    })),
];

/**
 * PII patterns - Personal Identifiable Information.
 */
export const PII_PATTERNS: SecurityPattern[] = [
    ..._PII,
];

export const SENSITIVE_FILE_PATTERNS: RegExp[] = [
    ..._FILES.map((entry) => (
        entry.pattern
    )),
];

export const DESTRUCTIVE_COMMAND_PATTERNS: RegExp[] = [
    ..._COMMAND.map((entry) => (
        entry.pattern
    )),
];

// ============================================================================
// Async Pattern Loading & Caching
// ============================================================================

interface PatternCache {
    redactionPatterns: SecurityPattern[];
    filePatterns: RegExp[];
    commandPatterns: RegExp[];
}

// Initial cache with only built-in patterns
let _cache: PatternCache = {
    redactionPatterns: [...SECRET_PATTERNS, ...PII_PATTERNS, ..._COMMAND, ..._FILES],
    filePatterns: [...SENSITIVE_FILE_PATTERNS],
    commandPatterns: [...DESTRUCTIVE_COMMAND_PATTERNS],
};

function compileCustomPatterns(
    customRules: BerryShieldCustomRulesConfig,
    disabledBuiltInIds: readonly string[]
): PatternCache {
    const disabledIds = new Set(disabledBuiltInIds.map(id => id.toLowerCase()));

    const customSecrets: SecurityPattern[] = customRules.secrets
    .filter((s) => s.enabled !== false)
    .map(s => {
        let pattern = s.pattern;
        let flags = "gi";

        if (pattern.startsWith("(?i)")) {
            pattern = pattern.substring(4);
            flags = "gi";
        }

        try {
            return {
                id: `custom:secret:${s.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
                name: s.name,
                category: "secret",
                pattern: new RegExp(pattern, flags),
                placeholder: s.placeholder,
            } as SecurityPattern;
        } catch (e) {
            console.error(`[berry-shield] Failed to compile secret pattern '${s.name}': ${e}`);
            return null;
        }
    }).filter((r): r is SecurityPattern => r !== null);

    const customFiles = customRules.sensitiveFiles
    .filter((f) => f.enabled !== false)
    .map(f => {
        try { return new RegExp(f.pattern, "i"); } catch { return null; }
    }).filter((r): r is RegExp => r !== null);

    const customCmds = customRules.destructiveCommands
    .filter((c) => c.enabled !== false)
    .map(c => {
        try { return new RegExp(c.pattern, "i"); } catch { return null; }
    }).filter((r): r is RegExp => r !== null);

    const activeSecrets = SECRET_PATTERNS.filter(p => !disabledIds.has(p.id));
    const activePII = PII_PATTERNS.filter(p => !disabledIds.has(p.id));
    const activeFiles = _FILES.filter(p => !disabledIds.has(p.id)).map(p => p.pattern);
    const activeCmds = _COMMAND.filter(p => !disabledIds.has(p.id)).map(p => p.pattern);

    return {
        redactionPatterns: [
            ...activeSecrets, 
            ...customSecrets, 
            ...activePII, 
            ..._COMMAND.filter(p => !disabledIds.has(p.id)),
            ..._FILES.filter(p => !disabledIds.has(p.id))
        ],
        filePatterns: [...activeFiles, ...customFiles],
        commandPatterns: [...activeCmds, ...customCmds],
    };
}

/**
 * Initializes the pattern cache from effective plugin config.
 */
export function initializePatterns(
    customRules?: BerryShieldCustomRulesConfig,
    disabledBuiltInIds: readonly string[] = []
): void {
    try {
        const effectiveCustomRules: BerryShieldCustomRulesConfig = customRules ?? {
            secrets: [],
            sensitiveFiles: [],
            destructiveCommands: [],
        };
        _cache = compileCustomPatterns(effectiveCustomRules, disabledBuiltInIds);
    } catch (e) {
        console.error(`[berry-shield] Error initializing patterns: ${e}`);
    }
}

/**
 * Reloads pattern cache from updated effective plugin config.
 */
export function reloadPatterns(
    customRules?: BerryShieldCustomRulesConfig,
    disabledBuiltInIds: readonly string[] = []
): void {
    try {
        const effectiveCustomRules: BerryShieldCustomRulesConfig = customRules ?? {
            secrets: [],
            sensitiveFiles: [],
            destructiveCommands: [],
        };
        _cache = compileCustomPatterns(effectiveCustomRules, disabledBuiltInIds);
    } catch (e) {
        // If reload fails, we keep the previous cache
        console.error(`[berry-shield] Error reloading patterns: ${e}`);
    }
}

/**
 * Combines all redaction patterns (built-in + custom) into a single array.
 * Returns the cached patterns synchronously.
 */
export function getAllRedactionPatterns(): SecurityPattern[] {
    return _cache.redactionPatterns;
}

/**
 * Gets all sensitive file patterns (built-in + custom).
 */
export function getAllSensitiveFilePatterns(): RegExp[] {
    return _cache.filePatterns;
}

/**
 * Gets all destructive command patterns (built-in + custom).
 */
export function getAllDestructiveCommandPatterns(): RegExp[] {
    return _cache.commandPatterns;
}

