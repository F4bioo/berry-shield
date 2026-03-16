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
export const VERSION = "2026.3.16";

/** Environment variables for OpenClaw binary configuration */
export const ENV_VARS = {
    OPENCLAW_BIN: "OPENCLAW_BIN",
    OPENCLAW_EXECUTABLE: "OPENCLAW_EXECUTABLE",
};

/** Default configuration paths inside OpenClawConfig */
export const CONFIG_PATHS = {
    PLUGIN_ROOT: `plugins.entries.${PLUGIN_ID}`,
    PLUGIN_CONFIG: `plugins.entries.${PLUGIN_ID}.config`,
    POLICY_CONFIG: `plugins.entries.${PLUGIN_ID}.config.policy`,
    CUSTOM_RULES_CONFIG: `plugins.entries.${PLUGIN_ID}.config.customRules`,
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

/** Stable plugin mode values shared by config parsing, schema, and CLI validation. */
export const PLUGIN_MODE = {
    ENFORCE: "enforce",
    AUDIT: "audit",
} as const;

/** Stable policy profile values shared by config parsing, schema, and CLI validation. */
export const POLICY_PROFILE = {
    STRICT: "strict",
    BALANCED: "balanced",
    MINIMAL: "minimal",
} as const;

/** Stable Vine mode values shared by config parsing, schema, and CLI validation. */
export const VINE_MODE = {
    BALANCED: "balanced",
    STRICT: "strict",
} as const;

/** Hook names used by Berry Shield core security flows */
export const HOOKS = {
    BEFORE_AGENT_START: "before_agent_start",
    BEFORE_MESSAGE_WRITE: "before_message_write",
    MESSAGE_RECEIVED: "message_received",
    MESSAGE_SENDING: "message_sending",
    BEFORE_TOOL_CALL: "before_tool_call",
    AFTER_TOOL_CALL: "after_tool_call",
    TOOL_RESULT_PERSIST: "tool_result_persist",
    SESSION_END: "session_end",
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
const MIN_OPENCLAW_VERSION = "2026.3.12" as const;
export const COMPAT_POLICY = {
    MIN_OPENCLAW_VERSION,
    PEER_RANGE: `^${MIN_OPENCLAW_VERSION}`,
} as const;

/** Audit event decision labels used by structured logging */
export const AUDIT_DECISIONS = {
    WOULD_BLOCK: "would_block",
    WOULD_REDACT: "would_redact",
    BLOCKED: "blocked",
    REDACTED: "redacted",
    CONFIRM_REQUIRED: "confirm_required",
    WOULD_CONFIRM_REQUIRED: "would_confirm_required",
    ALLOWED_BY_CONFIRM: "allowed_by_confirm",
} as const;

/** Security layer identifiers used in audit events */
export const SECURITY_LAYERS = {
    STEM: "stem",
    PULP: "pulp",
    THORN: "thorn",
    VINE: "vine",
} as const;

/** Audit log persistence configuration */
export const AUDIT_LOG = {
    DIR: "logs/berry-shield",
    FILE: "audit.jsonl",
    FLUSH_INTERVAL_MS: 10_000,
    FLUSH_BATCH_SIZE: 20,
    MAX_BUFFER_SIZE: 200,
    MAX_FILE_SIZE: 5 * 1024 * 1024,
} as const;

/** Non-configurable Vine confirmation protocol constants. */
export const VINE_CONFIRMATION = {
    CODE_LENGTH: 4,
    CLEANUP_INTERVAL_MS: 30_000,
} as const;

/** Vine confirmation strategy */
export const VINE_CONFIRMATION_STRATEGY = {
    ONE_TO_ONE: "one_to_one",
    ONE_TO_MANY: "one_to_many",
} as const;

/** Vine confirmation strategy labels */
export const VINE_CONFIRMATION_STRATEGY_LABEL = {
    ONE_TO_ONE: "1:1",
    ONE_TO_MANY: "1:N",
} as const;

/** Preserved shared copy for approval-card UI helpers; not injected into the current native Vine runtime path. */
export const VINE_APPROVAL_INJECT = {
    TITLE: "Berry Shield",
    FIELD_STATUS: "STATUS",
    FIELD_DETAIL: "DETAIL",
    FIELD_ACTION: "ACTION",
    STATUS_SUCCESS: "SUCCESS",
    STATUS_FAILURE: "FAILURE",
    DETAIL_SUCCESS: "Confirmation accepted.",
    DETAIL_USAGE_ERROR: "Invalid input format.",
    DETAIL_INVALID_CODE: "Incorrect confirmation code.",
    DETAIL_EXPIRED_OR_MISSING: "Code expired or no pending action found.",
    DETAIL_MAX_ATTEMPTS_EXCEEDED: "Maximum confirmation attempts reached.",
    DETAIL_AMBIGUOUS: "Multiple pending approvals detected.",
    DETAIL_RESUME_FAILED: "Approval accepted but resume failed.",
    REASON_USAGE_ERROR: "Invalid command usage format.",
    REASON_INVALID_CODE: "Invalid confirmation code provided.",
    REASON_EXPIRED_OR_MISSING: "Confirmation challenge expired or no matching pending action.",
    REASON_MAX_ATTEMPTS_EXCEEDED: "Maximum confirmation attempts exceeded.",
    REASON_AMBIGUOUS: "Ambiguous confirmation request.",
    REASON_RESUME_FAILED: "Automatic resume failed after approval.",
    ACTION_USE_CODE_PREFIX: "Send a message containing this 4-digit code: ",
    ACTION_NEW_CODE: "Run the original prompt to get a new code.",
    ACTION_RETRY_ORIGINAL_PROMPT: "Run the original prompt again.",
    ACTION_RETRY_CURRENT_CODE: "Retry with a message containing the current 4-digit code.",
} as const;

/** Decision card ui defaults */
export const MAX_TARGET_LENGTH = 120;
export const DEFAULT_REASON = "Security policy violation";
