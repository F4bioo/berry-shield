/**
 * Security patterns for detecting secrets and PII.
 *
 * These patterns are used by Berry.Pulp (Output Scanner) to identify
 * sensitive information that should be redacted from tool outputs.
 */

import type { BerryShieldCustomRulesConfig } from "../types/config.js";
import { GITLEAKS_PATTERNS } from "./generated.js";

/**
 * Pattern definition with regex and replacement placeholder.
 */
export interface SecurityPattern {
    id: string;
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
        id: "secret:aws-access-key",
        name: "AWS Access Key",
        category: "secret",
        pattern: /AKIA[0-9A-Z]{16}/g,
        placeholder: "[AWS_KEY_REDACTED]",
    },
    {
        id: "secret:aws-secret-key",
        name: "AWS Secret Key",
        category: "secret",
        pattern: /aws_secret_access_key\s*[:=]\s*[A-Za-z0-9/+=]{40}/gi,
        placeholder: "[AWS_SECRET_REDACTED]",
    },
    {
        id: "secret:stripe-key",
        name: "Stripe Key",
        category: "secret",
        pattern: /[sr]k[-_](?:live|test)[-_][a-zA-Z0-9]{20,}/g,
        placeholder: "[STRIPE_KEY_REDACTED]",
    },
    {
        id: "secret:github-token",
        name: "GitHub Token",
        category: "secret",
        pattern: /gh[pousr]_[a-zA-Z0-9]{36}/g,
        placeholder: "[GITHUB_TOKEN_REDACTED]",
    },
    {
        id: "secret:github-pat",
        name: "GitHub PAT",
        category: "secret",
        pattern: /github_pat_[a-zA-Z0-9_]{22,}/g,
        placeholder: "[GITHUB_PAT_REDACTED]",
    },
    {
        id: "secret:openai-key",
        name: "OpenAI Key",
        category: "secret",
        pattern: /sk-[a-zA-Z0-9]{20,}/g,
        placeholder: "[OPENAI_KEY_REDACTED]",
    },
    {
        id: "secret:anthropic-key",
        name: "Anthropic Key",
        category: "secret",
        pattern: /sk-ant-[a-zA-Z0-9_-]{20,}/g,
        placeholder: "[ANTHROPIC_KEY_REDACTED]",
    },
    {
        id: "secret:slack-token",
        name: "Slack Token",
        category: "secret",
        pattern: /xox[bpras]-[a-zA-Z0-9-]{10,}/g,
        placeholder: "[SLACK_TOKEN_REDACTED]",
    },
    {
        id: "secret:sendgrid-key",
        name: "SendGrid Key",
        category: "secret",
        pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g,
        placeholder: "[SENDGRID_KEY_REDACTED]",
    },
    {
        id: "secret:npm-token",
        name: "NPM Token",
        category: "secret",
        pattern: /npm_[a-zA-Z0-9]{36,}/g,
        placeholder: "[NPM_TOKEN_REDACTED]",
    },
    {
        id: "secret:private-key",
        name: "Private Key",
        category: "secret",
        pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
        placeholder: "[PRIVATE_KEY_REDACTED]",
    },
    {
        id: "secret:jwt",
        name: "JWT",
        category: "secret",
        pattern: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
        placeholder: "[JWT_REDACTED]",
    },
    {
        id: "secret:bearer-token",
        name: "Bearer Token",
        category: "secret",
        pattern: /Authorization\s*[:=]\s*Bearer\s+[a-zA-Z0-9_.\-/+=]{20,}/gi,
        placeholder: "[BEARER_TOKEN_REDACTED]",
    },
    {
        id: "secret:generic-api-key",
        name: "Generic API Key",
        category: "secret",
        pattern: /api[-_]?key\s*[:=]\s*[a-zA-Z0-9_.\-/+=]{20,}/gi,
        placeholder: "[API_KEY_REDACTED]",
    },
    {
        id: "secret:telegram-bot-token",
        name: "Telegram Bot Token",
        category: "secret",
        pattern: /[0-9]{8,10}:[a-zA-Z0-9_-]{35,}/g,
        placeholder: "[TELEGRAM_TOKEN_REDACTED]",
    },
    {
        id: "secret:generic-json-secret",
        name: "Generic JSON Secret",
        category: "secret",
        pattern: /"(?:apiKey|token|secret|auth|password|passwd)"\s*:\s*"([^"]+)"/gi,
        placeholder: "\"key\": \"[GENERIC_SECRET_REDACTED]\"",
    },
    ...GITLEAKS_PATTERNS.map((rule) => ({
        id: `secret:gitleaks:${rule.id.toLowerCase()}`,
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
        id: "pii:email",
        name: "Email",
        category: "pii",
        pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        placeholder: "[EMAIL_REDACTED]",
    },
    {
        id: "pii:ssn-us",
        name: "SSN (USA)",
        category: "pii",
        pattern: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
        placeholder: "[SSN_REDACTED]",
    },
    {
        id: "pii:credit-card",
        name: "Credit Card",
        category: "pii",
        pattern: /\b[3-6]\d{3}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,7}\b/g,
        placeholder: "[CARD_REDACTED]",
    },
    {
        id: "pii:phone-us",
        name: "US Phone",
        category: "pii",
        pattern: /\b(?:\+?1[-.\s]?)?(?:\(?[2-9]\d{2}\)?[-.\s]?)[2-9]\d{2}[-.\s]?\d{4}\b/g,
        placeholder: "[PHONE_REDACTED]",
    },
    {
        id: "pii:phone-intl",
        name: "International Phone",
        category: "pii",
        pattern: /(\+[2-9]\d{0,2}[-.\s]?\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4})\b/g,
        placeholder: "[PHONE_REDACTED]",
    },
    {
        id: "pii:iban",
        name: "IBAN",
        category: "pii",
        pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}[A-Z0-9]{0,23}\b/g,
        placeholder: "[IBAN_REDACTED]",
    },
    {
        id: "pii:cpf-br",
        name: "CPF (Brazil)",
        category: "pii",
        pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
        placeholder: "[CPF_REDACTED]",
    },
    {
        id: "pii:cnpj-br",
        name: "CNPJ (Brazil)",
        category: "pii",
        pattern: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g,
        placeholder: "[CNPJ_REDACTED]",
    },
];

/**
 * Sensitive file path patterns logic.
 * INTERNAL_SENSITIVE_FILE_PATTERNS keeps track of stable IDs for CLI overrides.
 * SENSITIVE_FILE_PATTERNS remains a RegExp[] for backwards compatibility.
 */
export const INTERNAL_SENSITIVE_FILE_PATTERNS = [
    { id: "file:env", pattern: /\.env(?:\.|$)/i },
    { id: "file:credentials-json", pattern: /credentials\.json$/i },
    { id: "file:pem", pattern: /\.pem$/i },
    { id: "file:key", pattern: /\.key$/i },
    { id: "file:p12", pattern: /\.p12$/i },
    { id: "file:pfx", pattern: /\.pfx$/i },
    { id: "file:ssh-private-keys", pattern: /id_(?:rsa|ed25519|ecdsa|dsa)/i },
    { id: "file:ssh-known-hosts", pattern: /known_hosts$/i },
    { id: "file:ssh-config", pattern: /\.ssh[\\/]config$/i },
    { id: "file:netrc", pattern: /\.netrc$/i },
    { id: "file:npmrc", pattern: /\.npmrc$/i },
    { id: "file:secret-files", pattern: /secrets?\.(?:ya?ml|json|toml)$/i },
    { id: "file:aws-credentials", pattern: /\.aws[\\/]credentials$/i },
    { id: "file:aws-config", pattern: /\.aws[\\/]config$/i },
    { id: "file:kube-config", pattern: /\.kube[\\/]config$/i },
    { id: "file:ssh-host-keys", pattern: /\/etc\/ssh\/ssh_host_(?:rsa|ed25519|ecdsa)_key$/i },
    { id: "file:docker-config", pattern: /\.docker[\\/]config\.json$/i },
    { id: "file:gnupg-keys", pattern: /\.gnupg[\\/]private-keys-v1\.d(?:[\\/]|$)/i },
    { id: "file:vault-token", pattern: /\.vault-token$/i },
    { id: "file:terraform-credentials", pattern: /\.terraform\.d[\\/]credentials\.tfrc\.json$/i },
    { id: "file:rclone-conf", pattern: /\.config[\\/]rclone[\\/]rclone\.conf$/i },
    { id: "file:sops-age-keys", pattern: /\.config[\\/]sops[\\/]age[\\/]keys\.txt$/i },
    { id: "file:age-keys", pattern: /\.config[\\/]age[\\/]keys\.txt$/i },
    { id: "file:pypirc", pattern: /\.pypirc$/i },
    { id: "file:gh-hosts", pattern: /\.config[\\/]gh[\\/]hosts\.yml$/i },
    { id: "file:gcloud-credentials-db", pattern: /\.config[\\/]gcloud[\\/]credentials\.db$/i },
    { id: "file:gcloud-access-tokens", pattern: /\.config[\\/]gcloud[\\/]access_tokens\.db$/i },
    { id: "file:gcloud-legacy-credentials", pattern: /\.config[\\/]gcloud[\\/]legacy_credentials(?:[\\/]|$)/i },
    { id: "file:azure-access-tokens", pattern: /\.config[\\/]azure[\\/]accessTokens\.json$/i },
    { id: "file:helm-registry-config", pattern: /\.config[\\/]helm[\\/]registry[\\/]config\.json$/i },
    { id: "file:poetry-auth", pattern: /\.config[\\/]pypoetry[\\/]auth\.toml$/i },
    { id: "file:linux-keyrings", pattern: /\.local[\\/]share[\\/]keyrings(?:[\\/]|$)/i },
    { id: "file:windows-roaming-credentials", pattern: /(?:^|[\\/])AppData[\\/]Roaming[\\/]Microsoft[\\/]Credentials(?:[\\/]|$)/i },
    { id: "file:windows-local-credentials", pattern: /(?:^|[\\/])AppData[\\/]Local[\\/]Microsoft[\\/]Credentials(?:[\\/]|$)/i },
    { id: "file:mac-keychains", pattern: /(?:^|[\\/])Library[\\/]Keychains(?:[\\/]|$)/i },
    { id: "file:linux-shadow", pattern: /\/etc\/shadow$/i },
    { id: "file:linux-passwd", pattern: /\/etc\/passwd$/i },
    { id: "file:linux-gshadow", pattern: /\/etc\/gshadow$/i },
    { id: "file:openclaw-json", pattern: /openclaw\.json$/i },
];

export const SENSITIVE_FILE_PATTERNS: RegExp[] = INTERNAL_SENSITIVE_FILE_PATTERNS.map((p) => p.pattern);

/**
 * Destructive command patterns logic.
 */
export const INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS = [
    { id: "command:rm-family", pattern: /\b(rm|rmdir|unlink|del|format|mkfs)\b/i },
    { id: "command:dd", pattern: /\bdd\s+if=/i },
];

export const DESTRUCTIVE_COMMAND_PATTERNS: RegExp[] = INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS.map((p) => p.pattern);

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

function compileCustomPatterns(
    customRules: BerryShieldCustomRulesConfig,
    disabledBuiltInIds: readonly string[]
): PatternCache {
    const disabledIds = new Set(disabledBuiltInIds.map(id => id.toLowerCase()));

    const customSecrets: SecurityPattern[] = customRules.secrets.map(s => {
        let pattern = s.pattern;
        let flags = "gi";

        if (pattern.startsWith("(?i)")) {
            pattern = pattern.substring(4);
            flags = "gi";
        }

        try {
            return {
                id: `custom:secret:${s.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
                name: s.name,
                category: "secret",
                pattern: new RegExp(pattern, flags),
                placeholder: s.placeholder,
            } as SecurityPattern;
        } catch (e) {
            console.error(`[berry-shield] Failed to compile secret pattern '${s.name}': ${e}`);
            return null;
        }
    }).filter((r): r is SecurityPattern => r !== null);

    const customFiles = customRules.sensitiveFiles.map(f => {
        try { return new RegExp(f.pattern, "i"); } catch { return null; }
    }).filter((r): r is RegExp => r !== null);

    const customCmds = customRules.destructiveCommands.map(c => {
        try { return new RegExp(c.pattern, "i"); } catch { return null; }
    }).filter((r): r is RegExp => r !== null);

    const activeSecrets = SECRET_PATTERNS.filter(p => !disabledIds.has(p.id));
    const activePII = PII_PATTERNS.filter(p => !disabledIds.has(p.id));
    const activeFiles = INTERNAL_SENSITIVE_FILE_PATTERNS.filter(p => !disabledIds.has(p.id)).map(p => p.pattern);
    const activeCmds = INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS.filter(p => !disabledIds.has(p.id)).map(p => p.pattern);

    return {
        redactionPatterns: [...activeSecrets, ...customSecrets, ...activePII],
        filePatterns: [...activeFiles, ...customFiles],
        commandPatterns: [...activeCmds, ...customCmds],
    };
}

/**
 * Initializes the pattern cache from effective plugin config.
 */
export function initializePatterns(
    customRules?: BerryShieldCustomRulesConfig,
    disabledBuiltInIds: readonly string[] = []
): void {
    try {
        const effectiveCustomRules: BerryShieldCustomRulesConfig = customRules ?? {
            secrets: [],
            sensitiveFiles: [],
            destructiveCommands: [],
        };
        _cache = compileCustomPatterns(effectiveCustomRules, disabledBuiltInIds);
    } catch (e) {
        console.error(`[berry-shield] Error initializing patterns: ${e}`);
    }
}

/**
 * Reloads pattern cache from updated effective plugin config.
 */
export function reloadPatterns(
    customRules?: BerryShieldCustomRulesConfig,
    disabledBuiltInIds: readonly string[] = []
): void {
    try {
        const effectiveCustomRules: BerryShieldCustomRulesConfig = customRules ?? {
            secrets: [],
            sensitiveFiles: [],
            destructiveCommands: [],
        };
        _cache = compileCustomPatterns(effectiveCustomRules, disabledBuiltInIds);
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

/**
 * Clear the pattern cache (for testing purposes only).
 */
export function clearPatternCache(): void {
    _cache = {
        redactionPatterns: [...SECRET_PATTERNS, ...PII_PATTERNS],
        filePatterns: [...SENSITIVE_FILE_PATTERNS],
        commandPatterns: [...DESTRUCTIVE_COMMAND_PATTERNS],
    };
}
