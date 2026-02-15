import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { REQUIRED_SECURITY_HOOKS, AUDIT_HOOKS } from "../src/constants";

const sdkTypesPath = path.join(
    process.cwd(),
    "node_modules",
    "openclaw",
    "dist",
    "plugin-sdk",
    "plugins",
    "types.d.ts",
);

function readSdkTypes(): string {
    expect(fs.existsSync(sdkTypesPath)).toBe(true);
    return fs.readFileSync(sdkTypesPath, "utf-8");
}

describe("OpenClaw SDK Contract", () => {
    it("exposes required plugin hooks used by Berry Shield", () => {
        const typesContent = readSdkTypes();

        for (const hookName of REQUIRED_SECURITY_HOOKS) {
            expect(typesContent).toContain(`"${hookName}"`);
        }
    });

    it("exposes audit hook used by Berry Shield observability", () => {
        const typesContent = readSdkTypes();

        for (const hookName of AUDIT_HOOKS) {
            expect(typesContent).toContain(`"${hookName}"`);
        }
    });

    it("exposes required plugin API registration methods", () => {
        const typesContent = readSdkTypes();

        expect(typesContent).toMatch(/registerHook:\s*\(events:\s*string\s*\|\s*string\[\],\s*handler:\s*InternalHookHandler,\s*opts\?:\s*OpenClawPluginHookOptions\)\s*=>\s*void;/);
        expect(typesContent).toMatch(/registerCli:\s*\(registrar:\s*OpenClawPluginCliRegistrar,\s*opts\?:\s*{\s*commands\?:\s*string\[\];?\s*}\)\s*=>\s*void;/);
        expect(typesContent).toMatch(/registerCommand:\s*\(command:\s*OpenClawPluginCommandDefinition\)\s*=>\s*void;/);
    });

    it("keeps plugin register lifecycle signature available", () => {
        const typesContent = readSdkTypes();

        expect(typesContent).toMatch(/register\?:\s*\(api:\s*OpenClawPluginApi\)\s*=>\s*void\s*\|\s*Promise<void>;/);
    });

    it("keeps required hook handler map signatures available", () => {
        const typesContent = readSdkTypes();

        expect(typesContent).toMatch(/before_agent_start:\s*\(event:\s*PluginHookBeforeAgentStartEvent,\s*ctx:\s*PluginHookAgentContext\)\s*=>/);
        expect(typesContent).toMatch(/message_sending:\s*\(event:\s*PluginHookMessageSendingEvent,\s*ctx:\s*PluginHookMessageContext\)\s*=>/);
        expect(typesContent).toMatch(/before_tool_call:\s*\(event:\s*PluginHookBeforeToolCallEvent,\s*ctx:\s*PluginHookToolContext\)\s*=>/);
        expect(typesContent).toMatch(/tool_result_persist:\s*\(event:\s*PluginHookToolResultPersistEvent,\s*ctx:\s*PluginHookToolResultPersistContext\)\s*=>/);
    });
});
