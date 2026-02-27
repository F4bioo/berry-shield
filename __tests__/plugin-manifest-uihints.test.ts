import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("plugin manifest uiHints contract", () => {
    it("defines secret field sensitivity overrides for web config rendering", () => {
        const manifestPath = resolve(process.cwd(), "openclaw.plugin.json");
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
            uiHints?: Record<string, { sensitive?: boolean }>;
        };

        expect(manifest.uiHints).toBeDefined();
        expect(manifest.uiHints?.["customRules.secrets[].name"]?.sensitive).toBe(false);
        expect(manifest.uiHints?.["customRules.secrets[].pattern"]?.sensitive).toBe(true);
        expect(manifest.uiHints?.["customRules.secrets[].placeholder"]?.sensitive).toBe(false);
        expect(manifest.uiHints?.["customRules.secrets[].enabled"]?.sensitive).toBe(false);
    });
});

