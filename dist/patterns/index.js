/**
 * Security patterns for detecting secrets and PII.
 *
 * These patterns are used by Berry.Pulp (Output Scanner) to identify
 * sensitive information that should be redacted from tool outputs.
 */
/**
 * Secrets patterns - API keys, tokens, credentials.
 */
export const SECRET_PATTERNS = [
    {
        name: "AWS Access Key",
        pattern: /AKIA[0-9A-Z]{16}/g,
        placeholder: "[AWS_KEY_REDACTED]",
    },
    {
        name: "AWS Secret Key",
        pattern: /aws_secret_access_key\s*[:=]\s*[A-Za-z0-9/+=]{40}/gi,
        placeholder: "[AWS_SECRET_REDACTED]",
    },
    {
        name: "Stripe Key",
        pattern: /[sr]k[-_](?:live|test)[-_][a-zA-Z0-9]{20,}/g,
        placeholder: "[STRIPE_KEY_REDACTED]",
    },
    {
        name: "GitHub Token",
        pattern: /gh[pousr]_[a-zA-Z0-9]{36}/g,
        placeholder: "[GITHUB_TOKEN_REDACTED]",
    },
    {
        name: "GitHub PAT",
        pattern: /github_pat_[a-zA-Z0-9_]{22,}/g,
        placeholder: "[GITHUB_PAT_REDACTED]",
    },
    {
        name: "OpenAI Key",
        pattern: /sk-[a-zA-Z0-9]{20,}/g,
        placeholder: "[OPENAI_KEY_REDACTED]",
    },
    {
        name: "Anthropic Key",
        pattern: /sk-ant-[a-zA-Z0-9_-]{20,}/g,
        placeholder: "[ANTHROPIC_KEY_REDACTED]",
    },
    {
        name: "Slack Token",
        pattern: /xox[bpras]-[a-zA-Z0-9-]{10,}/g,
        placeholder: "[SLACK_TOKEN_REDACTED]",
    },
    {
        name: "SendGrid Key",
        pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g,
        placeholder: "[SENDGRID_KEY_REDACTED]",
    },
    {
        name: "NPM Token",
        pattern: /npm_[a-zA-Z0-9]{36,}/g,
        placeholder: "[NPM_TOKEN_REDACTED]",
    },
    {
        name: "Private Key",
        pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
        placeholder: "[PRIVATE_KEY_REDACTED]",
    },
    {
        name: "JWT",
        pattern: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
        placeholder: "[JWT_REDACTED]",
    },
    {
        name: "Bearer Token",
        pattern: /Authorization\s*[:=]\s*Bearer\s+[a-zA-Z0-9_.\-/+=]{20,}/gi,
        placeholder: "[BEARER_TOKEN_REDACTED]",
    },
    {
        name: "Generic API Key",
        pattern: /api[-_]?key\s*[:=]\s*[a-zA-Z0-9_.\-/+=]{20,}/gi,
        placeholder: "[API_KEY_REDACTED]",
    },
    {
        name: "Telegram Bot Token",
        pattern: /[0-9]{8,10}:[a-zA-Z0-9_-]{35,}/g,
        placeholder: "[TELEGRAM_TOKEN_REDACTED]",
    },
    {
        name: "Generic JSON Secret",
        pattern: /"(?:apiKey|token|secret|auth|password|passwd)"\s*:\s*"([^"]+)"/gi,
        placeholder: "\"key\": \"[GENERIC_SECRET_REDACTED]\"",
    },
];
/**
 * PII patterns - Personal Identifiable Information.
 */
export const PII_PATTERNS = [
    {
        name: "Email",
        pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        placeholder: "[EMAIL_REDACTED]",
    },
    {
        name: "SSN (USA)",
        pattern: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
        placeholder: "[SSN_REDACTED]",
    },
    {
        name: "Credit Card",
        pattern: /\b[3-6]\d{3}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,7}\b/g,
        placeholder: "[CARD_REDACTED]",
    },
    {
        name: "US Phone",
        pattern: /\b(?:\+?1[-.\s]?)?(?:\(?[2-9]\d{2}\)?[-.\s]?)[2-9]\d{2}[-.\s]?\d{4}\b/g,
        placeholder: "[PHONE_REDACTED]",
    },
    {
        name: "International Phone",
        pattern: /\b\+[2-9]\d{0,2}[-.\s]?\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g,
        placeholder: "[PHONE_REDACTED]",
    },
    {
        name: "IBAN",
        pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}[A-Z0-9]{0,23}\b/g,
        placeholder: "[IBAN_REDACTED]",
    },
    {
        name: "CPF (Brazil)",
        pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
        placeholder: "[CPF_REDACTED]",
    },
    {
        name: "CNPJ (Brazil)",
        pattern: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g,
        placeholder: "[CNPJ_REDACTED]",
    },
];
/**
 * Sensitive file path patterns.
 */
export const SENSITIVE_FILE_PATTERNS = [
    /\.env(?:\.|$)/i,
    /credentials\.json$/i,
    /\.pem$/i,
    /\.key$/i,
    /\.p12$/i,
    /\.pfx$/i,
    /id_(?:rsa|ed25519|ecdsa|dsa)/i,
    /known_hosts$/i,
    /\.ssh\/config$/i,
    /\.netrc$/i,
    /\.npmrc$/i,
    /secrets?\.(?:ya?ml|json|toml)$/i,
    /\.aws\/credentials$/i,
    /\.kube\/config$/i,
    /\/etc\/shadow$/i,
    /\/etc\/passwd$/i,
    /openclaw\.json$/i,
];
/**
 * Destructive command patterns.
 */
export const DESTRUCTIVE_COMMAND_PATTERNS = [
    /\b(rm|rmdir|unlink|del|format|mkfs)\b/i,
    /\bdd\s+if=/i,
];
/**
 * Combines all redaction patterns into a single array.
 */
export function getAllRedactionPatterns() {
    return [...SECRET_PATTERNS, ...PII_PATTERNS];
}
