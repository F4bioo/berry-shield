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
