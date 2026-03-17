import { CATEGORIES, PREFIXES } from "./constants.js";
import { SecurityPattern } from "./index.js";

/**
 * Internal metadata for secret detection.
 */
export const INTERNAL_SECRET_PATTERNS: SecurityPattern[] = [
    {
        id: `${PREFIXES.BERRY_SECRET}:aws-access-key`,
        name: "AWS Access Key",
        category: CATEGORIES.SECRET,
        pattern: /AKIA[0-9A-Z]{16}/g,
        placeholder: "[AWS_KEY_REDACTED]",
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:aws-secret-key`,
        name: "AWS Secret Key",
        category: CATEGORIES.SECRET,
        pattern: /aws_secret_access_key\s*[:=]\s*[A-Za-z0-9/+=]{40}/gi,
        placeholder: "[AWS_SECRET_REDACTED]",
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:stripe-key`,
        name: "Stripe Key",
        category: CATEGORIES.SECRET,
        pattern: /[sr]k[-_](?:live|test)[-_][a-zA-Z0-9]{20,}/g,
        placeholder: "[STRIPE_KEY_REDACTED]",
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:github-token`,
        name: "GitHub Token",
        category: CATEGORIES.SECRET,
        pattern: /gh[pousr]_[a-zA-Z0-9]{36}/g,
        placeholder: "[GITHUB_TOKEN_REDACTED]",
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:github-pat`,
        name: "GitHub PAT",
        category: CATEGORIES.SECRET,
        pattern: /github_pat_[a-zA-Z0-9_]{22,}/g,
        placeholder: "[GITHUB_PAT_REDACTED]",
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:openai-key`,
        name: "OpenAI Key",
        category: CATEGORIES.SECRET,
        pattern: /sk-[a-zA-Z0-9]{20,}/g,
        placeholder: "[OPENAI_KEY_REDACTED]",
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:anthropic-key`,
        name: "Anthropic Key",
        category: CATEGORIES.SECRET,
        pattern: /sk-ant-[a-zA-Z0-9_-]{20,}/g,
        placeholder: "[ANTHROPIC_KEY_REDACTED]",
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:slack-token`,
        name: "Slack Token",
        category: CATEGORIES.SECRET,
        pattern: /xox[bpras]-[a-zA-Z0-9-]{10,}/g,
        placeholder: "[SLACK_TOKEN_REDACTED]",
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:sendgrid-key`,
        name: "SendGrid Key",
        category: CATEGORIES.SECRET,
        pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g,
        placeholder: "[SENDGRID_KEY_REDACTED]",
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:npm-token`,
        name: "NPM Token",
        category: CATEGORIES.SECRET,
        pattern: /npm_[a-zA-Z0-9]{36,}/g,
        placeholder: "[NPM_TOKEN_REDACTED]",
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:private-key`,
        name: "Private Key",
        category: CATEGORIES.SECRET,
        pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
        placeholder: "[PRIVATE_KEY_REDACTED]",
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:jwt`,
        name: "JWT",
        category: CATEGORIES.SECRET,
        pattern: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
        placeholder: "[JWT_REDACTED]",
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:bearer-token`,
        name: "Bearer Token",
        category: CATEGORIES.SECRET,
        pattern: /Authorization\s*[:=]\s*Bearer\s+[a-zA-Z0-9_.\-/+=]{20,}/gi,
        placeholder: "[BEARER_TOKEN_REDACTED]",
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:generic-api-key`,
        name: "Generic API Key",
        category: CATEGORIES.SECRET,
        pattern: /api[-_]?key\s*[:=]\s*[a-zA-Z0-9_.\-/+=]{20,}/gi,
        placeholder: "[API_KEY_REDACTED]",
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:telegram-bot-token`,
        name: "Telegram Bot Token",
        category: CATEGORIES.SECRET,
        pattern: /[0-9]{8,10}:[a-zA-Z0-9_-]{35,}/g,
        placeholder: "[TELEGRAM_TOKEN_REDACTED]",
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:generic-json-secret`,
        name: "Generic JSON Secret",
        category: CATEGORIES.SECRET,
        pattern: /"(?:apiKey|token|secret|auth|password|passwd)"\s*:\s*"([^"]+)"/gi,
        placeholder: "\"key\": \"[GENERIC_SECRET_REDACTED]\"",
    },
];

/**
 * Internal metadata for PII detection.
 */
export const INTERNAL_PII_PATTERNS: SecurityPattern[] = [
    {
        id: `${PREFIXES.BERRY_PII}:email`,
        name: "Email",
        category: CATEGORIES.PII,
        pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        placeholder: "[EMAIL_REDACTED]",
    },
    {
        id: `${PREFIXES.BERRY_PII}:ssn-us`,
        name: "SSN (USA)",
        category: CATEGORIES.PII,
        pattern: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
        placeholder: "[SSN_REDACTED]",
    },
    {
        id: `${PREFIXES.BERRY_PII}:credit-card`,
        name: "Credit Card",
        category: CATEGORIES.PII,
        pattern: /\b[3-6]\d{3}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,7}\b/g,
        placeholder: "[CARD_REDACTED]",
    },
    {
        id: `${PREFIXES.BERRY_PII}:phone-us`,
        name: "US Phone",
        category: CATEGORIES.PII,
        pattern: /\b(?:\+?1[-.\s]?)?(?:\(?[2-9]\d{2}\)?[-.\s]?)[2-9]\d{2}[-.\s]?\d{4}\b/g,
        placeholder: "[PHONE_REDACTED]",
    },
    {
        id: `${PREFIXES.BERRY_PII}:phone-intl`,
        name: "International Phone",
        category: CATEGORIES.PII,
        pattern: /(\+[2-9]\d{0,2}[-.\s]?\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4})\b/g,
        placeholder: "[PHONE_REDACTED]",
    },
    {
        id: `${PREFIXES.BERRY_PII}:iban`,
        name: "IBAN",
        category: CATEGORIES.PII,
        pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}[A-Z0-9]{0,23}\b/g,
        placeholder: "[IBAN_REDACTED]",
    },
    {
        id: `${PREFIXES.BERRY_PII}:cpf-br`,
        name: "CPF (Brazil)",
        category: CATEGORIES.PII,
        pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
        placeholder: "[CPF_REDACTED]",
    },
    {
        id: `${PREFIXES.BERRY_PII}:cnpj-br`,
        name: "CNPJ (Brazil)",
        category: CATEGORIES.PII,
        pattern: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g,
        placeholder: "[CNPJ_REDACTED]",
    },
];

/**
 * Internal metadata for sensitive files.
 */
export const INTERNAL_SENSITIVE_FILE_PATTERNS = [
    { id: `${PREFIXES.BERRY_FILE}:env`, pattern: /\.env(?:\.|$)/i },
    { id: `${PREFIXES.BERRY_FILE}:credentials-json`, pattern: /credentials\.json$/i },
    { id: `${PREFIXES.BERRY_FILE}:pem`, pattern: /\.pem$/i },
    { id: `${PREFIXES.BERRY_FILE}:key`, pattern: /\.key$/i },
    { id: `${PREFIXES.BERRY_FILE}:p12`, pattern: /\.p12$/i },
    { id: `${PREFIXES.BERRY_FILE}:pfx`, pattern: /\.pfx$/i },
    { id: `${PREFIXES.BERRY_FILE}:ssh-private-keys`, pattern: /id_(?:rsa|ed25519|ecdsa|dsa)/i },
    { id: `${PREFIXES.BERRY_FILE}:ssh-known-hosts`, pattern: /known_hosts$/i },
    { id: `${PREFIXES.BERRY_FILE}:ssh-config`, pattern: /\.ssh[\\/]config$/i },
    { id: `${PREFIXES.BERRY_FILE}:netrc`, pattern: /\.netrc$/i },
    { id: `${PREFIXES.BERRY_FILE}:npmrc`, pattern: /\.npmrc$/i },
    { id: `${PREFIXES.BERRY_FILE}:secret-files`, pattern: /secrets?\.(?:ya?ml|json|toml)$/i },
    { id: `${PREFIXES.BERRY_FILE}:aws-credentials`, pattern: /\.aws[\\/]credentials$/i },
    { id: `${PREFIXES.BERRY_FILE}:aws-config`, pattern: /\.aws[\\/]config$/i },
    { id: `${PREFIXES.BERRY_FILE}:kube-config`, pattern: /\.kube[\\/]config$/i },
    { id: `${PREFIXES.BERRY_FILE}:ssh-host-keys`, pattern: /\/etc\/ssh\/ssh_host_(?:rsa|ed25519|ecdsa)_key$/i },
    { id: `${PREFIXES.BERRY_FILE}:docker-config`, pattern: /\.docker[\\/]config\.json$/i },
    { id: `${PREFIXES.BERRY_FILE}:gnupg-keys`, pattern: /\.gnupg[\\/]private-keys-v1\.d(?:[\\/]|$)/i },
    { id: `${PREFIXES.BERRY_FILE}:vault-token`, pattern: /\.vault-token$/i },
    { id: `${PREFIXES.BERRY_FILE}:terraform-credentials`, pattern: /\.terraform\.d[\\/]credentials\.tfrc\.json$/i },
    { id: `${PREFIXES.BERRY_FILE}:rclone-conf`, pattern: /\.config[\\/]rclone[\\/]rclone\.conf$/i },
    { id: `${PREFIXES.BERRY_FILE}:sops-age-keys`, pattern: /\.config[\\/]sops[\\/]age[\\/]keys\.txt$/i },
    { id: `${PREFIXES.BERRY_FILE}:age-keys`, pattern: /\.config[\\/]age[\\/]keys\.txt$/i },
    { id: `${PREFIXES.BERRY_FILE}:pypirc`, pattern: /\.pypirc$/i },
    { id: `${PREFIXES.BERRY_FILE}:gh-hosts`, pattern: /\.config[\\/]gh[\\/]hosts\.yml$/i },
    { id: `${PREFIXES.BERRY_FILE}:gcloud-credentials-db`, pattern: /\.config[\\/]gcloud[\\/]credentials\.db$/i },
    { id: `${PREFIXES.BERRY_FILE}:gcloud-access-tokens`, pattern: /\.config[\\/]gcloud[\\/]access_tokens\.db$/i },
    { id: `${PREFIXES.BERRY_FILE}:gcloud-legacy-credentials`, pattern: /\.config[\\/]gcloud[\\/]legacy_credentials(?:[\\/]|$)/i },
    { id: `${PREFIXES.BERRY_FILE}:azure-access-tokens`, pattern: /\.config[\\/]azure[\\/]accessTokens\.json$/i },
    { id: `${PREFIXES.BERRY_FILE}:helm-registry-config`, pattern: /\.config[\\/]helm[\\/]registry[\\/]config\.json$/i },
    { id: `${PREFIXES.BERRY_FILE}:poetry-auth`, pattern: /\.config[\\/]pypoetry[\\/]auth\.toml$/i },
    { id: `${PREFIXES.BERRY_FILE}:linux-keyrings`, pattern: /\.local[\\/]share[\\/]keyrings(?:[\\/]|$)/i },
    { id: `${PREFIXES.BERRY_FILE}:windows-roaming-credentials`, pattern: /(?:^|[\\/])AppData[\\/]Roaming[\\/]Microsoft[\\/]Credentials(?:[\\/]|$)/i },
    { id: `${PREFIXES.BERRY_FILE}:windows-local-credentials`, pattern: /(?:^|[\\/])AppData[\\/]Local[\\/]Microsoft[\\/]Credentials(?:[\\/]|$)/i },
    { id: `${PREFIXES.BERRY_FILE}:mac-keychains`, pattern: /(?:^|[\\/])Library[\\/]Keychains(?:[\\/]|$)/i },
    { id: `${PREFIXES.BERRY_FILE}:linux-shadow`, pattern: /\/etc\/shadow$/i },
    { id: `${PREFIXES.BERRY_FILE}:linux-passwd`, pattern: /\/etc\/passwd$/i },
    { id: `${PREFIXES.BERRY_FILE}:linux-gshadow`, pattern: /\/etc\/gshadow$/i },
    { id: `${PREFIXES.BERRY_FILE}:openclaw-json`, pattern: /openclaw\.json$/i },
];

/**
 * Internal metadata for destructive commands.
 */
export const INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS = [
    { id: `${PREFIXES.BERRY_COMMAND}:rm-family`, pattern: /\b(rm|rmdir|unlink|del|format|mkfs)\b/i },
    { id: `${PREFIXES.BERRY_COMMAND}:dd`, pattern: /\bdd\s+if=/i },
];
