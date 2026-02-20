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
 * Main plugin configuration.
 */
export interface BerryShieldPluginConfig {
    /** Operation mode: enforce (block/redact) or audit (observe and log without blocking or redacting — Shadow Mode) */
    mode: "enforce" | "audit";
    /** Individual layer toggles */
    layers: BerryShieldLayersConfig;
    /** Policy injection behavior for Berry.Root */
    policy: BerryShieldPolicyConfig;
    /** Additional file path patterns to treat as sensitive (regex strings) */
    sensitiveFilePaths: string[];
    /** Additional command patterns to treat as destructive (regex strings) */
    destructiveCommands: string[];
}
