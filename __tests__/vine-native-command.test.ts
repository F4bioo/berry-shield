import { beforeEach, describe, expect, it, vi } from "vitest";
import berryShieldPlugin from "../src/index";

function createApi() {
    const commands: any[] = [];
    const api = {
        registerCommand: vi.fn((def: any) => {
            commands.push(def);
        }),
        registerTool: vi.fn(),
        registerCli: vi.fn(),
        logger: {
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
            error: vi.fn(),
        },
        config: {},
        pluginConfig: {},
        on: vi.fn(),
    };
    return {
        api,
        commands,
    };
}

describe("Berry.Vine legacy native approval removal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("does not register the legacy berry-ok native approval command", () => {
        const { api, commands } = createApi();

        berryShieldPlugin.register(api as any);

        expect(commands.some((command) => command?.name === "berry-ok")).toBe(false);
    });
});
