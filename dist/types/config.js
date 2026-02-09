/**
 * Configuration types for Berry Shield plugin.
 */
/**
 * Default plugin configuration.
 */
export const DEFAULT_CONFIG = {
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
export function mergeConfig(userConfig) {
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
