import { describe, it, expect } from "vitest";
import { redactString } from "../src/utils/redaction";
import { INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS } from "../src/patterns/extended";

// Helper to get Berry destructives for testing
const BERRY_DESTRUCTIVE = INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS;

describe("Phase 3: Destructive Commands (Sniper Redaction)", () => {

    describe("Group A: Filesystem Sniper", () => {
        it("should redact 'rm -rf' with sudo context", () => {
            const input = "CRITICAL: sudo rm -rf /var/log/nginx";
            const result = redactString(input, BERRY_DESTRUCTIVE as any);

            expect(result.redactionCount).toBe(1);
            expect(result.content).toMatch(/\[BERRY:COMMAND_FILESYSTEM_RM#[A-F0-9]{6}\]/);
            expect(result.content).not.toContain("rm");
        });

        it("should NOT redact 'rm' in a harmless chat sentence", () => {
            const input = "Hey, can you please rm that old file from the folder?";
            const result = redactString(input, BERRY_DESTRUCTIVE as any);

            expect(result.redactionCount).toBe(0);
            expect(result.content).toBe(input);
        });

        it("should redact 'dd' with disk context (sda/sdb)", () => {
            const input = "dd if=/dev/zero of=/dev/sda bs=1M";
            const result = redactString(input, BERRY_DESTRUCTIVE as any);

            expect(result.redactionCount).toBe(1);
            expect(result.content).toMatch(/\[BERRY:COMMAND_FS_DISK#[A-F0-9]{6}\]/);
        });

        it("should redact 'format' when disk keywords are nearby", () => {
            const input = "Wait! Don't format the disk nvme0n1";
            const result = redactString(input, BERRY_DESTRUCTIVE as any);

            expect(result.redactionCount).toBe(1);
            expect(result.content).toMatch(/\[BERRY:COMMAND_FS_DISK#[A-F0-9]{6}\]/);
        });
    });

    describe("Group B: Database Sniper", () => {
        it("should redact 'DROP DATABASE' with SQL context", () => {
            const input = "Executing query: DROP DATABASE production_db;";
            const result = redactString(input, BERRY_DESTRUCTIVE as any);

            expect(result.redactionCount).toBe(1);
            expect(result.content).toMatch(/\[BERRY:COMMAND_DB_DESTRUCTIVE#[A-F0-9]{6}\]/);
        });

        it("should NOT redact 'drop' as a common English verb", () => {
            const input = "Be careful not to drop the server while moving it.";
            const result = redactString(input, BERRY_DESTRUCTIVE as any);

            expect(result.redactionCount).toBe(0);
            expect(result.content).toBe(input);
        });
    });

    describe("Group C & D: DevOps & Git Force", () => {
        it("should redact 'kubectl delete' with cluster context", () => {
            const input = "kubectl delete namespace production --force";
            const result = redactString(input, BERRY_DESTRUCTIVE as any);

            expect(result.redactionCount).toBe(1);
            expect(result.content).toMatch(/\[BERRY:COMMAND_DEVOPS_K8S#[A-F0-9]{6}\]/);
        });

        it("should redact 'git push --force' with branch context", () => {
            const input = "git push origin master --force";
            const result = redactString(input, BERRY_DESTRUCTIVE as any);

            expect(result.redactionCount).toBe(1);
            expect(result.content).toMatch(/\[BERRY:COMMAND_GIT_FORCE#[A-F0-9]{6}\]/);
        });

        it("should redact self-contained dangerous commands (chmod 777)", () => {
            const input = "chmod 777 /etc/shadow";
            const result = redactString(input, BERRY_DESTRUCTIVE as any);

            expect(result.redactionCount).toBe(1);
            expect(result.content).toMatch(/\[BERRY:COMMAND_PERMISSIONS_777#[A-F0-9]{6}\]/);
        });
    });

    describe("Edge Cases & Evasion", () => {
        it("should handle mixed case commands like 'Rm -RF'", () => {
            const input = "Rm -RF /tmp/test";
            const result = redactString(input, BERRY_DESTRUCTIVE as any);

            expect(result.redactionCount).toBe(1);
            expect(result.content).toMatch(/\[BERRY:COMMAND_FILESYSTEM_RM#[A-F0-9]{6}\]/);
        });

        it("should respect small context windows for 'stop'", () => {
            const input = "The service will stop now."; // Inoffensive
            const result = redactString(input, BERRY_DESTRUCTIVE as any);
            expect(result.redactionCount).toBe(0);

            const dangerous = "sudo systemctl stop firewall"; // Dangerous
            const result2 = redactString(dangerous, BERRY_DESTRUCTIVE as any);
            expect(result2.redactionCount).toBe(1);
            expect(result2.content).toMatch(/\[BERRY:COMMAND_SYS_NETWORK#[A-F0-9]{6}\]/);
        });
    });
});
