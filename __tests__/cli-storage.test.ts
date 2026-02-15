import { describe, expect, it, beforeEach, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import {
    loadCustomRules,
    loadCustomRulesSync,
    addCustomRule,
    removeCustomRule,
    getStoragePath,
} from "../src/cli/storage";

// Mock fs/promises module
vi.mock("node:fs/promises", async () => {
    return {
        access: vi.fn(),
        readFile: vi.fn(),
        writeFile: vi.fn(),
        mkdir: vi.fn(),
    };
});

vi.mock("node:fs", async () => {
    return {
        accessSync: vi.fn(),
        readFileSync: vi.fn(),
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
            });
        });

        it("loads rules from existing file", async () => {
            const mockRules = {
                version: "1.0",
                secrets: [{ name: "test", pattern: "test-.*", placeholder: "[TEST]", addedAt: "now" }],
                sensitiveFiles: [],
                destructiveCommands: [],
            };

            vi.mocked(fs.access).mockResolvedValue(undefined); // File exists
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockRules));

            const rules = await loadCustomRules();

            expect(rules).toEqual(mockRules);
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
            });
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
            });
        });

        it("loads rules from existing file", () => {
            const mockRules = {
                version: "1.0",
                secrets: [{ name: "sync-test", pattern: "test-.*", placeholder: "[TEST]", addedAt: "now" }],
                sensitiveFiles: [],
                destructiveCommands: [],
            };

            vi.mocked(fsSync.accessSync).mockImplementation(() => undefined);
            vi.mocked(fsSync.readFileSync).mockReturnValue(JSON.stringify(mockRules));

            const rules = loadCustomRulesSync();

            expect(rules).toEqual(mockRules);
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
            };

            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingRules));

            const result = await removeCustomRule("non-existent");

            expect(result.success).toBe(true);
            expect(result.removed).toBe(false);
            expect(fs.writeFile).not.toHaveBeenCalled();
        });
    });
});
