import { describe, expect, it } from "vitest";
import { SENSITIVE_FILE_PATTERNS, DESTRUCTIVE_COMMAND_PATTERNS } from "../src/patterns";

describe("SENSITIVE_FILE_PATTERNS", () => {
    const testPath = (path: string) =>
        SENSITIVE_FILE_PATTERNS.some((pattern) => {
            pattern.lastIndex = 0;
            return pattern.test(path);
        });

    describe("env files", () => {
        it("matches .env", () => {
            expect(testPath(".env")).toBe(true);
        });

        it("matches .env.local", () => {
            expect(testPath(".env.local")).toBe(true);
        });

        it("matches .env.production", () => {
            expect(testPath(".env.production")).toBe(true);
        });

        it("matches path with .env", () => {
            expect(testPath("/home/user/project/.env")).toBe(true);
        });
    });

    describe("credential files", () => {
        it("matches credentials.json", () => {
            expect(testPath("credentials.json")).toBe(true);
        });

        it("matches with path", () => {
            expect(testPath("/home/user/.aws/credentials")).toBe(true);
        });
    });

    describe("key files", () => {
        it("matches .pem files", () => {
            expect(testPath("certificate.pem")).toBe(true);
        });

        it("matches .key files", () => {
            expect(testPath("private.key")).toBe(true);
        });

        it("matches id_rsa", () => {
            expect(testPath("/home/user/.ssh/id_rsa")).toBe(true);
        });

        it("matches id_ed25519", () => {
            expect(testPath("id_ed25519")).toBe(true);
        });
    });

    describe("config files", () => {
        it("matches .kube/config", () => {
            expect(testPath("/home/user/.kube/config")).toBe(true);
        });

        it("matches secrets.yaml", () => {
            expect(testPath("secrets.yaml")).toBe(true);
        });

        it("matches secrets.json", () => {
            expect(testPath("secrets.json")).toBe(true);
        });
    });

    describe("certificate files", () => {
        it("matches .p12 files", () => {
            expect(testPath("certificate.p12")).toBe(true);
        });

        it("matches .pfx files", () => {
            expect(testPath("certificate.pfx")).toBe(true);
        });
    });

    describe("SSH files", () => {
        it("matches known_hosts", () => {
            expect(testPath("/home/user/.ssh/known_hosts")).toBe(true);
        });

        it("matches .ssh/config", () => {
            expect(testPath("/home/user/.ssh/config")).toBe(true);
        });
    });

    describe("other sensitive files", () => {
        it("matches .netrc", () => {
            expect(testPath("/home/user/.netrc")).toBe(true);
        });

        it("matches .npmrc", () => {
            expect(testPath("/home/user/.npmrc")).toBe(true);
        });

        it("matches /etc/shadow", () => {
            expect(testPath("/etc/shadow")).toBe(true);
        });

        it("matches /etc/passwd", () => {
            expect(testPath("/etc/passwd")).toBe(true);
        });

        it("matches openclaw.json", () => {
            expect(testPath("openclaw.json")).toBe(true);
        });

        it("matches openclaw.json with path", () => {
            expect(testPath("/home/user/.openclaw/openclaw.json")).toBe(true);
        });

        it("matches ssh host private keys", () => {
            expect(testPath("/etc/ssh/ssh_host_rsa_key")).toBe(true);
            expect(testPath("/etc/ssh/ssh_host_ed25519_key")).toBe(true);
        });

        it("matches docker config auth file", () => {
            expect(testPath("/home/user/.docker/config.json")).toBe(true);
            expect(testPath("C:\\Users\\user\\.docker\\config.json")).toBe(true);
        });

        it("matches GPG private key directory", () => {
            expect(testPath("/home/user/.gnupg/private-keys-v1.d")).toBe(true);
            expect(testPath("/home/user/.gnupg/private-keys-v1.d/ABC123.key")).toBe(true);
            expect(testPath("C:\\Users\\user\\.gnupg\\private-keys-v1.d\\ABC123.key")).toBe(true);
        });

        it("matches vault token file", () => {
            expect(testPath("/home/user/.vault-token")).toBe(true);
        });

        it("matches terraform credentials file", () => {
            expect(testPath("/home/user/.terraform.d/credentials.tfrc.json")).toBe(true);
            expect(testPath("C:\\Users\\user\\.terraform.d\\credentials.tfrc.json")).toBe(true);
        });

        it("matches rclone config file", () => {
            expect(testPath("/home/user/.config/rclone/rclone.conf")).toBe(true);
            expect(testPath("C:\\Users\\user\\.config\\rclone\\rclone.conf")).toBe(true);
        });

        it("matches aws config file", () => {
            expect(testPath("/home/user/.aws/config")).toBe(true);
            expect(testPath("C:\\Users\\user\\.aws\\config")).toBe(true);
        });

        it("matches sops and age key files", () => {
            expect(testPath("/home/user/.config/sops/age/keys.txt")).toBe(true);
            expect(testPath("/home/user/.config/age/keys.txt")).toBe(true);
            expect(testPath("C:\\Users\\user\\.config\\sops\\age\\keys.txt")).toBe(true);
            expect(testPath("C:\\Users\\user\\.config\\age\\keys.txt")).toBe(true);
        });

        it("matches pypirc credentials file", () => {
            expect(testPath("/home/user/.pypirc")).toBe(true);
        });

        it("matches GitHub CLI hosts file", () => {
            expect(testPath("/home/user/.config/gh/hosts.yml")).toBe(true);
            expect(testPath("C:\\Users\\user\\.config\\gh\\hosts.yml")).toBe(true);
        });

        it("matches gcloud local credential stores", () => {
            expect(testPath("/home/user/.config/gcloud/credentials.db")).toBe(true);
            expect(testPath("/home/user/.config/gcloud/access_tokens.db")).toBe(true);
            expect(testPath("/home/user/.config/gcloud/legacy_credentials")).toBe(true);
            expect(testPath("/home/user/.config/gcloud/legacy_credentials/user@example.com/adc.json")).toBe(true);
            expect(testPath("C:\\Users\\user\\.config\\gcloud\\credentials.db")).toBe(true);
            expect(testPath("C:\\Users\\user\\.config\\gcloud\\access_tokens.db")).toBe(true);
            expect(testPath("C:\\Users\\user\\.config\\gcloud\\legacy_credentials\\user@example.com\\adc.json")).toBe(true);
        });

        it("matches azure access token file", () => {
            expect(testPath("/home/user/.config/azure/accessTokens.json")).toBe(true);
            expect(testPath("C:\\Users\\user\\.config\\azure\\accessTokens.json")).toBe(true);
        });

        it("matches helm and poetry auth files", () => {
            expect(testPath("/home/user/.config/helm/registry/config.json")).toBe(true);
            expect(testPath("/home/user/.config/pypoetry/auth.toml")).toBe(true);
            expect(testPath("C:\\Users\\user\\.config\\helm\\registry\\config.json")).toBe(true);
            expect(testPath("C:\\Users\\user\\.config\\pypoetry\\auth.toml")).toBe(true);
        });

        it("matches keyrings directories", () => {
            expect(testPath("/home/user/.local/share/keyrings")).toBe(true);
            expect(testPath("/home/user/.local/share/keyrings/login.keyring")).toBe(true);
            expect(testPath("/Users/alice/Library/Keychains/login.keychain-db")).toBe(true);
        });

        it("matches Windows Credentials directories", () => {
            expect(testPath("C:\\Users\\user\\AppData\\Roaming\\Microsoft\\Credentials")).toBe(true);
            expect(testPath("C:\\Users\\user\\AppData\\Local\\Microsoft\\Credentials\\1234")).toBe(true);
        });

        it("matches /etc/gshadow", () => {
            expect(testPath("/etc/gshadow")).toBe(true);
        });
    });

    describe("safe files", () => {
        it("does not match README.md", () => {
            expect(testPath("README.md")).toBe(false);
        });

        it("does not match package.json", () => {
            expect(testPath("package.json")).toBe(false);
        });

        it("does not match index.ts", () => {
            expect(testPath("src/index.ts")).toBe(false);
        });
    });
});

describe("DESTRUCTIVE_COMMAND_PATTERNS", () => {
    const testCommand = (cmd: string) =>
        DESTRUCTIVE_COMMAND_PATTERNS.some((pattern) => {
            pattern.lastIndex = 0;
            return pattern.test(cmd);
        });

    describe("dangerous commands", () => {
        it("matches rm", () => {
            expect(testCommand("rm file.txt")).toBe(true);
        });

        it("matches rm -rf", () => {
            expect(testCommand("rm -rf /")).toBe(true);
        });

        it("matches rmdir", () => {
            expect(testCommand("rmdir folder")).toBe(true);
        });

        it("matches del", () => {
            expect(testCommand("del file.txt")).toBe(true);
        });

        it("matches format", () => {
            expect(testCommand("format C:")).toBe(true);
        });

        it("matches mkfs", () => {
            expect(testCommand("mkfs.ext4 /dev/sda1")).toBe(true);
        });

        it("matches dd if=", () => {
            expect(testCommand("dd if=/dev/zero of=/dev/sda")).toBe(true);
        });
    });

    describe("safe commands", () => {
        it("does not match ls", () => {
            expect(testCommand("ls -la")).toBe(false);
        });

        it("does not match cat", () => {
            expect(testCommand("cat file.txt")).toBe(false);
        });

        it("does not match echo", () => {
            expect(testCommand("echo hello")).toBe(false);
        });

        it("does not match npm", () => {
            expect(testCommand("npm install")).toBe(false);
        });
    });
});

import { mergeConfig } from "../src/config/utils";
import { DEFAULT_CONFIG } from "../src/config/defaults";

describe("mergeConfig - Configuration Resilience", () => {
    it("should return DEFAULT_CONFIG if input is null", () => {
        expect(mergeConfig(null)).toEqual(DEFAULT_CONFIG);
    });

    it("should return DEFAULT_CONFIG if input is not an object", () => {
        expect(mergeConfig("garbage")).toEqual(DEFAULT_CONFIG);
        expect(mergeConfig(123)).toEqual(DEFAULT_CONFIG);
        expect(mergeConfig(undefined)).toEqual(DEFAULT_CONFIG);
    });

    it("should handle case-insensitive layer keys", () => {
        const input = {
            layers: {
                PULP: false,
                Thorn: true
            }
        };
        const config = mergeConfig(input);
        expect(config.layers.pulp).toBe(false);
        expect(config.layers.thorn).toBe(true);
    });

    it("should ignore non-boolean layer values", () => {
        const input = {
            layers: {
                pulp: "yes", // Should be ignored (keep default true)
                thorn: false
            }
        };
        const config = mergeConfig(input);
        expect(config.layers.pulp).toBe(DEFAULT_CONFIG.layers.pulp);
        expect(config.layers.thorn).toBe(false);
    });

    it("should handle invalid mode values by falling back to default", () => {
        const input = { mode: "YOLO" };
        const config = mergeConfig(input);
        expect(config.mode).toBe(DEFAULT_CONFIG.mode);
    });

    it("should filter out non-string paths in sensitiveFilePaths", () => {
        const input = {
            sensitiveFilePaths: [123, "valid.txt", null]
        };
        const config = mergeConfig(input);
        expect(config.sensitiveFilePaths).toEqual(["valid.txt"]);
    });
});
