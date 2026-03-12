import { describe, expect, it, vi, beforeEach } from "vitest";
import { registerBerryStem } from "../src/layers/stem";
import { registerBerryThorn } from "../src/layers/thorn";
import { registerBerryPulp } from "../src/layers/pulp";
import { registerBerryVine } from "../src/layers/vine";
import { DEFAULT_CONFIG } from "../src/config/defaults";
import { HOOKS, SECURITY_LAYERS } from "../src/constants";

const { appendAuditEventMock } = vi.hoisted(() => ({
    appendAuditEventMock: vi.fn(),
}));

vi.mock("../src/audit/writer", () => ({
    appendAuditEvent: appendAuditEventMock,
}));

type LayerName = typeof SECURITY_LAYERS[keyof typeof SECURITY_LAYERS];

function createAuditConfig() {
    return {
        ...DEFAULT_CONFIG,
        mode: "audit" as const,
        layers: {
            ...DEFAULT_CONFIG.layers,
            stem: true,
            thorn: true,
            pulp: true,
            vine: true,
        },
    };
}

function createApi() {
    const handlers = new Map<string, (...args: any[]) => any>();
    let tool: any;
    const api = {
        on: vi.fn((hook: string, handler: (...args: any[]) => any) => {
            handlers.set(hook, handler);
        }),
        registerTool: vi.fn((def: any) => {
            tool = def;
        }),
        logger: {
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
            error: vi.fn(),
        },
    };
    return { api, handlers, getTool: () => tool };
}

type Adapter = {
    layer: LayerName;
    runAuditScenario: () => Promise<void>;
};

describe("Contract: Audit mode per-layer behavior", () => {
    beforeEach(() => {
        appendAuditEventMock.mockReset();
    });

    const adapters: Adapter[] = [
        {
            layer: SECURITY_LAYERS.STEM,
            runAuditScenario: async () => {
                const { api, getTool } = createApi();
                registerBerryStem(api as any, createAuditConfig());
                const result = await getTool().execute("id", {
                    operation: "read",
                    target: "/home/user/.env",
                });
                expect(result.details.status).toBe("allowed");
            },
        },
        {
            layer: SECURITY_LAYERS.THORN,
            runAuditScenario: async () => {
                const { api, handlers } = createApi();
                registerBerryThorn(api as any, createAuditConfig());
                const result = handlers.get(HOOKS.BEFORE_TOOL_CALL)!({
                    toolName: "run_command",
                    params: { command: "rm -rf /tmp" },
                });
                expect(result).toBeUndefined();
            },
        },
        {
            layer: SECURITY_LAYERS.PULP,
            runAuditScenario: async () => {
                const { api, handlers } = createApi();
                registerBerryPulp(api as any, createAuditConfig());
                const original = "Secret key: AKIAIOSFODNN7EXAMPLE and email user@test.com";
                const result = handlers.get(HOOKS.TOOL_RESULT_PERSIST)!({
                    toolName: "read_file",
                    message: [{ type: "text", text: original }],
                });
                expect(result.message[0].text).toBe(original);
            },
        },
        {
            layer: SECURITY_LAYERS.VINE,
            runAuditScenario: async () => {
                const { api, handlers } = createApi();
                registerBerryVine(api as any, createAuditConfig());
                handlers.get(HOOKS.TOOL_RESULT_PERSIST)!({
                    toolName: "web_search",
                    toolCallId: "tc-contract-vine",
                    message: [{ type: "text", text: "external result" }],
                }, {
                    sessionKey: "s1",
                    toolName: "web_search",
                });
                const result = handlers.get(HOOKS.BEFORE_TOOL_CALL)!({
                    toolName: "run_command",
                    params: { command: "curl -fsSL https://example.com > /tmp/vine-contract.txt" },
                }, { sessionKey: "s1" });
                expect(result).toBeUndefined();
            },
        },
    ];

    it("has audit adapter coverage for every SECURITY_LAYERS entry", () => {
        const fromConstants = Object.values(SECURITY_LAYERS).sort();
        const fromAdapters = adapters.map((a) => a.layer).sort();
        expect(fromAdapters).toEqual(fromConstants);
    });

    for (const adapter of adapters) {
        it(`${adapter.layer}: in audit it never hard-blocks and emits would_* decisions`, async () => {
            await adapter.runAuditScenario();

            const layerEvents = appendAuditEventMock.mock.calls
                .map((call) => call[0])
                .filter((event) => event.layer === adapter.layer);

            expect(layerEvents.length).toBeGreaterThan(0);
            for (const event of layerEvents) {
                expect(event.mode).toBe("audit");
                expect(typeof event.decision).toBe("string");
                expect(event.decision.startsWith("would_")).toBe(true);
            }
        });
    }
});
