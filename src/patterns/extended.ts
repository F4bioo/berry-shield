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
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:aws-secret-key`,
        name: "AWS Secret Key",
        category: CATEGORIES.SECRET,
        pattern: /aws_secret_access_key\s*[:=]\s*[A-Za-z0-9/+=]{40}/gi,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:stripe-key`,
        name: "Stripe Key",
        category: CATEGORIES.SECRET,
        pattern: /[sr]k[-_](?:live|test)[-_][a-zA-Z0-9]{20,}/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:github-token`,
        name: "GitHub Token",
        category: CATEGORIES.SECRET,
        pattern: /gh[pousr]_[a-zA-Z0-9]{36}/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:github-pat`,
        name: "GitHub PAT",
        category: CATEGORIES.SECRET,
        pattern: /github_pat_[a-zA-Z0-9_]{22,}/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:openai-key`,
        name: "OpenAI Key",
        category: CATEGORIES.SECRET,
        pattern: /sk-[a-zA-Z0-9]{20,}/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:anthropic-key`,
        name: "Anthropic Key",
        category: CATEGORIES.SECRET,
        pattern: /sk-ant-[a-zA-Z0-9_-]{20,}/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:slack-token`,
        name: "Slack Token",
        category: CATEGORIES.SECRET,
        pattern: /xox[bpras]-[a-zA-Z0-9-]{10,}/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:sendgrid-key`,
        name: "SendGrid Key",
        category: CATEGORIES.SECRET,
        pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:npm-token`,
        name: "NPM Token",
        category: CATEGORIES.SECRET,
        pattern: /npm_[a-zA-Z0-9]{36,}/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:telegram-bot-token`,
        name: "Telegram Bot Token",
        category: CATEGORIES.SECRET,
        pattern: /[0-9]{8,10}:[a-zA-Z0-9_-]{35,}/g,
        includeHash: true,
        // Context-awareness: 8-10 digits + colon + 35 alphanum can collide with
        // composite log identifiers, timestamps:tokens, and similar formats.
        isContextRequired: true,
        contextWords: ["telegram", "bot", "token", "tg", "chat_id", "sendMessage"],
        contextWindow: { before: 30, after: 15 },
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:google-api-key`,
        name: "Google API Key",
        category: CATEGORIES.SECRET,
        pattern: /AIza[0-9A-Za-z_-]{35}/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:google-cloud-service-account`,
        name: "GCP Service Account",
        category: CATEGORIES.SECRET,
        pattern: /"type"\s*:\s*"service_account"/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:azure-openai-key`,
        name: "Azure OpenAI Key",
        category: CATEGORIES.SECRET,
        pattern: /(?:azure|openai)[_-]?(?:api)?[_-]?key\s*[:=]\s*["']?[a-fA-F0-9]{32}["']?/gi,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:huggingface-token`,
        name: "HuggingFace Token",
        category: CATEGORIES.SECRET,
        pattern: /hf_[a-zA-Z0-9]{34,}/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:replicate-token`,
        name: "Replicate Token",
        category: CATEGORIES.SECRET,
        pattern: /r8_[a-zA-Z0-9]{36,}/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:cohere-api-key`,
        name: "Cohere API Key",
        category: CATEGORIES.SECRET,
        pattern: /(?:cohere|co[-_]?api)[-_]?key\s*[:=]\s*["']?[a-zA-Z0-9_-]{40,}["']?/gi,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:together-ai-key`,
        name: "Together AI Key",
        category: CATEGORIES.SECRET,
        pattern: /(?:together|together[-_]?ai)[-_]?(?:api)?[-_]?key\s*[:=]\s*["']?[a-zA-Z0-9_-]{40,}["']?/gi,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:mistral-api-key`,
        name: "Mistral API Key",
        category: CATEGORIES.SECRET,
        pattern: /mistral[-_]?(?:api)?[-_]?key\s*[:=]\s*["']?[a-zA-Z0-9_-]{32,}["']?/gi,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:groq-api-key`,
        name: "Groq API Key",
        category: CATEGORIES.SECRET,
        pattern: /gsk_[a-zA-Z0-9_]{48,}/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:deepseek-api-key`,
        name: "DeepSeek API Key",
        category: CATEGORIES.SECRET,
        pattern: /deepseek[-_]?(?:api)?[-_]?key\s*[:=]\s*["']?sk-[a-zA-Z0-9]{48,}["']?/gi,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:coinbase-api-key`,
        name: "Coinbase API Key",
        category: CATEGORIES.SECRET,
        pattern: /(?:coinbase)[_-]?(?:api)?[_-]?(?:key|secret)\s*[:=]\s*["']?[a-zA-Z0-9_-]{20,}["']?/gi,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:binance-api-key`,
        name: "Binance API Key",
        category: CATEGORIES.SECRET,
        pattern: /(?:binance)[_-]?(?:api)?[_-]?(?:key|secret)\s*[:=]\s*["']?[a-zA-Z0-9]{64}["']?/gi,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:alpaca-api-key`,
        name: "Alpaca API Key",
        category: CATEGORIES.SECRET,
        pattern: /(?:AK|PK)[a-zA-Z0-9]{20}/g,
        includeHash: true,
        // Context-awareness required: "AK"/"PK" + 20 alphanum is extremely common
        // in package names, base64 fragments, and generic identifiers.
        isContextRequired: true,
        contextWords: ["alpaca", "trading", "brokerage", "api", "key", "secret", "market"],
        contextWindow: { before: 30, after: 15 },
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:trading-api-key`,
        name: "Trading API Key",
        category: CATEGORIES.SECRET,
        pattern: /(?:trading|brokerage|alpaca|tradier|interactive[-_]?brokers)[-_]?(?:api)?[-_]?(?:key|secret|token)\s*[:=]\s*["']?[a-zA-Z0-9_-]{20,}["']?/gi,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:slack-webhook`,
        name: "Slack Webhook",
        category: CATEGORIES.SECRET,
        pattern: /hooks\.slack\.com\/services\/T[a-zA-Z0-9_]+\/B[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:twilio-api-key`,
        name: "Twilio API Key",
        category: CATEGORIES.SECRET,
        pattern: /SK[0-9a-fA-F]{32}/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:mailgun-api-key`,
        name: "Mailgun API Key",
        category: CATEGORIES.SECRET,
        pattern: /key-[a-zA-Z0-9]{32}/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:vault-token`,
        name: "Vault Token",
        category: CATEGORIES.SECRET,
        pattern: /hvs\.[a-zA-Z0-9_-]{24,}/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:database-url`,
        name: "Database URL",
        category: CATEGORIES.SECRET,
        pattern: /(?:postgres|postgresql|mysql|mongodb(?:\+srv)?):\/\/[^\s]{10,}/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:redis-url`,
        name: "Redis URL",
        category: CATEGORIES.SECRET,
        pattern: /rediss?:\/\/[^\s]{10,}/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:supabase-key`,
        name: "Supabase Key",
        category: CATEGORIES.SECRET,
        pattern: /(?:supabase|SUPABASE)[-_]?(?:anon|service[-_]?role)?[-_]?key\s*[:=]\s*["']?eyJ[a-zA-Z0-9_-]{20,}["']?/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:vercel-token`,
        name: "Vercel Token",
        category: CATEGORIES.SECRET,
        pattern: /vercel_[a-zA-Z0-9_-]{24,}/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:heroku-api-key`,
        name: "Heroku API Key",
        category: CATEGORIES.SECRET,
        pattern: /heroku[-_]?(?:api)?[-_]?key\s*[:=]\s*["']?[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}["']?/gi,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:digitalocean-token`,
        name: "DigitalOcean Token",
        category: CATEGORIES.SECRET,
        pattern: /dop_v1_[a-fA-F0-9]{64}/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:cloudflare-api-token`,
        name: "Cloudflare API Token",
        category: CATEGORIES.SECRET,
        pattern: /cf_[a-zA-Z0-9_-]{40,}/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:firebase-key`,
        name: "Firebase Key",
        category: CATEGORIES.SECRET,
        pattern: /(?:firebase|FIREBASE)[-_]?(?:api)?[-_]?(?:key|secret|token)\s*[:=]\s*["']?[a-zA-Z0-9_-]{20,}["']?/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:datadog-api-key`,
        name: "Datadog API Key",
        category: CATEGORIES.SECRET,
        pattern: /(?:datadog|DD)[-_]?(?:api)?[-_]?key\s*[:=]\s*["']?[a-fA-F0-9]{32}["']?/gi,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:sentry-dsn`,
        name: "Sentry DSN",
        category: CATEGORIES.SECRET,
        pattern: /https:\/\/[a-f0-9]{32}@[a-z0-9.]+sentry[a-z.]*\/[0-9]+/g,
        includeHash: true,
    },
    // --- High Collision Potential (Raw Formats) ---
    {
        id: `${PREFIXES.BERRY_SECRET}:eth-private-key`,
        name: "ETH Private Key",
        category: CATEGORIES.SECRET,
        pattern: /(?:^|[\s"'`=])(?:0x)?[0-9a-fA-F]{64}(?=\s|$|["'])/g,
        includeHash: true,
        // Context-awareness required: raw 64-char hex collides with SHA-256 hashes,
        // git commit hashes, and other common hex strings.
        // Self-contained vendor patterns (Binance, Coinbase) take priority via selectWinner.
        isContextRequired: true,
        contextWords: ["eth", "ethereum", "private", "wallet", "key", "0x", "web3", "crypto", "mnemonic", "keystore"],
        contextWindow: { before: 40, after: 20 },
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:mnemonic-seed`,
        name: "Crypto Seed",
        category: CATEGORIES.SECRET,
        pattern: /(?:mnemonic|seed\s*phrase|recovery\s*phrase|backup\s*phrase)\s*[:=]?\s*["']?(?:[a-z]{3,8}\s+){11,23}[a-z]{3,8}["']?/gi,
        includeHash: true,
        // Already self-validating: pattern includes "mnemonic"/"seed phrase" in regex
        // No additional context needed
    },
    // --- Generic & Catch-all (Final Fallback) ---
    {
        id: `${PREFIXES.BERRY_SECRET}:private-key`,
        name: "Private Key",
        category: CATEGORIES.SECRET,
        pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:jwt`,
        name: "JWT",
        category: CATEGORIES.SECRET,
        pattern: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:bearer-token`,
        name: "Bearer Token",
        category: CATEGORIES.SECRET,
        pattern: /Authorization\s*[:=]\s*Bearer\s+[a-zA-Z0-9_.\-/+=]{20,}/gi,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_SECRET}:generic-api-key`,
        name: "Generic API Key",
        category: CATEGORIES.SECRET,
        pattern: /api[-_]?key\s*[:=]\s*[a-zA-Z0-9_.\-/+=]{20,}/gi,
        includeHash: true,
        // Self-contained pattern: regex already requires "api_key" literal
        // Context-awareness not needed - the pattern itself IS the context
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
 * 
 * IMPORTANT: Pattern order matters for overlap resolution!
 * - Context-aware patterns (CPF, CNH, RG) placed BEFORE generic phone patterns
 * - This prevents false positives where phone patterns incorrectly match Brazilian IDs
 */
export const INTERNAL_PII_PATTERNS: SecurityPattern[] = [
    {
        id: `${PREFIXES.BERRY_PII}:email`,
        name: "Email",
        category: CATEGORIES.PII,
        pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_PII}:ssn-us`,
        name: "SSN (USA)",
        category: CATEGORIES.PII,
        pattern: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_PII}:credit-card`,
        name: "Credit Card",
        category: CATEGORIES.PII,
        pattern: /\b[3-6]\d{3}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,7}\b/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_PII}:iban`,
        name: "IBAN",
        category: CATEGORIES.PII,
        pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}[A-Z0-9]{0,23}\b/g,
        includeHash: true,
    },
    // --- Brazilian PII (BEFORE phone patterns to enable context evaluation) ---
    {
        id: `${PREFIXES.BERRY_PII}:cpf-br`,
        name: "CPF (Brazil)",
        category: CATEGORIES.PII,
        pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
        includeHash: true,
        // Context-awareness: Prevents false positives (11-digit phone numbers)
        isContextRequired: true,
        contextWords: ["cpf", "cadastro", "documento", "contribuinte", "fiscal", "tax"],
        contextWindow: { before: 30, after: 15 },
    },
    {
        id: `${PREFIXES.BERRY_PII}:cnpj-br`,
        name: "CNPJ (Brazil)",
        category: CATEGORIES.PII,
        pattern: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_PII}:cnh-br`,
        name: "CNH (Brazil)",
        category: CATEGORIES.PII,
        pattern: /\b\d{11}\b/g,
        includeHash: true,
        // Context-awareness: Prevents false positives (timestamps, IDs)
        isContextRequired: true,
        contextWords: ["cnh", "habilitação", "habilitacao", "carteira", "motorista", "driver", "license"],
        contextWindow: { before: 40, after: 10 },
    },
    {
        id: `${PREFIXES.BERRY_PII}:rg-br`,
        name: "RG (Brazil)",
        category: CATEGORIES.PII,
        pattern: /\b\d{1,2}\.?\d{3}\.?\d{3}-?\d{1}\b/g,
        includeHash: true,
        // Context-awareness: Prevents false positives (IDs, counters)
        isContextRequired: true,
        contextWords: ["rg", "identidade", "documento", "carteira", "identity", "card"],
        contextWindow: { before: 30, after: 15 },
    },
    // --- Chinese PII ---
    {
        id: `${PREFIXES.BERRY_PII}:id-cn`,
        name: "Citizen ID (China)",
        category: CATEGORIES.PII,
        pattern: /\b[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_PII}:cn-phone`,
        name: "Chinese Phone",
        category: CATEGORIES.PII,
        pattern: /\b1[3-9]\d{9}\b/g,
        includeHash: true,
        // Context-awareness: Prevents collision with Brazilian phones (also 11 digits starting with 1)
        isContextRequired: true,
        contextWords: ["手机", "电话", "phone", "mobile", "contact", "tel"],
        contextWindow: { before: 25, after: 10 },
    },
    // --- Generic Passport (international) ---
    {
        id: `${PREFIXES.BERRY_PII}:passport`,
        name: "Passport",
        category: CATEGORIES.PII,
        pattern: /\b(?:passport|护照)[-_\s]*(?:no|number|号)?[-_\s:]*[A-Z0-9]{5,12}\b/gi,
        includeHash: true,
    },
    // --- Phone patterns (AFTER context-aware BR/CN to avoid false positives) ---
    {
        id: `${PREFIXES.BERRY_PII}:phone-us`,
        name: "US Phone",
        category: CATEGORIES.PII,
        pattern: /\b(?:\+?1[-.\s]?)?(?:\(?[2-9]\d{2}\)?[-.\s]?)[2-9]\d{2}[-.\s]?\d{4}\b/g,
        includeHash: true,
    },
    {
        id: `${PREFIXES.BERRY_PII}:phone-intl`,
        name: "International Phone",
        category: CATEGORIES.PII,
        pattern: /(\+[2-9]\d{0,2}[-.\s]?\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4})\b/g,
        includeHash: true,
    },
];

/**
 * Internal metadata for sensitive files.
 */
export const INTERNAL_SENSITIVE_FILE_PATTERNS = [
    { id: `${PREFIXES.BERRY_FILE}:env`, name: "Environment File", category: CATEGORIES.FILE, pattern: /\.env(?:\.|$)/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:credentials-json`, name: "Credentials JSON", category: CATEGORIES.FILE, pattern: /credentials\.json$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:pem`, name: "PEM Key", category: CATEGORIES.FILE, pattern: /\.pem$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:key`, name: "Private Key File", category: CATEGORIES.FILE, pattern: /\.key$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:p12`, name: "PKCS#12 File", category: CATEGORIES.FILE, pattern: /\.p12$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:pfx`, name: "PFX Certificate", category: CATEGORIES.FILE, pattern: /\.pfx$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:ssh-private-keys`, name: "SSH Private Key", category: CATEGORIES.FILE, pattern: /id_(?:rsa|ed25519|ecdsa|dsa)/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:ssh-known-hosts`, name: "SSH Known Hosts", category: CATEGORIES.FILE, pattern: /known_hosts$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:ssh-config`, name: "SSH Config", category: CATEGORIES.FILE, pattern: /\.ssh[\\/]config$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:netrc`, name: "NETRC Config", category: CATEGORIES.FILE, pattern: /\.netrc$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:npmrc`, name: "NPMRC Config", category: CATEGORIES.FILE, pattern: /\.npmrc$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:secret-files`, name: "Generic Secret File", category: CATEGORIES.FILE, pattern: /secrets?\.(?:ya?ml|json|toml)$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:aws-credentials`, name: "AWS Credentials", category: CATEGORIES.FILE, pattern: /\.aws[\\/]credentials$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:aws-config`, name: "AWS Config", category: CATEGORIES.FILE, pattern: /\.aws[\\/]config$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:kube-config`, name: "Kube Config", category: CATEGORIES.FILE, pattern: /\.kube[\\/]config$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:ssh-host-keys`, name: "SSH Host Key", category: CATEGORIES.FILE, pattern: /\/etc\/ssh\/ssh_host_(?:rsa|ed25519|ecdsa)_key$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:docker-config`, name: "Docker Config", category: CATEGORIES.FILE, pattern: /\.docker[\\/]config\.json$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:gnupg-keys`, name: "GnuPG Private Key", category: CATEGORIES.FILE, pattern: /\.gnupg[\\/]private-keys-v1\.d(?:[\\/]|$)/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:vault-token`, name: "Vault Token", category: CATEGORIES.FILE, pattern: /\.vault-token$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:terraform-credentials`, name: "Terraform Credentials", category: CATEGORIES.FILE, pattern: /\.terraform\.d[\\/]credentials\.tfrc\.json$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:rclone-conf`, name: "Rclone Config", category: CATEGORIES.FILE, pattern: /\.config[\\/]rclone[\\/]rclone\.conf$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:sops-age-keys`, name: "SOPS Age Keys", category: CATEGORIES.FILE, pattern: /\.config[\\/]sops[\\/]age[\\/]keys\.txt$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:age-keys`, name: "Age Keys", category: CATEGORIES.FILE, pattern: /\.config[\\/]age[\\/]keys\.txt$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:pypirc`, name: "PyPI Config", category: CATEGORIES.FILE, pattern: /\.pypirc$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:gh-hosts`, name: "GitHub CLI Hosts", category: CATEGORIES.FILE, pattern: /\.config[\\/]gh[\\/]hosts\.yml$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:gcloud-credentials-db`, name: "GCloud Credentials", category: CATEGORIES.FILE, pattern: /\.config[\\/]gcloud[\\/]credentials\.db$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:gcloud-access-tokens`, name: "GCloud Access Tokens", category: CATEGORIES.FILE, pattern: /\.config[\\/]gcloud[\\/]access_tokens\.db$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:gcloud-legacy-credentials`, name: "GCloud Legacy Credentials", category: CATEGORIES.FILE, pattern: /\.config[\\/]gcloud[\\/]legacy_credentials(?:[\\/]|$)/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:azure-access-tokens`, name: "Azure Access Tokens", category: CATEGORIES.FILE, pattern: /\.config[\\/]azure[\\/]accessTokens\.json$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:helm-registry-config`, name: "Helm Registry Config", category: CATEGORIES.FILE, pattern: /\.config[\\/]helm[\\/]registry[\\/]config\.json$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:poetry-auth`, name: "Poetry Auth", category: CATEGORIES.FILE, pattern: /\.config[\\/]pypoetry[\\/]auth\.toml$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:linux-keyrings`, name: "Linux Keyrings", category: CATEGORIES.FILE, pattern: /\.local[\\/]share[\\/]keyrings(?:[\\/]|$)/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:windows-roaming-credentials`, name: "Windows Roaming Credentials", category: CATEGORIES.FILE, pattern: /(?:^|[\\/])AppData[\\/]Roaming[\\/]Microsoft[\\/]Credentials(?:[\\/]|$)/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:windows-local-credentials`, name: "Windows Local Credentials", category: CATEGORIES.FILE, pattern: /(?:^|[\\/])AppData[\\/]Local[\\/]Microsoft[\\/]Credentials(?:[\\/]|$)/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:mac-keychains`, name: "Mac Keychains", category: CATEGORIES.FILE, pattern: /(?:^|[\\/])Library[\\/]Keychains(?:[\\/]|$)/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:linux-shadow`, name: "Linux Shadow File", category: CATEGORIES.FILE, pattern: /\/etc\/shadow$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:linux-passwd`, name: "Linux Passwd File", category: CATEGORIES.FILE, pattern: /\/etc\/passwd$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:linux-gshadow`, name: "Linux Gshadow File", category: CATEGORIES.FILE, pattern: /\/etc\/gshadow$/i, includeHash: true },
    { id: `${PREFIXES.BERRY_FILE}:openclaw-json`, name: "OpenClaw Config File", category: CATEGORIES.FILE, pattern: /openclaw\.json$/i, includeHash: true },
];

/**
 * Internal metadata for destructive commands.
 */
export const INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS = [
    // GROUP A: Filesystem (Flags-First)
    { 
        id: `${PREFIXES.BERRY_COMMAND}:filesystem-rm`, 
        name: "Destructive RM",
        category: CATEGORIES.COMMAND,
        pattern: /rm\s+-(?:[rf]{1,2}|-recursive|-force)\b/gi,
        includeHash: true,
    },
    { 
        id: `${PREFIXES.BERRY_COMMAND}:fs-disk`, 
        name: "Filesystem Danger (Disk/Format)",
        category: CATEGORIES.COMMAND,
        pattern: /\b(format|mkfs|dd|rmdir)\b/i,
        isContextRequired: true,
        contextWords: ["dev", "disk", "sda", "sdb", "nvme", "if=", "of=", "sudo"],
        contextWindow: { before: 30, after: 30 },
        includeHash: true,
    },
    { 
        id: `${PREFIXES.BERRY_COMMAND}:fs-delete-utils`, 
        name: "Filesystem Danger (Utils)",
        category: CATEGORIES.COMMAND,
        pattern: /\b(unlink|del)\b/i,
        isContextRequired: true,
        contextWords: ["sudo", "root", "force", "all", "quiet"],
        contextWindow: { before: 10, after: 10 },
        includeHash: true,
    },

    // GROUP B: Database (Semantic Context)
    { 
        id: `${PREFIXES.BERRY_COMMAND}:db-destructive`, 
        name: "Database Danger",
        category: CATEGORIES.COMMAND,
        pattern: /\b(DROP\s+(?:TABLE|DATABASE)|TRUNCATE\s+TABLE|DELETE\s+FROM)\b/i,
        isContextRequired: true,
        contextWords: ["sql", "query", "database", "production", "db", "master", "main"],
        contextWindow: { before: 20, after: 20 },
        includeHash: true,
    },

    // GROUP C: DevOps & Cloud
    { 
        id: `${PREFIXES.BERRY_COMMAND}:devops-k8s`, 
        name: "DevOps Danger (K8s)",
        category: CATEGORIES.COMMAND,
        pattern: /\bkubectl\s+delete\b/i,
        isContextRequired: true,
        contextWords: ["namespace", "pod", "all", "force", "cluster", "production", "prod"],
        contextWindow: { before: 20, after: 20 },
        includeHash: true,
    },
    { 
        id: `${PREFIXES.BERRY_COMMAND}:devops-docker`, 
        name: "DevOps Danger (Docker)",
        category: CATEGORIES.COMMAND,
        pattern: /\bdocker\s+(?:rm|rmi|system\s+prune)\b/i,
        isContextRequired: true,
        contextWords: ["all", "force", "image", "container", "volume", "prune"],
        contextWindow: { before: 20, after: 20 },
        includeHash: true,
    },

    // GROUP D: Network & System
    { 
        id: `${PREFIXES.BERRY_COMMAND}:sys-network`, 
        name: "System/Network Danger",
        category: CATEGORIES.COMMAND,
        pattern: /\b(iptables\s+-F|systemctl\s+stop)\b/i,
        isContextRequired: true,
        contextWords: ["sudo", "root", "firewall", "service", "daemon", "stop"],
        contextWindow: { before: 15, after: 15 },
        includeHash: true,
    },

    // GROUP E: Git & Permissions
    { 
        id: `${PREFIXES.BERRY_COMMAND}:git-force`, 
        name: "Git Danger (Force)",
        category: CATEGORIES.COMMAND,
        pattern: /\bgit\s+push\b/i,
        isContextRequired: true,
        contextWords: ["--force", "-f", "master", "main", "production"],
        contextWindow: { before: 10, after: 30 },
        includeHash: true,
    },
    { 
        id: `${PREFIXES.BERRY_COMMAND}:git-reset`, 
        name: "Git Danger (Reset)",
        category: CATEGORIES.COMMAND,
        pattern: /\bgit\s+reset\s+--hard\b/i,
        includeHash: true, // Self-contained dangerous command
    },
    {
        id: `${PREFIXES.BERRY_COMMAND}:permissions-777`,
        name: "Insecure Permissions (777)",
        category: CATEGORIES.COMMAND,
        pattern: /chmod\s+777\b/gi,
        includeHash: true,
    },
];
