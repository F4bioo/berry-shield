import { BerryShieldPluginConfig, BerryShieldLayersConfig } from "../types/config.js";
import { DEFAULT_CONFIG } from "./defaults.js";

/**
 * Merges user config with defaults.
 *
 * @param userConfig - Partial user configuration
 * @returns Complete plugin configuration
 */
export function mergeConfig(
    userConfig: Partial<BerryShieldPluginConfig> & { layers?: Partial<BerryShieldLayersConfig> }
): BerryShieldPluginConfig {
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
