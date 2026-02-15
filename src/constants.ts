/**
 * Centralized constants for Berry Shield.
 * 
 * This file avoids hardcoding across the project and ensures architectural consistency.
 */

/** The official plugin ID used in OpenClaw config */
export const PLUGIN_ID = "berry-shield";

/** Branding symbol used in logs and UI */
export const BRAND_SYMBOL = "🍓";

/** Current project version (CalVer) */
export const VERSION = "2026.2.15";

/** Environment variables for OpenClaw binary configuration */
export const ENV_VARS = {
    OPENCLAW_BIN: "OPENCLAW_BIN",
    OPENCLAW_EXECUTABLE: "OPENCLAW_EXECUTABLE",
};

/** Default configuration paths inside OpenClawConfig */
export const CONFIG_PATHS = {
    PLUGIN_ROOT: `plugins.entries.${PLUGIN_ID}`,
    PLUGIN_CONFIG: `plugins.entries.${PLUGIN_ID}.config`,
    ENABLED: `plugins.entries.${PLUGIN_ID}.enabled`,
};

/** 
 * Sensitive keys that trigger redaction when found in object keys.
 * Exact matches (case-insensitive).
 */
export const SENSITIVE_KEY_EXACT = new Set([
    "key",
    "auth",
    "credential",
    "cred",
    "secret",
]);

/** 
 * Sensitive key suffixes that trigger redaction.
 * If a key ends with these, it will be redacted. 
 */
export const SENSITIVE_KEY_SUFFIXES = [
    "token",
    "password",
    "passwd",
    "secret",
    "apikey",
    "api_key",
    "access_key",
    "secret_key",
    "private_key",
];

/** Default behavior constants */
export const DEFAULTS = {
    BINARY_NAME: "openclaw",
    WIN_BINARY_EXT: ".cmd",
};

/** Hook names used by Berry Shield core security flows */
export const HOOKS = {
    BEFORE_AGENT_START: "before_agent_start",
    MESSAGE_RECEIVED: "message_received",
    MESSAGE_SENDING: "message_sending",
    BEFORE_TOOL_CALL: "before_tool_call",
    TOOL_RESULT_PERSIST: "tool_result_persist",
} as const;

/** Core runtime hooks required for full Berry Shield security behavior */
export const REQUIRED_SECURITY_HOOKS = [
    HOOKS.BEFORE_AGENT_START,
    HOOKS.MESSAGE_SENDING,
    HOOKS.BEFORE_TOOL_CALL,
    HOOKS.TOOL_RESULT_PERSIST,
] as const;

/** Audit-only hooks used by non-blocking observability layers */
export const AUDIT_HOOKS = [
    HOOKS.MESSAGE_RECEIVED,
] as const;

/** Compatibility policy source of truth used by automated contract tests */
export const COMPAT_POLICY = {
    MIN_OPENCLAW_VERSION: "2026.2.3-1",
    PEER_RANGE: "^2026.2.3-1",
} as const;
