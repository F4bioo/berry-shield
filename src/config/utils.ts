import { BerryShieldPluginConfig, BerryShieldLayersConfig } from "../types/config.js";
import { DEFAULT_CONFIG } from "./defaults.js";

/**
 * Merges user config with defaults.
 *
 * @param userConfig - Partial user configuration
 * @returns Complete plugin configuration
 */
export function mergeConfig(userConfig: unknown): BerryShieldPluginConfig {
    // If config is not an object, return defaults
    if (typeof userConfig !== "object" || userConfig === null) {
        return DEFAULT_CONFIG;
    }

    const config = userConfig as Record<string, unknown>;

    // Normalize layer keys to lowercase to support case-insensitive config
    const rawLayers = (config.layers && typeof config.layers === "object")
        ? (config.layers as Record<string, unknown>)
        : {};

    const normalizedLayers: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(rawLayers)) {
        if (typeof value === "boolean") {
            normalizedLayers[key.toLowerCase()] = value;
        }
    }

    const mode = (config.mode === "enforce" || config.mode === "audit")
        ? (config.mode as "enforce" | "audit")
        : DEFAULT_CONFIG.mode;

    const sensitiveFilePaths = Array.isArray(config.sensitiveFilePaths)
        ? config.sensitiveFilePaths.filter((p): p is string => typeof p === "string")
        : DEFAULT_CONFIG.sensitiveFilePaths;

    const destructiveCommands = Array.isArray(config.destructiveCommands)
        ? config.destructiveCommands.filter((c): c is string => typeof c === "string")
        : DEFAULT_CONFIG.destructiveCommands;

    return {
        mode,
        layers: {
            root: normalizedLayers.root ?? DEFAULT_CONFIG.layers.root,
            pulp: normalizedLayers.pulp ?? DEFAULT_CONFIG.layers.pulp,
            thorn: normalizedLayers.thorn ?? DEFAULT_CONFIG.layers.thorn,
            leaf: normalizedLayers.leaf ?? DEFAULT_CONFIG.layers.leaf,
            stem: normalizedLayers.stem ?? DEFAULT_CONFIG.layers.stem,
        },
        sensitiveFilePaths,
        destructiveCommands,
    };
}
