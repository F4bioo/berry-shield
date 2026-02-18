import { BerryShieldPluginConfig } from "../types/config.js";

/**
 * Security defaults: Safe-by-default philosophy.
 * Starts in ENFORCE mode (blocking/redacting) with all layers enabled.
 */
export const DEFAULT_CONFIG: BerryShieldPluginConfig = {
    mode: "enforce",
    layers: {
        pulp: true,
        thorn: true,
        stem: true,
        leaf: true,
        root: true
    },
    policy: {
        injectionMode: "session_full_plus_reminder",
        retention: {
            maxEntries: 10000,
            ttlSeconds: 86400,
        },
    },
    sensitiveFilePaths: [],
    destructiveCommands: []
};
