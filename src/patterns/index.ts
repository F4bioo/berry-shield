/**
 * Security patterns for detecting secrets and PII.
 *
 * These patterns are used by Berry.Pulp (Output Scanner) to identify
 * sensitive information that should be redacted from tool outputs.
 */

import * as fs from "node:fs";
import { loadCustomRules, loadCustomRulesSync, getStoragePath, type CustomRules } from "../cli/storage.js";
import { GITLEAKS_PATTERNS } from "./generated.js";

/**
 * Pattern definition with regex and replacement placeholder.
 */
export interface SecurityPattern {
    /** Name of the pattern for logging */
    name: string;
    /** Category of the pattern */
    category: "secret" | "pii";
    /** Regex pattern to match sensitive data */
    pattern: RegExp;
    /** Placeholder to replace matched content */
    placeholder: string;
}

/**
 * Secrets patterns - API keys, tokens, credentials.
 */
export const SECRET_PATTERNS: SecurityPattern[] = [
    {
        name: "AWS Access Key",
        category: "secret",
        pattern: /AKIA[0-9A-Z]{16}/g,
        placeholder: "[AWS_KEY_REDACTED]",
    },
    {
        name: "AWS Secret Key",
        category: "secret",
        pattern: /aws_secret_access_key\s*[:=]\s*[A-Za-z0-9/+=]{40}/gi,
        placeholder: "[AWS_SECRET_REDACTED]",
    },
    {
        name: "Stripe Key",
        category: "secret",
        pattern: /[sr]k[-_](?:live|test)[-_][a-zA-Z0-9]{20,}/g,
        placeholder: "[STRIPE_KEY_REDACTED]",
    },
    {
        name: "GitHub Token",
        category: "secret",
        pattern: /gh[pousr]_[a-zA-Z0-9]{36}/g,
        placeholder: "[GITHUB_TOKEN_REDACTED]",
    },
    {
        name: "GitHub PAT",
        category: "secret",
        pattern: /github_pat_[a-zA-Z0-9_]{22,}/g,
        placeholder: "[GITHUB_PAT_REDACTED]",
    },
    {
        name: "OpenAI Key",
        category: "secret",
        pattern: /sk-[a-zA-Z0-9]{20,}/g,
        placeholder: "[OPENAI_KEY_REDACTED]",
    },
    {
        name: "Anthropic Key",
        category: "secret",
        pattern: /sk-ant-[a-zA-Z0-9_-]{20,}/g,
        placeholder: "[ANTHROPIC_KEY_REDACTED]",
    },
    {
        name: "Slack Token",
        category: "secret",
        pattern: /xox[bpras]-[a-zA-Z0-9-]{10,}/g,
        placeholder: "[SLACK_TOKEN_REDACTED]",
    },
    {
        name: "SendGrid Key",
        category: "secret",
        pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g,
        placeholder: "[SENDGRID_KEY_REDACTED]",
    },
    {
        name: "NPM Token",
        category: "secret",
        pattern: /npm_[a-zA-Z0-9]{36,}/g,
        placeholder: "[NPM_TOKEN_REDACTED]",
    },
    {
        name: "Private Key",
        category: "secret",
        pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
        placeholder: "[PRIVATE_KEY_REDACTED]",
    },
    {
        name: "JWT",
        category: "secret",
        pattern: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
        placeholder: "[JWT_REDACTED]",
    },
    {
        name: "Bearer Token",
        category: "secret",
        pattern: /Authorization\s*[:=]\s*Bearer\s+[a-zA-Z0-9_.\-/+=]{20,}/gi,
        placeholder: "[BEARER_TOKEN_REDACTED]",
    },
    {
        name: "Generic API Key",
        category: "secret",
        pattern: /api[-_]?key\s*[:=]\s*[a-zA-Z0-9_.\-/+=]{20,}/gi,
        placeholder: "[API_KEY_REDACTED]",
    },
    {
        name: "Telegram Bot Token",
        category: "secret",
        pattern: /[0-9]{8,10}:[a-zA-Z0-9_-]{35,}/g,
        placeholder: "[TELEGRAM_TOKEN_REDACTED]",
    },
    {
        name: "Generic JSON Secret",
        category: "secret",
        pattern: /"(?:apiKey|token|secret|auth|password|passwd)"\s*:\s*"([^"]+)"/gi,
        placeholder: "\"key\": \"[GENERIC_SECRET_REDACTED]\"",
    },
    ...GITLEAKS_PATTERNS.map((rule) => ({
        name: rule.id,
        category: "secret" as const,
        pattern: new RegExp(rule.pattern, "g"),
        placeholder: `[${rule.id.toUpperCase().replace(/-/g, "_")}_REDACTED]`,
    })),
];

/**
 * PII patterns - Personal Identifiable Information.
 */
export const PII_PATTERNS: SecurityPattern[] = [
    {
        name: "Email",
        category: "pii",
        pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        placeholder: "[EMAIL_REDACTED]",
    },
    {
        name: "SSN (USA)",
        category: "pii",
        pattern: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
        placeholder: "[SSN_REDACTED]",
    },
    {
        name: "Credit Card",
        category: "pii",
        pattern: /\b[3-6]\d{3}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,7}\b/g,
        placeholder: "[CARD_REDACTED]",
    },
    {
        name: "US Phone",
        category: "pii",
        pattern: /\b(?:\+?1[-.\s]?)?(?:\(?[2-9]\d{2}\)?[-.\s]?)[2-9]\d{2}[-.\s]?\d{4}\b/g,
        placeholder: "[PHONE_REDACTED]",
    },
    {
        name: "International Phone",
        category: "pii",
        pattern: /(\+[2-9]\d{0,2}[-.\s]?\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4})\b/g,
        placeholder: "[PHONE_REDACTED]",
    },
    {
        name: "IBAN",
        category: "pii",
        pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}[A-Z0-9]{0,23}\b/g,
        placeholder: "[IBAN_REDACTED]",
    },
    {
        name: "CPF (Brazil)",
        category: "pii",
        pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
        placeholder: "[CPF_REDACTED]",
    },
    {
        name: "CNPJ (Brazil)",
        category: "pii",
        pattern: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g,
        placeholder: "[CNPJ_REDACTED]",
    },
];

/**
 * Sensitive file path patterns.
 */
export const SENSITIVE_FILE_PATTERNS: RegExp[] = [
    /\.env(?:\.|$)/i,
    /credentials\.json$/i,
    /\.pem$/i,
    /\.key$/i,
    /\.p12$/i,
    /\.pfx$/i,
    /id_(?:rsa|ed25519|ecdsa|dsa)/i,
    /known_hosts$/i,
    /\.ssh[\\/]config$/i,
    /\.netrc$/i,
    /\.npmrc$/i,
    /secrets?\.(?:ya?ml|json|toml)$/i,
    /\.aws[\\/]credentials$/i,
    /\.aws[\\/]config$/i,
    /\.kube[\\/]config$/i,
    /\/etc\/ssh\/ssh_host_(?:rsa|ed25519|ecdsa)_key$/i,
    /\.docker[\\/]config\.json$/i,
    /\.gnupg[\\/]private-keys-v1\.d(?:[\\/]|$)/i,
    /\.vault-token$/i,
    /\.terraform\.d[\\/]credentials\.tfrc\.json$/i,
    /\.config[\\/]rclone[\\/]rclone\.conf$/i,
    /\.config[\\/]sops[\\/]age[\\/]keys\.txt$/i,
    /\.config[\\/]age[\\/]keys\.txt$/i,
    /\.pypirc$/i,
    /\.config[\\/]gh[\\/]hosts\.yml$/i,
    /\.config[\\/]gcloud[\\/]credentials\.db$/i,
    /\.config[\\/]gcloud[\\/]access_tokens\.db$/i,
    /\.config[\\/]gcloud[\\/]legacy_credentials(?:[\\/]|$)/i,
    /\.config[\\/]azure[\\/]accessTokens\.json$/i,
    /\.config[\\/]helm[\\/]registry[\\/]config\.json$/i,
    /\.config[\\/]pypoetry[\\/]auth\.toml$/i,
    /\.local[\\/]share[\\/]keyrings(?:[\\/]|$)/i,
    /(?:^|[\\/])AppData[\\/]Roaming[\\/]Microsoft[\\/]Credentials(?:[\\/]|$)/i,
    /(?:^|[\\/])AppData[\\/]Local[\\/]Microsoft[\\/]Credentials(?:[\\/]|$)/i,
    /(?:^|[\\/])Library[\\/]Keychains(?:[\\/]|$)/i,
    /\/etc\/shadow$/i,
    /\/etc\/passwd$/i,
    /\/etc\/gshadow$/i,
    /openclaw\.json$/i,
];

/**
 * Destructive command patterns.
 */
export const DESTRUCTIVE_COMMAND_PATTERNS: RegExp[] = [
    /\b(rm|rmdir|unlink|del|format|mkfs)\b/i,
    /\bdd\s+if=/i,
];

// ============================================================================
// Async Pattern Loading & Caching
// ============================================================================

interface PatternCache {
    redactionPatterns: SecurityPattern[];
    filePatterns: RegExp[];
    commandPatterns: RegExp[];
}

// Initial cache with only built-in patterns
let _cache: PatternCache = {
    redactionPatterns: [...SECRET_PATTERNS, ...PII_PATTERNS],
    filePatterns: [...SENSITIVE_FILE_PATTERNS],
    commandPatterns: [...DESTRUCTIVE_COMMAND_PATTERNS],
};

let _watcherInitialized = false;

function compileCustomPatterns(custom: CustomRules): PatternCache {
    const customSecrets: SecurityPattern[] = custom.secrets.map(s => {
        let pattern = s.pattern;
        let flags = "gi";

        if (pattern.startsWith("(?i)")) {
            pattern = pattern.substring(4);
            flags = "gi";
        }

        try {
            return {
                name: s.name,
                category: "secret",
                pattern: new RegExp(pattern, flags),
                placeholder: s.placeholder,
            };
        } catch (e) {
            console.error(`[berry-shield] Failed to compile secret pattern '${s.name}': ${e}`);
            return null;
        }
    }).filter((r): r is SecurityPattern => r !== null);

    const customFiles = custom.sensitiveFiles.map(f => {
        try { return new RegExp(f.pattern, "i"); } catch { return null; }
    }).filter((r): r is RegExp => r !== null);

    const customCmds = custom.destructiveCommands.map(c => {
        try { return new RegExp(c.pattern, "i"); } catch { return null; }
    }).filter((r): r is RegExp => r !== null);

    return {
        redactionPatterns: [...SECRET_PATTERNS, ...customSecrets, ...PII_PATTERNS],
        filePatterns: [...SENSITIVE_FILE_PATTERNS, ...customFiles],
        commandPatterns: [...DESTRUCTIVE_COMMAND_PATTERNS, ...customCmds],
    };
}

function startPatternsWatcher(): void {
    if (process.env.NODE_ENV === "test" || _watcherInitialized) {
        return;
    }

    const rulesPath = getStoragePath();
    try {
        fs.watch(rulesPath, { persistent: false }, (eventType) => {
            if (eventType === "change" || eventType === "rename") {
                void reloadPatterns();
            }
        }).on("error", () => {
            // Ignore errors
        });
        _watcherInitialized = true;
    } catch {
        // Ignore watch setup errors
    }
}

/**
 * Initializes the pattern cache by loading custom rules from disk synchronously.
 * Skips file watching in test environment to avoid handle leaks.
 */
export function initializePatterns(): void {
    try {
        const custom = loadCustomRulesSync();
        _cache = compileCustomPatterns(custom);
    } catch (e) {
        console.error(`[berry-shield] Error initializing patterns: ${e}`);
    }

    startPatternsWatcher();
}

/**
 * Reloads patterns from disk and updates the cache.
 */
export async function reloadPatterns(): Promise<void> {
    try {
        const custom: CustomRules = await loadCustomRules();
        _cache = compileCustomPatterns(custom);
    } catch (e) {
        // If reload fails, we keep the previous cache
        console.error(`[berry-shield] Error reloading patterns: ${e}`);
    }
}

/**
 * Combines all redaction patterns (built-in + custom) into a single array.
 * Returns the cached patterns synchronously.
 */
export function getAllRedactionPatterns(): SecurityPattern[] {
    return _cache.redactionPatterns;
}

/**
 * Gets all sensitive file patterns (built-in + custom).
 */
export function getAllSensitiveFilePatterns(): RegExp[] {
    return _cache.filePatterns;
}

/**
 * Gets all destructive command patterns (built-in + custom).
 */
export function getAllDestructiveCommandPatterns(): RegExp[] {
    return _cache.commandPatterns;
}
