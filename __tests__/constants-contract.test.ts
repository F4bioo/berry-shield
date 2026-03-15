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
const ROOT_PACKAGE_JSON = JSON.parse(readFileSync("package.json", "utf8")) as {
    engines?: Record<string, string>;
    scripts?: Record<string, string>;
};
const OPENCLAW_PACKAGE_JSON = JSON.parse(readFileSync("node_modules/openclaw/package.json", "utf8")) as {
    engines?: Record<string, string>;
};

function parseMinimumNodeEngine(range: string): [number, number, number] {
    const match = /^>=(\d+)\.(\d+)\.(\d+)$/.exec(range.trim());
    if (!match) {
        throw new Error(`Unsupported node engine range: ${range}`);
    }

    return [
        Number(match[1]),
        Number(match[2]),
        Number(match[3]),
    ];
}

function compareTriples(a: [number, number, number], b: [number, number, number]): number {
    for (let i = 0; i < 3; i += 1) {
        if (a[i] > b[i]) return 1;
        if (a[i] < b[i]) return -1;
    }

    return 0;
}

function parseBuildTargetNodeMajor(command: string): number {
    const match = /--target=node(\d+)/.exec(command);
    if (!match) {
        throw new Error(`Build script is missing a Node target: ${command}`);
    }

    return Number(match[1]);
}

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
        const hostVersion = "2026.3.12";
        expect(COMPAT_POLICY.MIN_OPENCLAW_VERSION).toBe(hostVersion);
        expect(COMPAT_POLICY.PEER_RANGE).toBe(`^${hostVersion}`);
    });

    it("should keep the project Node engine aligned with installed OpenClaw requirements", () => {
        const rootNodeEngine = ROOT_PACKAGE_JSON.engines?.node;
        const openClawNodeEngine = OPENCLAW_PACKAGE_JSON.engines?.node;

        expect(typeof rootNodeEngine).toBe("string");
        expect(typeof openClawNodeEngine).toBe("string");

        const rootMinimum = parseMinimumNodeEngine(rootNodeEngine as string);
        const openClawMinimum = parseMinimumNodeEngine(openClawNodeEngine as string);
        const isAligned = compareTriples(rootMinimum, openClawMinimum) >= 0;

        if (!isAligned) {
            throw new Error(
                `Project Node engine ${rootNodeEngine} is below installed OpenClaw requirement ${openClawNodeEngine}. Bump package.json engines.node or lower the installed OpenClaw floor.`,
            );
        }
    });

    it("should keep the build target aligned with the project Node engine", () => {
        const rootNodeEngine = ROOT_PACKAGE_JSON.engines?.node;
        const buildScript = ROOT_PACKAGE_JSON.scripts?.build;

        expect(typeof rootNodeEngine).toBe("string");
        expect(typeof buildScript).toBe("string");

        const rootMinimum = parseMinimumNodeEngine(rootNodeEngine as string);
        const buildTargetMajor = parseBuildTargetNodeMajor(buildScript as string);

        if (buildTargetMajor < rootMinimum[0]) {
            throw new Error(
                `Build target node${buildTargetMajor} is below project Node engine ${rootNodeEngine}. Bump package.json scripts.build --target=node${rootMinimum[0]} or lower engines.node.`,
            );
        }
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
