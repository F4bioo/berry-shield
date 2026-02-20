import { describe, expect, it, vi } from "vitest";
import { HOOKS } from "../src/constants";

const { appendAuditEventMock } = vi.hoisted(() => ({
    appendAuditEventMock: vi.fn(),
}));
const { notifyPolicyDeniedMock } = vi.hoisted(() => ({
    notifyPolicyDeniedMock: vi.fn(),
}));

vi.mock("../src/audit/writer", () => ({
    appendAuditEvent: appendAuditEventMock,
}));
vi.mock("../src/policy/runtime-state", () => ({
    notifyPolicyDenied: notifyPolicyDeniedMock,
}));

import { registerBerryStem } from "../src/layers/stem";
import { registerBerryThorn } from "../src/layers/thorn";
import { registerBerryPulp } from "../src/layers/pulp";

function createConfig() {
    return {
        mode: "enforce" as const,
        layers: { root: true, pulp: true, thorn: true, leaf: true, stem: true },
        policy: {
            profile: "balanced" as const,
            adaptive: {
                staleAfterMinutes: 30,
                escalationTurns: 3,
                heartbeatEveryTurns: 0,
                allowGlobalEscalation: false,
            },
            retention: {
                maxEntries: 10000,
                ttlSeconds: 86400,
            },
        },
        sensitiveFilePaths: [],
        destructiveCommands: [],
        disabledBuiltInIds: [],
    };
}

function createAuditConfig() {
    return {
        ...createConfig(),
        mode: "audit" as const,
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
        notifyPolicyDeniedMock.mockClear();
        const { api, getTool } = createApi();
        registerBerryStem(api as any, createConfig());
        const tool = getTool();

        await tool.execute("1", { operation: "exec", target: "rm -rf /tmp", sessionKey: "s1" });
        await tool.execute("2", { operation: "exec", target: "cat /home/user/.env", sessionKey: "s1" });
        await tool.execute("3", { operation: "read", target: "/home/user/.env", sessionKey: "s1" });

        const stemCalls = appendAuditEventMock.mock.calls
            .map((call) => call[0])
            .filter((event) => event.layer === "stem" && event.mode === "enforce");
        expect(stemCalls.length).toBe(3);
        stemCalls.forEach((event) => expect(event.decision).toBe("blocked"));
        expect(notifyPolicyDeniedMock).toHaveBeenCalledTimes(3);
    });

    it("stem blocks without escalation when sessionKey is missing", async () => {
        appendAuditEventMock.mockClear();
        notifyPolicyDeniedMock.mockClear();
        const { api, getTool } = createApi();
        registerBerryStem(api as any, createConfig());
        const tool = getTool();

        const denied = await tool.execute("x", { operation: "read", target: "/home/user/.env" });

        expect(denied.details.status).toBe("denied");
        expect(notifyPolicyDeniedMock).not.toHaveBeenCalled();
    });

    it("thorn emits blocked events on all enforce block paths", () => {
        appendAuditEventMock.mockClear();
        notifyPolicyDeniedMock.mockClear();
        const { api, handlers } = createApi();
        registerBerryThorn(api as any, createConfig());
        const handler = handlers.get(HOOKS.BEFORE_TOOL_CALL)!;

        handler({ toolName: "exec", params: { command: "rm -rf /tmp" } }, { sessionKey: "s1" });
        handler({ toolName: "exec", params: { command: "cat /home/user/.env" } }, { sessionKey: "s1" });
        handler({ toolName: "read_file", params: { path: "/home/user/.env" } }, { sessionKey: "s1" });

        const thornCalls = appendAuditEventMock.mock.calls
            .map((call) => call[0])
            .filter((event) => event.layer === "thorn" && event.mode === "enforce");
        expect(thornCalls.length).toBe(3);
        thornCalls.forEach((event) => expect(event.decision).toBe("blocked"));
        expect(notifyPolicyDeniedMock).toHaveBeenCalledTimes(3);
    });

    it("thorn blocks without escalation when sessionKey is missing", () => {
        appendAuditEventMock.mockClear();
        notifyPolicyDeniedMock.mockClear();
        const { api, handlers } = createApi();
        registerBerryThorn(api as any, createConfig());
        const handler = handlers.get(HOOKS.BEFORE_TOOL_CALL)!;

        const result = handler({ toolName: "exec", params: { command: "rm -rf /tmp" } });

        expect(result?.block).toBe(true);
        expect(notifyPolicyDeniedMock).not.toHaveBeenCalled();
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

    it("pulp strips leaked berry policy blocks from outgoing message", () => {
        appendAuditEventMock.mockClear();
        const { api, handlers } = createApi();
        registerBerryPulp(api as any, createConfig());
        const sendHandler = handlers.get(HOOKS.MESSAGE_SENDING)!;

        const result = sendHandler({
            content: "<berry_shield_policy>do not show</berry_shield_policy>\nHello user",
        });

        expect(result).toEqual({ content: "Hello user" });
    });

    it("pulp strips policy leak even in audit mode when would_redact is triggered", () => {
        appendAuditEventMock.mockClear();
        const { api, handlers } = createApi();
        registerBerryPulp(api as any, createAuditConfig());
        const sendHandler = handlers.get(HOOKS.MESSAGE_SENDING)!;

        const result = sendHandler({
            content: "<berry_shield_policy>leak</berry_shield_policy> contact user@example.com",
        });

        expect(result).toEqual({ content: "contact user@example.com" });
    });
});
