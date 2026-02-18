import { describe, expect, it, vi } from "vitest";
import { HOOKS } from "../src/constants";

const { appendAuditEventMock } = vi.hoisted(() => ({
    appendAuditEventMock: vi.fn(),
}));

vi.mock("../src/audit/writer", () => ({
    appendAuditEvent: appendAuditEventMock,
}));

import { registerBerryStem } from "../src/layers/stem";
import { registerBerryThorn } from "../src/layers/thorn";
import { registerBerryPulp } from "../src/layers/pulp";

function createConfig() {
    return {
        mode: "enforce" as const,
        layers: { root: true, pulp: true, thorn: true, leaf: true, stem: true },
        policy: {
            injectionMode: "session_full_plus_reminder" as const,
            retention: {
                maxEntries: 10000,
                ttlSeconds: 86400,
            },
        },
        sensitiveFilePaths: [],
        destructiveCommands: [],
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
        logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
    };

    return { api, handlers, getTool: () => tool };
}

describe("Enforce parity events", () => {
    it("stem emits blocked events on all enforce deny paths", async () => {
        appendAuditEventMock.mockClear();
        const { api, getTool } = createApi();
        registerBerryStem(api as any, createConfig());
        const tool = getTool();

        await tool.execute("1", { operation: "exec", target: "rm -rf /tmp" });
        await tool.execute("2", { operation: "exec", target: "cat /home/user/.env" });
        await tool.execute("3", { operation: "read", target: "/home/user/.env" });

        const stemCalls = appendAuditEventMock.mock.calls
            .map((call) => call[0])
            .filter((event) => event.layer === "stem" && event.mode === "enforce");
        expect(stemCalls.length).toBe(3);
        stemCalls.forEach((event) => expect(event.decision).toBe("blocked"));
    });

    it("thorn emits blocked events on all enforce block paths", () => {
        appendAuditEventMock.mockClear();
        const { api, handlers } = createApi();
        registerBerryThorn(api as any, createConfig());
        const handler = handlers.get(HOOKS.BEFORE_TOOL_CALL)!;

        handler({ toolName: "exec", params: { command: "rm -rf /tmp" } });
        handler({ toolName: "exec", params: { command: "cat /home/user/.env" } });
        handler({ toolName: "read_file", params: { path: "/home/user/.env" } });

        const thornCalls = appendAuditEventMock.mock.calls
            .map((call) => call[0])
            .filter((event) => event.layer === "thorn" && event.mode === "enforce");
        expect(thornCalls.length).toBe(3);
        thornCalls.forEach((event) => expect(event.decision).toBe("blocked"));
    });

    it("pulp emits redacted events on both enforce redaction paths", () => {
        appendAuditEventMock.mockClear();
        const { api, handlers } = createApi();
        registerBerryPulp(api as any, createConfig());

        const persistHandler = handlers.get(HOOKS.TOOL_RESULT_PERSIST)!;
        const sendHandler = handlers.get(HOOKS.MESSAGE_SENDING)!;

        persistHandler({
            toolName: "read_file",
            message: "api_key=abcdefghijklmnopqrstuvwxyz12345",
        });
        sendHandler({
            content: "email: user@example.com",
        });

        const pulpCalls = appendAuditEventMock.mock.calls
            .map((call) => call[0])
            .filter((event) => event.layer === "pulp" && event.mode === "enforce");
        expect(pulpCalls.length).toBe(2);
        pulpCalls.forEach((event) => expect(event.decision).toBe("redacted"));
    });
});
