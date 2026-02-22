import {
    BerryShieldPluginConfig,
    BerryShieldPolicyProfile,
    BerryShieldCustomRulesConfig,
    BerryShieldVineMode,
} from "../types/config.js";
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

    const rawCustomRules = (config.customRules && typeof config.customRules === "object")
        ? (config.customRules as Record<string, unknown>)
        : {};

    const customSecrets = Array.isArray(rawCustomRules.secrets)
        ? rawCustomRules.secrets
            .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
            .filter((entry) =>
                typeof entry.name === "string"
                && typeof entry.pattern === "string"
                && typeof entry.placeholder === "string"
            )
            .map((entry) => ({
                name: entry.name as string,
                pattern: entry.pattern as string,
                placeholder: entry.placeholder as string,
            }))
        : DEFAULT_CONFIG.customRules.secrets;

    const customSensitiveFiles = Array.isArray(rawCustomRules.sensitiveFiles)
        ? rawCustomRules.sensitiveFiles
            .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
            .filter((entry) => typeof entry.pattern === "string")
            .map((entry) => ({
                pattern: entry.pattern as string,
            }))
        : DEFAULT_CONFIG.customRules.sensitiveFiles;

    const customDestructiveCommands = Array.isArray(rawCustomRules.destructiveCommands)
        ? rawCustomRules.destructiveCommands
            .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
            .filter((entry) => typeof entry.pattern === "string")
            .map((entry) => ({
                pattern: entry.pattern as string,
            }))
        : DEFAULT_CONFIG.customRules.destructiveCommands;

    const customRules: BerryShieldCustomRulesConfig = {
        secrets: customSecrets,
        sensitiveFiles: customSensitiveFiles,
        destructiveCommands: customDestructiveCommands,
    };

    const fallbackSensitiveFiles = customRules.sensitiveFiles.length > 0
        ? customRules.sensitiveFiles.map((rule) => rule.pattern)
        : sensitiveFilePaths;

    const fallbackDestructiveCommands = customRules.destructiveCommands.length > 0
        ? customRules.destructiveCommands.map((rule) => rule.pattern)
        : destructiveCommands;

    const rawPolicy = (config.policy && typeof config.policy === "object")
        ? (config.policy as Record<string, unknown>)
        : {};

    const rawRetention = (rawPolicy.retention && typeof rawPolicy.retention === "object")
        ? (rawPolicy.retention as Record<string, unknown>)
        : {};

    const profile = (
        rawPolicy.profile === "strict"
        || rawPolicy.profile === "balanced"
        || rawPolicy.profile === "minimal"
    )
        ? rawPolicy.profile as BerryShieldPolicyProfile
        : DEFAULT_CONFIG.policy.profile;

    const maxEntries = (typeof rawRetention.maxEntries === "number" && Number.isFinite(rawRetention.maxEntries) && rawRetention.maxEntries > 0)
        ? Math.floor(rawRetention.maxEntries)
        : DEFAULT_CONFIG.policy.retention.maxEntries;

    const ttlSeconds = (typeof rawRetention.ttlSeconds === "number" && Number.isFinite(rawRetention.ttlSeconds) && rawRetention.ttlSeconds > 0)
        ? Math.floor(rawRetention.ttlSeconds)
        : DEFAULT_CONFIG.policy.retention.ttlSeconds;

    const rawAdaptive = (rawPolicy.adaptive && typeof rawPolicy.adaptive === "object")
        ? (rawPolicy.adaptive as Record<string, unknown>)
        : {};

    const staleAfterMinutes = (typeof rawAdaptive.staleAfterMinutes === "number" && Number.isFinite(rawAdaptive.staleAfterMinutes) && rawAdaptive.staleAfterMinutes > 0)
        ? Math.floor(rawAdaptive.staleAfterMinutes)
        : DEFAULT_CONFIG.policy.adaptive.staleAfterMinutes;

    const escalationTurns = (typeof rawAdaptive.escalationTurns === "number" && Number.isFinite(rawAdaptive.escalationTurns) && rawAdaptive.escalationTurns > 0)
        ? Math.floor(rawAdaptive.escalationTurns)
        : DEFAULT_CONFIG.policy.adaptive.escalationTurns;

    const heartbeatEveryTurns = (typeof rawAdaptive.heartbeatEveryTurns === "number" && Number.isFinite(rawAdaptive.heartbeatEveryTurns) && rawAdaptive.heartbeatEveryTurns >= 0)
        ? Math.floor(rawAdaptive.heartbeatEveryTurns)
        : DEFAULT_CONFIG.policy.adaptive.heartbeatEveryTurns;

    const allowGlobalEscalation = typeof rawAdaptive.allowGlobalEscalation === "boolean"
        ? rawAdaptive.allowGlobalEscalation
        : DEFAULT_CONFIG.policy.adaptive.allowGlobalEscalation;

    const rawVine = (config.vine && typeof config.vine === "object")
        ? (config.vine as Record<string, unknown>)
        : {};

    const vineMode = (
        rawVine.mode === "balanced"
        || rawVine.mode === "strict"
    )
        ? rawVine.mode as BerryShieldVineMode
        : DEFAULT_CONFIG.vine.mode;

    const rawVineRetention = (rawVine.retention && typeof rawVine.retention === "object")
        ? (rawVine.retention as Record<string, unknown>)
        : {};

    const vineMaxEntries = (typeof rawVineRetention.maxEntries === "number" && Number.isFinite(rawVineRetention.maxEntries) && rawVineRetention.maxEntries > 0)
        ? Math.floor(rawVineRetention.maxEntries)
        : DEFAULT_CONFIG.vine.retention.maxEntries;

    const vineTtlSeconds = (typeof rawVineRetention.ttlSeconds === "number" && Number.isFinite(rawVineRetention.ttlSeconds) && rawVineRetention.ttlSeconds > 0)
        ? Math.floor(rawVineRetention.ttlSeconds)
        : DEFAULT_CONFIG.vine.retention.ttlSeconds;

    const rawVineThresholds = (rawVine.thresholds && typeof rawVine.thresholds === "object")
        ? (rawVine.thresholds as Record<string, unknown>)
        : {};

    const externalSignalsToEscalate = (typeof rawVineThresholds.externalSignalsToEscalate === "number"
        && Number.isFinite(rawVineThresholds.externalSignalsToEscalate)
        && rawVineThresholds.externalSignalsToEscalate > 0)
        ? Math.floor(rawVineThresholds.externalSignalsToEscalate)
        : DEFAULT_CONFIG.vine.thresholds.externalSignalsToEscalate;

    const forcedGuardTurns = (typeof rawVineThresholds.forcedGuardTurns === "number"
        && Number.isFinite(rawVineThresholds.forcedGuardTurns)
        && rawVineThresholds.forcedGuardTurns > 0)
        ? Math.floor(rawVineThresholds.forcedGuardTurns)
        : DEFAULT_CONFIG.vine.thresholds.forcedGuardTurns;

    const toolAllowlist = Array.isArray(rawVine.toolAllowlist)
        ? rawVine.toolAllowlist.filter((name): name is string => typeof name === "string")
        : DEFAULT_CONFIG.vine.toolAllowlist;

    return {
        mode,
        layers: {
            root: normalizedLayers.root ?? DEFAULT_CONFIG.layers.root,
            pulp: normalizedLayers.pulp ?? DEFAULT_CONFIG.layers.pulp,
            thorn: normalizedLayers.thorn ?? DEFAULT_CONFIG.layers.thorn,
            leaf: normalizedLayers.leaf ?? DEFAULT_CONFIG.layers.leaf,
            stem: normalizedLayers.stem ?? DEFAULT_CONFIG.layers.stem,
            vine: normalizedLayers.vine ?? DEFAULT_CONFIG.layers.vine,
        },
        policy: {
            profile,
            adaptive: {
                staleAfterMinutes,
                escalationTurns,
                heartbeatEveryTurns,
                allowGlobalEscalation,
            },
            retention: {
                maxEntries,
                ttlSeconds,
            },
        },
        vine: {
            mode: vineMode,
            retention: {
                maxEntries: vineMaxEntries,
                ttlSeconds: vineTtlSeconds,
            },
            thresholds: {
                externalSignalsToEscalate,
                forcedGuardTurns,
            },
            toolAllowlist,
        },
        customRules,
        sensitiveFilePaths: fallbackSensitiveFiles,
        destructiveCommands: fallbackDestructiveCommands,
    };
}
