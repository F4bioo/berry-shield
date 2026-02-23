import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigWrapper } from "../src/config/wrapper";
import {
    addCustomRuleToConfig,
    loadCustomRulesFromConfig,
    removeCustomRuleFromConfig,
    saveCustomRulesToConfig,
} from "../src/cli/custom-rules-config";

function createWrapper(initialConfig: unknown): ConfigWrapper {
    let state = initialConfig as any;
    return {
        get: vi.fn(async () => state),
        set: vi.fn(async (_path: string, value: unknown) => {
            state = { ...(state ?? {}), customRules: value };
        }),
    } as unknown as ConfigWrapper;
}

describe("custom-rules-config", () => {
    const emptyConfig = {
        customRules: {
            secrets: [],
            sensitiveFiles: [],
            destructiveCommands: [],
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("loads custom rules from plugin config", async () => {
        const wrapper = createWrapper(emptyConfig);
        const customRules = await loadCustomRulesFromConfig(wrapper);
        expect(customRules.secrets).toEqual([]);
        expect(customRules.sensitiveFiles).toEqual([]);
        expect(customRules.destructiveCommands).toEqual([]);
    });

    it("adds a secret rule and persists to config", async () => {
        const wrapper = createWrapper(emptyConfig);
        const result = await addCustomRuleToConfig(wrapper, "secret", {
            name: "HotTest",
            pattern: "HOT_[A-Z0-9]{12}",
            placeholder: "[HOT_REDACTED]",
        });

        expect(result.success).toBe(true);
        const saved = await loadCustomRulesFromConfig(wrapper);
        expect(saved.secrets).toHaveLength(1);
        expect(saved.secrets[0].name).toBe("HotTest");
    });

    it("rejects invalid regex pattern", async () => {
        const wrapper = createWrapper(emptyConfig);
        const result = await addCustomRuleToConfig(wrapper, "file", {
            pattern: "[broken-regex",
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain("Invalid regex pattern");
    });

    it("requires name for file and command rules", async () => {
        const wrapper = createWrapper(emptyConfig);
        const fileResult = await addCustomRuleToConfig(wrapper, "file", {
            pattern: "/tmp/file.txt",
        });
        const commandResult = await addCustomRuleToConfig(wrapper, "command", {
            pattern: "rm -rf /tmp/smoke",
        });

        expect(fileResult.success).toBe(false);
        expect(fileResult.error).toContain("File rules require a name");
        expect(commandResult.success).toBe(false);
        expect(commandResult.error).toContain("Command rules require a name");
    });

    it("overwrites file rule by name with force", async () => {
        const wrapper = createWrapper({
            customRules: {
                secrets: [],
                sensitiveFiles: [{ name: "team-key", pattern: "/srv/keys/old.key" }],
                destructiveCommands: [],
            },
        });

        const result = await addCustomRuleToConfig(wrapper, "file", {
            name: "team-key",
            pattern: "/srv/keys/new.key",
            force: true,
        });

        expect(result.success).toBe(true);
        const saved = await loadCustomRulesFromConfig(wrapper);
        expect(saved.sensitiveFiles).toHaveLength(1);
        expect(saved.sensitiveFiles[0].name).toBe("team-key");
        expect(saved.sensitiveFiles[0].pattern).toBe("/srv/keys/new.key");
    });

    it("removes custom rule by name", async () => {
        const wrapper = createWrapper({
            customRules: {
                secrets: [{ name: "HotTest", pattern: "HOT_[A-Z0-9]{12}", placeholder: "[HOT_REDACTED]" }],
                sensitiveFiles: [],
                destructiveCommands: [],
            },
        });

        const result = await removeCustomRuleFromConfig(wrapper, "HotTest");
        expect(result.success).toBe(true);
        expect(result.removed).toBe(true);
        expect(result.type).toBe("secret");
    });

    it("enforces max list size on save", async () => {
        const wrapper = createWrapper(emptyConfig);
        const oversized = {
            secrets: Array.from({ length: 501 }, (_, idx) => ({
                name: `S-${idx}`,
                pattern: "S_[A-Z0-9]{4}",
                placeholder: "[S_REDACTED]",
            })),
            sensitiveFiles: [],
            destructiveCommands: [],
        };

        await expect(saveCustomRulesToConfig(wrapper, oversized)).rejects.toThrow("maximum of 500");
    });
});
