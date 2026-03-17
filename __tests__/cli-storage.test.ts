import { describe, expect, it, beforeEach, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import {
    loadCustomRules,
    loadCustomRulesSync,
    addCustomRule,
    removeCustomRule,
    ensureRulesDeltaSync,
    disableBuiltInRule,
    restoreBuiltInRule,
    getStoragePath,
} from "../src/cli/storage";

// Mock fs/promises module
vi.mock("node:fs/promises", async () => {
    return {
        access: vi.fn(),
        readFile: vi.fn(),
        writeFile: vi.fn(),
        mkdir: vi.fn(),
        rename: vi.fn(),
        unlink: vi.fn(),
    };
});

vi.mock("node:fs", async () => {
    return {
        existsSync: vi.fn(),
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
        accessSync: vi.fn(),
        readFileSync: vi.fn(),
        renameSync: vi.fn(),
        unlinkSync: vi.fn(),
    };
});

// Mock os module
vi.mock("node:os", async () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const actual = await vi.importActual<typeof import("node:os")>("node:os");
    return {
        ...actual,
        homedir: vi.fn().mockReturnValue("/home/testuser"),
    };
});

describe("CLI Storage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fsSync.existsSync).mockReturnValue(false);
        vi.mocked(fsSync.mkdirSync).mockImplementation(() => undefined);
        vi.mocked(fsSync.writeFileSync).mockImplementation(() => undefined);
        vi.mocked(fsSync.renameSync).mockImplementation(() => undefined);
        vi.mocked(fsSync.unlinkSync).mockImplementation(() => undefined);
        vi.mocked(fs.rename).mockResolvedValue(undefined);
        vi.mocked(fs.unlink).mockResolvedValue(undefined);
    });

    describe("getStoragePath", () => {
        it("returns path in homedir", () => {
            const storagePath = getStoragePath();
            // Should contain .openclaw/config/berry-shield because of implementation
            expect(storagePath).toContain(path.join(".openclaw", "config", "berry-shield"));
            expect(storagePath).toContain("custom-rules.json");
        });
    });

    describe("loadCustomRules", () => {
        it("returns empty rules when file does not exist", async () => {
            // fs.access throws if file doesn't exist
            const enoentError = new Error("ENOENT");
            (enoentError as any).code = "ENOENT";
            vi.mocked(fs.access).mockRejectedValue(enoentError);

            const rules = await loadCustomRules();

            expect(rules).toEqual({
                version: "1.0",
                secrets: [],
                sensitiveFiles: [],
                destructiveCommands: [],
                disabledBuiltInIds: [],
            });
        });

        it("loads rules from existing file", async () => {
            const mockRules = {
                version: "1.0",
                secrets: [{ name: "test", pattern: "test-.*", placeholder: "[TEST]", addedAt: "now" }],
                sensitiveFiles: [],
                destructiveCommands: [],
                disabledBuiltInIds: [],
            };

            vi.mocked(fs.access).mockResolvedValue(undefined); // File exists
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockRules));

            const rules = await loadCustomRules();

            expect(rules).toEqual(mockRules);
        });

        it("remaps disabledBuiltInIds aliases on async load", async () => {
            const mockRules = {
                version: "1.0",
                secrets: [],
                sensitiveFiles: [],
                destructiveCommands: [],
                disabledBuiltInIds: ["secret:gitleaks:gitlab-runner-token"],
            };

            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockRules));

            const rules = await loadCustomRules();

            expect(rules.disabledBuiltInIds).toEqual(["gitleaks:secret:gitlab-runner-authentication-token"]);
        });

        it("returns empty rules on parse error", async () => {
            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.readFile).mockResolvedValue("invalid json");

            const rules = await loadCustomRules();

            expect(rules).toEqual({
                version: "1.0",
                secrets: [],
                sensitiveFiles: [],
                destructiveCommands: [],
                disabledBuiltInIds: [],
            });
        });

        it("backs up corrupted file and restores defaults on parse error", async () => {
            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.readFile).mockResolvedValue("invalid json");

            await loadCustomRules();

            expect(fs.rename).toHaveBeenCalled();
            expect(fs.writeFile).toHaveBeenCalled();
        });
    });

    describe("loadCustomRulesSync", () => {
        it("returns empty rules when file does not exist", () => {
            const enoentError = new Error("ENOENT");
            Object.assign(enoentError, { code: "ENOENT" });
            vi.mocked(fsSync.accessSync).mockImplementation(() => {
                throw enoentError;
            });

            const rules = loadCustomRulesSync();

            expect(rules).toEqual({
                version: "1.0",
                secrets: [],
                sensitiveFiles: [],
                destructiveCommands: [],
                disabledBuiltInIds: [],
            });
        });

        it("loads rules from existing file", () => {
            const mockRules = {
                version: "1.0",
                secrets: [{ name: "sync-test", pattern: "test-.*", placeholder: "[TEST]", addedAt: "now" }],
                sensitiveFiles: [],
                destructiveCommands: [],
                disabledBuiltInIds: [],
            };

            vi.mocked(fsSync.accessSync).mockImplementation(() => undefined);
            vi.mocked(fsSync.readFileSync).mockReturnValue(JSON.stringify(mockRules));

            const rules = loadCustomRulesSync();

            expect(rules).toEqual(mockRules);
        });

        it("remaps disabledBuiltInIds aliases on sync load", () => {
            const mockRules = {
                version: "1.0",
                secrets: [],
                sensitiveFiles: [],
                destructiveCommands: [],
                disabledBuiltInIds: ["secret:gitleaks:gitlab-runner-token"],
            };

            vi.mocked(fsSync.accessSync).mockImplementation(() => undefined);
            vi.mocked(fsSync.readFileSync).mockReturnValue(JSON.stringify(mockRules));

            const rules = loadCustomRulesSync();

            expect(rules.disabledBuiltInIds).toEqual(["gitleaks:secret:gitlab-runner-authentication-token"]);
        });

        it("backs up corrupted file and restores defaults on parse error", () => {
            vi.mocked(fsSync.accessSync).mockImplementation(() => undefined);
            vi.mocked(fsSync.readFileSync).mockReturnValue("invalid json");

            const rules = loadCustomRulesSync();

            expect(rules.disabledBuiltInIds).toEqual([]);
            expect(fsSync.renameSync).toHaveBeenCalled();
            expect(fsSync.writeFileSync).toHaveBeenCalled();
        });
    });

    describe("ensureRulesDeltaSync", () => {
        it("creates custom-rules.json with disabledBuiltInIds when file does not exist", () => {
            vi.mocked(fsSync.existsSync).mockReturnValue(false);

            ensureRulesDeltaSync();

            expect(fsSync.mkdirSync).toHaveBeenCalled();
            expect(fsSync.writeFileSync).toHaveBeenCalledTimes(1);
            const payload = vi.mocked(fsSync.writeFileSync).mock.calls[0][1] as string;
            const parsed = JSON.parse(payload);
            expect(parsed.disabledBuiltInIds).toEqual([]);
        });

        it("patches legacy file missing disabledBuiltInIds", () => {
            vi.mocked(fsSync.existsSync).mockReturnValue(true);
            vi.mocked(fsSync.readFileSync).mockReturnValue(JSON.stringify({
                version: "1.0",
                secrets: [],
                sensitiveFiles: [],
                destructiveCommands: [],
            }));

            ensureRulesDeltaSync();

            expect(fsSync.writeFileSync).toHaveBeenCalledTimes(1);
            const payload = vi.mocked(fsSync.writeFileSync).mock.calls[0][1] as string;
            const parsed = JSON.parse(payload);
            expect(parsed.disabledBuiltInIds).toEqual([]);
        });

        it("does not rewrite file when already normalized", () => {
            const normalized = JSON.stringify({
                version: "1.0",
                secrets: [],
                sensitiveFiles: [],
                destructiveCommands: [],
                disabledBuiltInIds: [],
            }, null, 2);
            vi.mocked(fsSync.existsSync).mockReturnValue(true);
            vi.mocked(fsSync.readFileSync).mockReturnValue(normalized);

            ensureRulesDeltaSync();

            expect(fsSync.writeFileSync).not.toHaveBeenCalled();
        });
    });

    describe("addCustomRule", () => {
        it("adds secret rule successfully", async () => {
            // First load fails (file not found), so starts with empty rules
            const enoentError = new Error("ENOENT");
            (enoentError as any).code = "ENOENT";
            vi.mocked(fs.access).mockRejectedValue(enoentError);

            vi.mocked(fs.writeFile).mockResolvedValue(undefined);
            vi.mocked(fs.mkdir).mockResolvedValue(undefined);

            const result = await addCustomRule("secret", {
                name: "WhatsApp Secret",
                pattern: "whsec_[a-zA-Z0-9]{32}",
                placeholder: "[WHATSAPP_REDACTED]",
            });

            expect(result.success).toBe(true);
            expect(fs.writeFile).toHaveBeenCalled();

            const callArgs = vi.mocked(fs.writeFile).mock.calls[0];
            const content = JSON.parse(callArgs[1] as string);
            expect(content.secrets).toHaveLength(1);
            expect(content.secrets[0].name).toBe("WhatsApp Secret");
        });

        it("fails for invalid regex", async () => {
            const result = await addCustomRule("secret", {
                name: "Bad Pattern",
                pattern: "[invalid(regex",
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain("Invalid regex");
        });

        it("fails for duplicate name without force", async () => {
            const existingRules = {
                version: "1.0",
                secrets: [{ name: "existing", pattern: "test.*", placeholder: "[TEST]", addedAt: "now" }],
                sensitiveFiles: [],
                destructiveCommands: [],
                disabledBuiltInIds: [],
            };

            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingRules));

            const result = await addCustomRule("secret", {
                name: "existing",
                pattern: "new-pattern",
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain("already exists");
        });

        it("overwrites duplicate with force flag", async () => {
            const existingRules = {
                version: "1.0",
                secrets: [{ name: "existing", pattern: "test.*", placeholder: "[TEST]", addedAt: "now" }],
                sensitiveFiles: [],
                destructiveCommands: [],
                disabledBuiltInIds: [],
            };

            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingRules));
            vi.mocked(fs.writeFile).mockResolvedValue(undefined);

            const result = await addCustomRule("secret", {
                name: "existing",
                pattern: "new-pattern",
                force: true,
            });

            expect(result.success).toBe(true);

            const callArgs = vi.mocked(fs.writeFile).mock.calls[0];
            const content = JSON.parse(callArgs[1] as string);
            expect(content.secrets).toHaveLength(1);
            expect(content.secrets[0].pattern).toBe("new-pattern");
        });
    });

    describe("removeCustomRule", () => {
        it("removes existing rule", async () => {
            const existingRules = {
                version: "1.0",
                secrets: [{ name: "to-remove", pattern: "test.*", placeholder: "[TEST]", addedAt: "now" }],
                sensitiveFiles: [],
                destructiveCommands: [],
                disabledBuiltInIds: [],
            };

            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingRules));
            vi.mocked(fs.writeFile).mockResolvedValue(undefined);

            const result = await removeCustomRule("to-remove");

            expect(result.success).toBe(true);
            expect(result.removed).toBe(true);
            expect(result.type).toBe("secret");

            const callArgs = vi.mocked(fs.writeFile).mock.calls[0];
            const content = JSON.parse(callArgs[1] as string);
            expect(content.secrets).toHaveLength(0);
        });

        it("reports not found for non-existent rule", async () => {
            const existingRules = {
                version: "1.0",
                secrets: [],
                sensitiveFiles: [],
                destructiveCommands: [],
                disabledBuiltInIds: [],
            };

            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingRules));

            const result = await removeCustomRule("non-existent");

            expect(result.success).toBe(true);
            expect(result.removed).toBe(false);
            expect(fs.writeFile).not.toHaveBeenCalled();
        });
    });

    describe("built-in diff-state controls", () => {
        it("disables a known built-in id (case-insensitive) and persists normalized id", async () => {
            const existingRules = {
                version: "1.0",
                secrets: [],
                sensitiveFiles: [],
                destructiveCommands: [],
                disabledBuiltInIds: [],
            };

            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingRules));
            vi.mocked(fs.writeFile).mockResolvedValue(undefined);

            const result = await disableBuiltInRule("BeRrY:SeCrEt:OpEnAi-Key");

            expect(result.success).toBe(true);
            expect(fs.writeFile).toHaveBeenCalledTimes(1);
            const content = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string);
            expect(content.disabledBuiltInIds).toContain("berry:secret:openai-key");
        });

        it("rejects unknown built-in id", async () => {
            const existingRules = {
                version: "1.0",
                secrets: [],
                sensitiveFiles: [],
                destructiveCommands: [],
                disabledBuiltInIds: [],
            };

            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingRules));

            const result = await disableBuiltInRule("secret:does-not-exist");

            expect(result.success).toBe(false);
            expect(result.error).toContain("Unknown baseline rule id");
            expect(fs.writeFile).not.toHaveBeenCalled();
        });

        it("does not duplicate disable when id already exists", async () => {
            const existingRules = {
                version: "1.0",
                secrets: [],
                sensitiveFiles: [],
                destructiveCommands: [],
                disabledBuiltInIds: ["berry:secret:openai-key"],
            };

            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingRules));

            const result = await disableBuiltInRule("berry:secret:openai-key");

            expect(result.success).toBe(false);
            expect(result.error).toContain("already disabled");
            expect(fs.writeFile).not.toHaveBeenCalled();
        });

        it("restores disabled built-in id (case-insensitive)", async () => {
            const existingRules = {
                version: "1.0",
                secrets: [],
                sensitiveFiles: [],
                destructiveCommands: [],
                disabledBuiltInIds: ["berry:secret:openai-key"],
            };

            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingRules));
            vi.mocked(fs.writeFile).mockResolvedValue(undefined);

            const result = await restoreBuiltInRule("BeRrY:SeCrEt:OpEnAi-Key");

            expect(result.success).toBe(true);
            expect(result.restored).toBe(true);
            expect(fs.writeFile).toHaveBeenCalledTimes(1);
            const content = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string);
            expect(content.disabledBuiltInIds).toEqual([]);
        });

        it("is idempotent when restoring a non-disabled id", async () => {
            const existingRules = {
                version: "1.0",
                secrets: [],
                sensitiveFiles: [],
                destructiveCommands: [],
                disabledBuiltInIds: [],
            };

            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingRules));

            const result = await restoreBuiltInRule("berry:secret:openai-key");

            expect(result.success).toBe(true);
            expect(result.restored).toBe(false);
            expect(fs.writeFile).not.toHaveBeenCalled();
        });
    });
});
