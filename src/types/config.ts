/**
 * Configuration types for Berry Shield plugin.
 */

/**
 * Layer configuration - enables/disables individual security layers.
 */
/**
 * Layer configuration - enables/disables individual security layers.
 */
export interface BerryShieldLayersConfig {
    /** Berry.Root - Prompt Guard (injects security policies) */
    root: boolean;
    /** Berry.Pulp - Output Scanner (redacts secrets/PII) */
    pulp: boolean;
    /** Berry.Thorn - Tool Blocker (blocks dangerous commands) */
    thorn: boolean;
    /** Berry.Leaf - Input Audit (logs for auditing) */
    leaf: boolean;
    /** Berry.Stem - Security Gate (tool-based checkpoint) */
    stem: boolean;
    /** Berry.Vine - External Content Guard (prompt-injection hardening) */
    vine: boolean;
}

/**
 * Adaptive profile for Berry.Root behavior.
 */
export type BerryShieldPolicyProfile =
    | "strict"
    | "balanced"
    | "minimal";

/**
 * In-memory retention controls for policy session state.
 */
export interface BerryShieldPolicyRetentionConfig {
    /** Maximum number of session entries kept in memory */
    maxEntries: number;
    /** Time-to-live in seconds for session entries */
    ttlSeconds: number;
}

/**
 * Adaptive behavior knobs for policy injection.
 */
export interface BerryShieldPolicyAdaptiveConfig {
    /** Session considered stale after this inactivity window (minutes) */
    staleAfterMinutes: number;
    /** Number of turns to force FULL policy after a risk signal */
    escalationTurns: number;
    /** Optional heartbeat cadence for reminder injections (0 disables) */
    heartbeatEveryTurns: number;
    /** Allows global escalation when session identity is missing (not recommended) */
    allowGlobalEscalation: boolean;
}

/**
 * Policy injection configuration for Berry.Root.
 */
export interface BerryShieldPolicyConfig {
    /** Adaptive profile used by new behavior */
    profile: BerryShieldPolicyProfile;
    /** Adaptive tuning values */
    adaptive: BerryShieldPolicyAdaptiveConfig;
    /** Memory limits for policy state tracking */
    retention: BerryShieldPolicyRetentionConfig;
}

/**
 * Vine operating profile for external-content guardrails.
 */
export type BerryShieldVineMode = "balanced" | "strict";

/**
 * In-memory retention controls for Vine runtime risk state.
 */
export interface BerryShieldVineRetentionConfig {
    /** Maximum number of Vine session entries kept in memory */
    maxEntries: number;
    /** Time-to-live in seconds for Vine session entries */
    ttlSeconds: number;
}

/**
 * Vine risk thresholds.
 */
export interface BerryShieldVineThresholdsConfig {
    /** Number of external signals required to escalate risk */
    externalSignalsToEscalate: number;
    /** Number of turns to keep guardrails active after escalation */
    forcedGuardTurns: number;
}

/**
 * Vine configuration.
 */
export interface BerryShieldVineConfig {
    /** Enforcement profile for unknown/external trust scenarios */
    mode: BerryShieldVineMode;
    /** Runtime retention settings */
    retention: BerryShieldVineRetentionConfig;
    /** Escalation tuning */
    thresholds: BerryShieldVineThresholdsConfig;
    /** Optional allowlist of tool names exempt from Vine escalation */
    toolAllowlist: string[];
}

/**
 * Custom secret rule stored in plugin config.
 */
export interface BerryShieldCustomSecretRule {
    name: string;
    pattern: string;
    placeholder: string;
    enabled: boolean;
}

/**
 * Custom file rule stored in plugin config.
 */
export interface BerryShieldCustomFileRule {
    name: string;
    pattern: string;
    enabled: boolean;
}

/**
 * Custom command rule stored in plugin config.
 */
export interface BerryShieldCustomCommandRule {
    name: string;
    pattern: string;
    enabled: boolean;
}

/**
 * Custom rules state in plugin config (single source for CLI/Web).
 */
export interface BerryShieldCustomRulesConfig {
    secrets: BerryShieldCustomSecretRule[];
    sensitiveFiles: BerryShieldCustomFileRule[];
    destructiveCommands: BerryShieldCustomCommandRule[];
}

/**
 * Main plugin configuration.
 */
export interface BerryShieldPluginConfig {
    /** Operation mode: enforce (block/redact) or audit (observe and log without blocking or redacting — Shadow Mode) */
    mode: "enforce" | "audit";
    /** Individual layer toggles */
    layers: BerryShieldLayersConfig;
    /** Policy injection behavior for Berry.Root */
    policy: BerryShieldPolicyConfig;
    /** External-content hardening behavior for Berry.Vine */
    vine: BerryShieldVineConfig;
    /** User-defined custom rules (single source of truth for CLI/Web) */
    customRules: BerryShieldCustomRulesConfig;
    /** Additional file path patterns to treat as sensitive (regex strings) */
    sensitiveFilePaths: string[];
    /** Additional command patterns to treat as destructive (regex strings) */
    destructiveCommands: string[];
}
