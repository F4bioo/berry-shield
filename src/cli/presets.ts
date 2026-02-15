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
    {
        name: "Cloudflare Token",
        pattern: "cf_[a-zA-Z0-9_-]{40}",
        placeholder: "[CLOUDFLARE_TOKEN_REDACTED]",
        testSamples: {
            shouldMatch: ["cf_1234567890123456789012345678901234567890"],
            shouldNotMatch: ["cloudflare_token", "cf_short"],
        },
    },
    {
        name: "GitHub Token",
        pattern: "gh[pousr]_[A-Za-z0-9_]{36,255}",
        placeholder: "[GITHUB_TOKEN_REDACTED]",
        testSamples: {
            shouldMatch: ["ghp_abcdefghijklmnopqrstuvwxyz0123456789ABCD"],
            shouldNotMatch: ["github_pat", "normal_text"],
        },
    },
    {
        name: "Stripe Secret Key",
        pattern: "sk_(live|test)_[0-9a-zA-Z]{24,}",
        placeholder: "[STRIPE_SECRET_REDACTED]",
        testSamples: {
            shouldMatch: ["sk_live_abc123456789012345678901"],
            shouldNotMatch: ["pk_live_abc123456789012345678901", "normal_text"],
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
    {
        name: "Kubernetes Secrets",
        pattern: "secrets?\\.ya?ml$",
        testSamples: {
            shouldMatch: ["secret.yaml", "secrets.yml"],
            shouldNotMatch: ["deployment.yaml", "configmap.yaml"],
        },
    },
    {
        name: ".env Files",
        pattern: "(^|[\\\\/])\\.env(\\.[A-Za-z0-9_-]+)?$",
        testSamples: {
            shouldMatch: [".env", ".env.production", "config/.env.local"],
            shouldNotMatch: ["env.txt", "README.md"],
        },
    },
    {
        name: "SSH Private Keys",
        pattern: "(id_rsa|id_ed25519|\\.pem$|\\.key$)",
        testSamples: {
            shouldMatch: ["~/.ssh/id_rsa", "server.pem"],
            shouldNotMatch: ["public_key.pub", "notes.txt"],
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
    {
        name: "Permission Override",
        pattern: "chmod\\s+[0-7]*7[0-7]*",
        testSamples: {
            shouldMatch: ["chmod 777 /tmp/test.sh", "chmod 4755 /usr/local/bin/tool"],
            shouldNotMatch: ["chmod 644 file.txt", "chown root:root file.txt"],
        },
    },
    {
        name: "Destructive Removal",
        pattern: "\\brm\\b\\s+-rf\\s+(/|\\.|~)",
        testSamples: {
            shouldMatch: ["rm -rf /", "rm -rf ~/tmp"],
            shouldNotMatch: ["rm -f file.txt", "rmdir empty-folder"],
        },
    },
    {
        name: "Disk Formatting",
        pattern: "\\b(mkfs|format)\\b|\\bdd\\s+if=",
        testSamples: {
            shouldMatch: ["mkfs.ext4 /dev/sda1", "dd if=/dev/zero of=/dev/sda"],
            shouldNotMatch: ["df -h", "mount /dev/sda1 /mnt/data"],
        },
    },
] as const;
