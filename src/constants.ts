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
export const VERSION = "2026.2.12";

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
