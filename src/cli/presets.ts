/**
 * Catalog of pre-configured rule templates for Berry Shield.
 */

export interface RulePreset {
    readonly name: string;
    readonly pattern: string;
    readonly placeholder?: string;
    readonly testSamples: {
        readonly shouldMatch: string[];
        readonly shouldNotMatch: string[];
    };
}

export const SECRET_PRESETS: readonly RulePreset[] = [
    {
        name: "Vercel Token",
        pattern: "vercel_[a-zA-Z0-9]{24}",
        placeholder: "[VERCEL_TOKEN_REDACTED]",
        testSamples: {
            shouldMatch: ["vercel_abc1234567890123456789012"],
            shouldNotMatch: ["normal_text", "sk-123"],
        },
    },
    {
        name: "Supabase Key",
        pattern: "sbp_[a-zA-Z0-9]{40}",
        placeholder: "[SUPABASE_KEY_REDACTED]",
        testSamples: {
            shouldMatch: ["sbp_abc12345678901234567890123456789012345678"],
            shouldNotMatch: ["normal_text", "vercel_123"],
        },
    },
    {
        name: "Firebase Key",
        pattern: "AIza[0-9A-Za-z_-]{35}",
        placeholder: "[FIREBASE_KEY_REDACTED]",
        testSamples: {
            shouldMatch: ["AIzaSyAbc123456789012345678901234567890"],
            shouldNotMatch: ["normal_text"],
        },
    },
] as const;

export const FILE_PRESETS: readonly RulePreset[] = [
    {
        name: "Docker Secrets",
        pattern: "docker-compose.*\\.ya?ml$",
        testSamples: {
            shouldMatch: ["docker-compose.yml", "docker-compose.yaml"],
            shouldNotMatch: ["secrets.json", "docker-config.txt"],
        },
    },
    {
        name: "Terraform State",
        pattern: "\\.tfstate$",
        testSamples: {
            shouldMatch: ["terraform.tfstate", "production.tfstate"],
            shouldNotMatch: ["main.tf", "plan.txt"],
        },
    },
] as const;

export const COMMAND_PRESETS: readonly RulePreset[] = [
    {
        name: "Privilege Escalation",
        pattern: "\\bsudo\\b|\\bdoas\\b",
        testSamples: {
            shouldMatch: ["sudo rm -rf /", "doas edit /etc/passwd"],
            shouldNotMatch: ["ls -la", "cat file.txt"],
        },
    },
    {
        name: "Pipe to Shell",
        pattern: "curl.*\\|\\s*(?:ba)?sh",
        testSamples: {
            shouldMatch: ["curl -sSL https://example.com/install.sh | bash"],
            shouldNotMatch: ["curl -O file.zip", "bash script.sh"],
        },
    },
] as const;
