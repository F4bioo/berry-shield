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
    public readonly flags: string[] = [];
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

    helpOption(flags: boolean | string, _description?: string): this {
        if (typeof flags === "string") {
            this.flags.push(flags);
        }
        return this;
    }

    option(flags: string, _description: string): this {
        this.flags.push(flags);
        return this;
    }

    action(handler: (...args: unknown[]) => Promise<void> | void): this {
        this.actionHandler = handler;
        return this;
    }
}

function collectCommands(command: MockCommand): MockCommand[] {
    return [command, ...command.children.flatMap((child) => collectCommands(child))];
}

function extractShortFlags(spec: string): string[] {
    const matches = spec.match(/-\w\b/g);
    if (!matches) return [];
    return matches.map((value) => value.trim());
}

describe("CLI short flags contract", () => {
    it("has no short-flag collisions inside each command scope", () => {
        const rootProgram = new MockCommand("program", "");
        let capturedCliHandler: ((context: unknown) => void) | undefined;

        const api = {
            registerCli: vi.fn((handler: (context: unknown) => void) => {
                capturedCliHandler = handler;
            }),
        } as any;

        registerBerryShieldCli(api);
        expect(capturedCliHandler).toBeTypeOf("function");

        capturedCliHandler!({
            program: rootProgram,
            config: {},
            logger: {},
        });

        const bshield = rootProgram.children.find((child) => child.name === "bshield");
        expect(bshield).toBeDefined();

        const commands = collectCommands(bshield!);
        for (const command of commands) {
            const shorts = command.flags.flatMap((flagSpec) => extractShortFlags(flagSpec));
            const collisions = shorts.filter((flag, index) => shorts.indexOf(flag) !== index);
            expect(collisions, `Duplicate short flags in "${command.fullPath}"`).toEqual([]);
        }
    });

    it("keeps detailed listing short flag mapped to rules list", () => {
        const rootProgram = new MockCommand("program", "");
        let capturedCliHandler: ((context: unknown) => void) | undefined;

        const api = {
            registerCli: vi.fn((handler: (context: unknown) => void) => {
                capturedCliHandler = handler;
            }),
        } as any;

        registerBerryShieldCli(api);
        capturedCliHandler!({
            program: rootProgram,
            config: {},
            logger: {},
        });

        const bshield = rootProgram.children.find((child) => child.name === "bshield");
        const rules = bshield?.children.find((child) => child.name === "rules");
        const rulesList = rules?.children.find((child) => child.name === "list");

        expect(rulesList?.flags).toContain("-d, --detailed");
    });
});

