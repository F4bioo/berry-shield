import { describe, expect, it, vi } from "vitest";
import { registerBerryShieldCli } from "../src/cli/index";

vi.mock("../src/cli/ui/tui.js", () => ({
    ui: {
        formatFooter: () => "footer",
    },
}));

vi.mock("../src/cli/ui/theme.js", () => ({
    theme: {
        muted: (value: string) => value,
    },
}));

class MockCommand {
    public readonly name: string;
    public readonly fullPath: string;
    public readonly children: MockCommand[] = [];
    public actionHandler?: (...args: unknown[]) => Promise<void> | void;

    constructor(name: string, fullPath: string) {
        this.name = name;
        this.fullPath = fullPath;
    }

    command(name: string): MockCommand {
        const childPath = `${this.fullPath} ${name}`.trim();
        const child = new MockCommand(name, childPath);
        this.children.push(child);
        return child;
    }

    description(_value: string): this {
        return this;
    }

    addHelpText(_position: string, _value: string): this {
        return this;
    }

    helpOption(_flags: boolean | string, _description?: string): this {
        return this;
    }

    option(_flags: string, _description: string): this {
        return this;
    }

    action(handler: (...args: unknown[]) => Promise<void> | void): this {
        this.actionHandler = handler;
        return this;
    }
}

function collectPaths(command: MockCommand): string[] {
    return [command.fullPath, ...command.children.flatMap((child) => collectPaths(child))];
}

describe("registerBerryShieldCli", () => {
    it("registers rules namespace and reset command through sync bootstrap callback", () => {
        const rootProgram = new MockCommand("program", "");
        let capturedCliHandler: ((context: unknown) => void) | undefined;

        const api = {
            registerCli: vi.fn((handler: (context: unknown) => void) => {
                capturedCliHandler = handler;
            }),
        } as any;

        registerBerryShieldCli(api);
        expect(api.registerCli).toHaveBeenCalledTimes(1);
        expect(capturedCliHandler).toBeTypeOf("function");

        const result = capturedCliHandler!({
            program: rootProgram,
            config: {},
            logger: {},
        });
        expect(result).toBeUndefined();

        const bshield = rootProgram.children.find((child) => child.name === "bshield");
        expect(bshield).toBeDefined();

        const commandPaths = collectPaths(bshield!);
        expect(commandPaths).toContain("bshield rules list");
        expect(commandPaths).toContain("bshield rules remove <target> [name]");
        expect(commandPaths).toContain("bshield rules disable <target> [id]");
        expect(commandPaths).toContain("bshield rules enable <target> [id]");
        expect(commandPaths).toContain("bshield vine [action] [pathOrTool] [value]");
        expect(commandPaths).toContain("bshield reset <target>");
    });
});
