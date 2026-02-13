import { describe, it, expect } from "vitest";
import { PLUGIN_ID, ENV_VARS, CONFIG_PATHS, DEFAULTS, BRAND_SYMBOL, VERSION } from "../src/constants";

/**
 * Expected version for contract testing.
 * This is updated automatically by scripts/update-version.ts during releases.
 */
const EXPECTED_VERSION = "2026.2.12";

/**
 * Contract Test for Constants
 * 
 * This test uses hardcoded strings to ensure that the constants in src/constants.ts
 * are NOT accidentally moved or modified. This is a "safety net" against 
 * keyboard slips that could break the integration with OpenClaw.
 */
describe("Constants Contract", () => {

    it("should have the correct PLUGIN_ID", () => {
        expect(PLUGIN_ID).toBe("berry-shield");
    });

    it("should have the correct BRAND_SYMBOL", () => {
        expect(BRAND_SYMBOL).toBe("🍓");
    });

    it("should have the correct version (CalVer)", () => {
        expect(VERSION).toBe(EXPECTED_VERSION);
    });

    it("should have the correct Environment Variable names", () => {
        expect(ENV_VARS.OPENCLAW_BIN).toBe("OPENCLAW_BIN");
        expect(ENV_VARS.OPENCLAW_EXECUTABLE).toBe("OPENCLAW_EXECUTABLE");
    });

    it("should have the correct OpenClaw JSON paths", () => {
        expect(CONFIG_PATHS.PLUGIN_ROOT).toBe("plugins.entries.berry-shield");
        expect(CONFIG_PATHS.PLUGIN_CONFIG).toBe("plugins.entries.berry-shield.config");
        expect(CONFIG_PATHS.ENABLED).toBe("plugins.entries.berry-shield.enabled");
    });

    it("should have the correct default binary names", () => {
        expect(DEFAULTS.BINARY_NAME).toBe("openclaw");
        expect(DEFAULTS.WIN_BINARY_EXT).toBe(".cmd");
    });

});
