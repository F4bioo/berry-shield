import { BerryShieldPluginConfig } from "../types/config.js";
import { VINE_CONFIRMATION_STRATEGY, VINE_CONFIRMATION } from "../constants.js";

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
        root: true,
        vine: true,
    },
    policy: {
        profile: "balanced",
        adaptive: {
            staleAfterMinutes: 30,
            escalationTurns: 3,
            heartbeatEveryTurns: 0,
            allowGlobalEscalation: false,
        },
        retention: {
            maxEntries: 10000,
            ttlSeconds: 86400,
        },
    },
    vine: {
        mode: "balanced",
        retention: {
            maxEntries: 10000,
            ttlSeconds: 86400,
        },
        thresholds: {
            externalSignalsToEscalate: 1,
            forcedGuardTurns: 3,
        },
        toolAllowlist: [],
        confirmation: {
            strategy: VINE_CONFIRMATION_STRATEGY.ONE_TO_MANY,
            codeTtlSeconds: VINE_CONFIRMATION.TTL_SECONDS,
            maxAttempts: 3,
            windowSeconds: 120,
            maxActionsPerWindow: 3,
        },
    },
    customRules: {
        secrets: [],
        sensitiveFiles: [],
        destructiveCommands: [],
    },
    sensitiveFilePaths: [],
    destructiveCommands: []
};
