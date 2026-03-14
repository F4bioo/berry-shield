import { describe, it, expect } from "vitest";
import { PLUGIN_ID, ENV_VARS, CONFIG_PATHS, DEFAULTS, BRAND_SYMBOL, VERSION, HOOKS, REQUIRED_SECURITY_HOOKS, AUDIT_HOOKS, COMPAT_POLICY, AUDIT_DECISIONS, SECURITY_LAYERS, VINE_CONFIRMATION, VINE_CONFIRMATION_STRATEGY } from "../src/constants";
import { DEFAULT_CONFIG } from "../src/config/defaults";
import { readFileSync } from "node:fs";

const EXPECTED_HOOKS = {
    BEFORE_AGENT_START: "before_agent_start",
    BEFORE_MESSAGE_WRITE: "before_message_write",
    MESSAGE_RECEIVED: "message_received",
    MESSAGE_SENDING: "message_sending",
    BEFORE_TOOL_CALL: "before_tool_call",
    AFTER_TOOL_CALL: "after_tool_call",
    TOOL_RESULT_PERSIST: "tool_result_persist",
    SESSION_END: "session_end",
} as const;

/**
 * Version contract:
 * - src/constants.ts (VERSION)
 * - package.json
 * - openclaw.plugin.json
 */
const PACKAGE_VERSION = JSON.parse(readFileSync("package.json", "utf8")).version;
const PLUGIN_MANIFEST_VERSION = JSON.parse(readFileSync("openclaw.plugin.json", "utf8")).version;

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
        expect(VERSION).toBe(PACKAGE_VERSION);
        expect(VERSION).toBe(PLUGIN_MANIFEST_VERSION);
        expect(PACKAGE_VERSION).toBe(PLUGIN_MANIFEST_VERSION);
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
        expect(HOOKS).toEqual(EXPECTED_HOOKS);
        expect(
            Object.keys(HOOKS).sort(),
            "New hook added to HOOKS but tests were not updated. Review constants-contract.test.ts."
        ).toEqual(Object.keys(EXPECTED_HOOKS).sort());
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
        expect(COMPAT_POLICY.MIN_OPENCLAW_VERSION).toBe("2026.2.23");
        expect(COMPAT_POLICY.PEER_RANGE).toBe("^2026.2.23");
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
        expect(AUDIT_DECISIONS.CONFIRM_REQUIRED).toBe("confirm_required");
        expect(AUDIT_DECISIONS.WOULD_CONFIRM_REQUIRED).toBe("would_confirm_required");
        expect(AUDIT_DECISIONS.ALLOWED_BY_CONFIRM).toBe("allowed_by_confirm");
    });

    it("should have stable security layer identifiers", () => {
        expect(SECURITY_LAYERS.STEM).toBe("stem");
        expect(SECURITY_LAYERS.PULP).toBe("pulp");
        expect(SECURITY_LAYERS.THORN).toBe("thorn");
        expect(SECURITY_LAYERS.VINE).toBe("vine");
    });

    it("should have stable vine confirmation strategy labels", () => {
        expect(VINE_CONFIRMATION_STRATEGY.ONE_TO_ONE).toBe("one_to_one");
        expect(VINE_CONFIRMATION_STRATEGY.ONE_TO_MANY).toBe("one_to_many");
    });

    it("should keep configurable Vine confirmation defaults out of constants.ts", () => {
        expect("TTL_SECONDS" in VINE_CONFIRMATION).toBe(false);
        expect("MAX_ATTEMPTS" in VINE_CONFIRMATION).toBe(false);
        expect(VINE_CONFIRMATION.CODE_LENGTH).toBe(4);
        expect(VINE_CONFIRMATION.CLEANUP_INTERVAL_MS).toBe(30_000);
    });
});
