import { describe, it, expect } from "vitest";
import { PLUGIN_ID, ENV_VARS, CONFIG_PATHS, DEFAULTS, BRAND_SYMBOL, VERSION, HOOKS, REQUIRED_SECURITY_HOOKS, AUDIT_HOOKS, COMPAT_POLICY, AUDIT_DECISIONS, SECURITY_LAYERS } from "../src/constants";
import { DEFAULT_CONFIG } from "../src/config/defaults";

/**
 * Expected version for contract testing.
 * This is updated automatically by scripts/update-version.ts during releases.
 */
const EXPECTED_VERSION = "2026.2.15";

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

    it("should have stable core hook names", () => {
        expect(HOOKS.BEFORE_AGENT_START).toBe("before_agent_start");
        expect(HOOKS.MESSAGE_RECEIVED).toBe("message_received");
        expect(HOOKS.MESSAGE_SENDING).toBe("message_sending");
        expect(HOOKS.BEFORE_TOOL_CALL).toBe("before_tool_call");
        expect(HOOKS.AFTER_TOOL_CALL).toBe("after_tool_call");
        expect(HOOKS.TOOL_RESULT_PERSIST).toBe("tool_result_persist");
    });

    it("should keep required security hooks list synchronized", () => {
        expect(REQUIRED_SECURITY_HOOKS).toEqual([
            "before_agent_start",
            "message_sending",
            "before_tool_call",
            "tool_result_persist",
        ]);
    });

    it("should keep audit hooks list synchronized", () => {
        expect(AUDIT_HOOKS).toEqual([
            "message_received",
        ]);
    });

    it("should keep compatibility policy constants stable", () => {
        expect(COMPAT_POLICY.MIN_OPENCLAW_VERSION).toBe("2026.2.3-1");
        expect(COMPAT_POLICY.PEER_RANGE).toBe("^2026.2.3-1");
    });

    describe("Security Standards (Safe-by-Default)", () => {
        it("should always have 'enforce' as the default mode", () => {
            expect(DEFAULT_CONFIG.mode).toBe("enforce");
        });

        it("should have all layers active in DEFAULT_CONFIG", () => {
            expect(DEFAULT_CONFIG.layers.pulp).toBe(true);
            expect(DEFAULT_CONFIG.layers.thorn).toBe(true);
            expect(DEFAULT_CONFIG.layers.stem).toBe(true);
            expect(DEFAULT_CONFIG.layers.leaf).toBe(true);
            expect(DEFAULT_CONFIG.layers.root).toBe(true);
            expect(DEFAULT_CONFIG.layers.vine).toBe(true);
        });
    });

    it("should have stable audit decision labels", () => {
        expect(AUDIT_DECISIONS.WOULD_BLOCK).toBe("would_block");
        expect(AUDIT_DECISIONS.WOULD_REDACT).toBe("would_redact");
        expect(AUDIT_DECISIONS.BLOCKED).toBe("blocked");
        expect(AUDIT_DECISIONS.REDACTED).toBe("redacted");
    });

    it("should have stable security layer identifiers", () => {
        expect(SECURITY_LAYERS.STEM).toBe("stem");
        expect(SECURITY_LAYERS.PULP).toBe("pulp");
        expect(SECURITY_LAYERS.THORN).toBe("thorn");
        expect(SECURITY_LAYERS.VINE).toBe("vine");
    });
});
