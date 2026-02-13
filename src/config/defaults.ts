import { BerryShieldPluginConfig } from "../types/config.js";

/**
 * Security defaults: Safe-by-default philosophy.
 * Starts in AUDIT mode (log only) with all layers enabled for visibility.
 */
export const DEFAULT_CONFIG: BerryShieldPluginConfig = {
    mode: "audit",
    layers: {
        pulp: true,
        thorn: true,
        stem: true,
        leaf: true,
        root: true
    },
    sensitiveFilePaths: [],
    destructiveCommands: []
};
