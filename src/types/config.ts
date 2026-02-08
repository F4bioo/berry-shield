/**
 * Configuration types for Berry Shield plugin.
 */

/**
 * Layer configuration - enables/disables individual security layers.
 */
export interface LayersConfig {
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
export interface PluginConfig {
    /** Operation mode: enforce (block/redact) or audit (log only) */
    mode: "enforce" | "audit";
    /** Individual layer toggles */
    layers: LayersConfig;
    /** Additional file path patterns to treat as sensitive (regex strings) */
    sensitiveFilePaths: string[];
    /** Additional command patterns to treat as destructive (regex strings) */
    destructiveCommands: string[];
}

/**
 * Default plugin configuration.
 */
export const DEFAULT_CONFIG: PluginConfig = {
    mode: "enforce",
    layers: {
        root: true,
        pulp: true,
        thorn: true,
        leaf: true,
        stem: true,
    },
    sensitiveFilePaths: [],
    destructiveCommands: [],
};

/**
 * Merges user config with defaults.
 *
 * @param userConfig - Partial user configuration
 * @returns Complete plugin configuration
 */
export function mergeConfig(
    userConfig: Partial<PluginConfig> & { layers?: Partial<LayersConfig> }
): PluginConfig {
    return {
        mode: userConfig.mode ?? DEFAULT_CONFIG.mode,
        layers: {
            root: userConfig.layers?.root ?? DEFAULT_CONFIG.layers.root,
            pulp: userConfig.layers?.pulp ?? DEFAULT_CONFIG.layers.pulp,
            thorn: userConfig.layers?.thorn ?? DEFAULT_CONFIG.layers.thorn,
            leaf: userConfig.layers?.leaf ?? DEFAULT_CONFIG.layers.leaf,
            stem: userConfig.layers?.stem ?? DEFAULT_CONFIG.layers.stem,
        },
        sensitiveFilePaths: userConfig.sensitiveFilePaths ?? DEFAULT_CONFIG.sensitiveFilePaths,
        destructiveCommands: userConfig.destructiveCommands ?? DEFAULT_CONFIG.destructiveCommands,
    };
}
