import { describe, expect, it, beforeEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
    loadCustomRules,
    addCustomRule,
    removeCustomRule,
    getStoragePath,
} from "../src/cli/storage";

// Mock fs module
vi.mock("node:fs", async () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
    return {
        ...actual,
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
        mkdirSync: vi.fn(),
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
        it("returns empty rules when file does not exist", () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const rules = loadCustomRules();

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
                secrets: [{ name: "test", pattern: "test-.*", placeholder: "[TEST]", addedAt: "now" }],
                sensitiveFiles: [],
                destructiveCommands: [],
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockRules));

            const rules = loadCustomRules();

            expect(rules).toEqual(mockRules);
        });

        it("returns empty rules on parse error", () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue("invalid json");

            const rules = loadCustomRules();

            expect(rules).toEqual({
                version: "1.0",
                secrets: [],
                sensitiveFiles: [],
                destructiveCommands: [],
            });
        });
    });

    describe("addCustomRule", () => {
        it("adds secret rule successfully", () => {
            vi.mocked(fs.existsSync).mockReturnValue(false); // file doesn't exist yet (first run)
            vi.mocked(fs.writeFileSync).mockImplementation(() => { });
            vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

            const result = addCustomRule("secret", {
                name: "WhatsApp Secret",
                pattern: "whsec_[a-zA-Z0-9]{32}",
                placeholder: "[WHATSAPP_REDACTED]",
            });

            expect(result.success).toBe(true);
            expect(fs.writeFileSync).toHaveBeenCalled();

            const callArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
            const content = JSON.parse(callArgs[1] as string);
            expect(content.secrets).toHaveLength(1);
            expect(content.secrets[0].name).toBe("WhatsApp Secret");
        });

        it("fails for invalid regex", () => {
            const result = addCustomRule("secret", {
                name: "Bad Pattern",
                pattern: "[invalid(regex",
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain("Invalid regex");
        });

        it("fails for duplicate name without force", () => {
            const existingRules = {
                version: "1.0",
                secrets: [{ name: "existing", pattern: "test.*", placeholder: "[TEST]", addedAt: "now" }],
                sensitiveFiles: [],
                destructiveCommands: [],
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingRules));

            const result = addCustomRule("secret", {
                name: "existing",
                pattern: "new-pattern",
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain("already exists");
        });

        it("overwrites duplicate with force flag", () => {
            const existingRules = {
                version: "1.0",
                secrets: [{ name: "existing", pattern: "test.*", placeholder: "[TEST]", addedAt: "now" }],
                sensitiveFiles: [],
                destructiveCommands: [],
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingRules));
            vi.mocked(fs.writeFileSync).mockImplementation(() => { });

            const result = addCustomRule("secret", {
                name: "existing",
                pattern: "new-pattern",
                force: true,
            });

            expect(result.success).toBe(true);

            const callArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
            const content = JSON.parse(callArgs[1] as string);
            expect(content.secrets).toHaveLength(1);
            expect(content.secrets[0].pattern).toBe("new-pattern");
        });
    });

    describe("removeCustomRule", () => {
        it("removes existing rule", () => {
            const existingRules = {
                version: "1.0",
                secrets: [{ name: "to-remove", pattern: "test.*", placeholder: "[TEST]", addedAt: "now" }],
                sensitiveFiles: [],
                destructiveCommands: [],
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingRules));
            vi.mocked(fs.writeFileSync).mockImplementation(() => { });

            const result = removeCustomRule("to-remove");

            expect(result.success).toBe(true);
            expect(result.removed).toBe(true);
            expect(result.type).toBe("secret");

            const callArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
            const content = JSON.parse(callArgs[1] as string);
            expect(content.secrets).toHaveLength(0);
        });

        it("reports not found for non-existent rule", () => {
            const existingRules = {
                version: "1.0",
                secrets: [],
                sensitiveFiles: [],
                destructiveCommands: [],
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingRules));

            const result = removeCustomRule("non-existent");

            expect(result.success).toBe(true);
            expect(result.removed).toBe(false);
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });
    });
});
