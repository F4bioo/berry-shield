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
 * Main plugin configuration.
 */
export interface BerryShieldPluginConfig {
    /** Operation mode: enforce (block/redact) or audit (log only) */
    mode: "enforce" | "audit";
    /** Individual layer toggles */
    layers: BerryShieldLayersConfig;
    /** Additional file path patterns to treat as sensitive (regex strings) */
    sensitiveFilePaths: string[];
    /** Additional command patterns to treat as destructive (regex strings) */
    destructiveCommands: string[];
}
