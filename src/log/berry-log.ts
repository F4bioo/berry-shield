import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

/**
 * Central logging contract for Berry Shield.
 *
 * Keeps log categories, default levels, and prefix formatting in one place so
 * runtime logs can be rebalanced without scattering raw logger decisions
 * across layers and helpers.
 */
export const BERRY_LOG_CATEGORY = {
    // Internal layer flow trace for correlation, state transitions, and troubleshooting.
    LAYER_TRACE: "layer_trace",
    // Adaptive policy and context-injection trace for Root-like prompt decisions.
    POLICY_TRACE: "policy_trace",
    // Security-relevant runtime events such as blocking, redaction, and denied flows.
    SECURITY_EVENT: "security_event",
    // Normal Berry Shield runtime lifecycle events such as registration and disabled-layer state.
    RUNTIME_EVENT: "runtime_event",
    // Compatibility and host/runtime degradation signals that affect protection confidence.
    COMPAT_EVENT: "compat_event",
} as const;

export type BerryLogCategory =
    typeof BERRY_LOG_CATEGORY[keyof typeof BERRY_LOG_CATEGORY];

// Stable log levels used by the wrapper and category defaults.
export const BERRY_LOG_LEVEL = {
    DEBUG: "debug",
    INFO: "info",
    WARN: "warn",
    ERROR: "error",
} as const;

export type BerryLogLevel =
    typeof BERRY_LOG_LEVEL[keyof typeof BERRY_LOG_LEVEL];

// Human-readable suffixes keep operational log filters predictable.
const BERRY_LOG_SUFFIX: Record<BerryLogCategory, string> = {
    [BERRY_LOG_CATEGORY.LAYER_TRACE]: "[layer-trace]",
    [BERRY_LOG_CATEGORY.POLICY_TRACE]: "[policy-trace]",
    [BERRY_LOG_CATEGORY.SECURITY_EVENT]: "[security]",
    [BERRY_LOG_CATEGORY.RUNTIME_EVENT]: "[runtime]",
    [BERRY_LOG_CATEGORY.COMPAT_EVENT]: "[compat]",
};

// Each category chooses a sensible default without requiring call sites to care about levels.
const DEFAULT_BERRY_LOG_LEVEL: Record<BerryLogCategory, BerryLogLevel> = {
    [BERRY_LOG_CATEGORY.LAYER_TRACE]: BERRY_LOG_LEVEL.DEBUG,
    [BERRY_LOG_CATEGORY.POLICY_TRACE]: BERRY_LOG_LEVEL.DEBUG,
    [BERRY_LOG_CATEGORY.SECURITY_EVENT]: BERRY_LOG_LEVEL.WARN,
    [BERRY_LOG_CATEGORY.RUNTIME_EVENT]: BERRY_LOG_LEVEL.INFO,
    [BERRY_LOG_CATEGORY.COMPAT_EVENT]: BERRY_LOG_LEVEL.WARN,
};

type PluginLogger = OpenClawPluginApi["logger"];

// LAYER_TRACE is for internal hook/layer flow; SECURITY_EVENT is for real security decisions or effects.

// Exposes the suffix contract for tests and future formatter reuse.
export function getBerryLogSuffix(category: BerryLogCategory): string {
    return BERRY_LOG_SUFFIX[category];
}

// Exposes the default policy so categories can be reviewed without reading the dispatcher.
export function getDefaultBerryLogLevel(category: BerryLogCategory): BerryLogLevel {
    return DEFAULT_BERRY_LOG_LEVEL[category];
}

// Builds the standardized Berry Shield log prefix once for all categories.
export function formatBerryLogMessage(category: BerryLogCategory, message: string): string {
    return `[berry-shield]${getBerryLogSuffix(category)} ${message}`;
}

// Routes a typed Berry Shield log category to the underlying OpenClaw logger.
export function berryLog(
    logger: PluginLogger,
    category: BerryLogCategory,
    message: string,
    level?: BerryLogLevel
): void {
    const resolvedLevel = level ?? getDefaultBerryLogLevel(category);
    const formattedMessage = formatBerryLogMessage(category, message);

    switch (resolvedLevel) {
        case BERRY_LOG_LEVEL.DEBUG:
            logger.debug?.(formattedMessage);
            return;
        case BERRY_LOG_LEVEL.INFO:
            logger.info?.(formattedMessage);
            return;
        case BERRY_LOG_LEVEL.ERROR:
            logger.error?.(formattedMessage);
            return;
        case BERRY_LOG_LEVEL.WARN:
            logger.warn(formattedMessage);
            return;
        default:
            logger.debug?.(formattedMessage);
            return;
    }
}
