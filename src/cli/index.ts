/**
 * Berry Shield CLI Registration
 * 
 * Registers the 'bshield' command with OpenClaw's CLI system.
 * This allows users to manage custom rules via: openclaw bshield <command>
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { addCommand } from "./commands/add.js";
import { removeCommand } from "./commands/remove.js";
import { listCommand } from "./commands/list.js";
import { testCommand } from "./commands/test.js";

/**
 * Minimal Commander-like interface for type safety
 */
interface CommanderCommand {
    command(nameAndArgs: string): CommanderCommand;
    description(str: string): CommanderCommand;
    requiredOption(flags: string, description: string): CommanderCommand;
    option(flags: string, description?: string): CommanderCommand;
    action(fn: (...args: unknown[]) => void | Promise<void>): CommanderCommand;
}

/**
 * Extended API type that includes registerCli (available at runtime but not in public SDK types)
 */
interface ExtendedPluginApi extends OpenClawPluginApi {
    registerCli: (
        registrar: (ctx: { program: CommanderCommand }) => void | Promise<void>,
        opts?: { commands?: string[] }
    ) => void;
}

/**
 * Register the Berry Shield CLI commands with OpenClaw.
 * 
 * Commands:
 * - openclaw bshield add <type> --name <name> --pattern <pattern>
 * - openclaw bshield remove <name>
 * - openclaw bshield list
 * - openclaw bshield test <input>
 */
export function registerBerryShieldCli(api: OpenClawPluginApi): void {
    // Cast to extended type - registerCli exists at runtime
    const extendedApi = api as ExtendedPluginApi;

    // Check if registerCli is available (may not be in older versions)
    if (typeof extendedApi.registerCli !== "function") {
        api.logger.warn("[berry-shield] CLI registration not available in this OpenClaw version");
        return;
    }

    extendedApi.registerCli(
        ({ program }) => {
            const bshield = program
                .command("bshield")
                .description("🍓 Berry Shield - Custom security rules management");

            // Add command
            bshield
                .command("add <type>")
                .description("Add a custom rule (secret | file | command)")
                .option("--name <name>", "Rule name (required for secrets)")
                .requiredOption("--pattern <pattern>", "Regex pattern to match")
                .option("--placeholder <text>", "Custom placeholder for redaction")
                .option("--force", "Override existing rule with same name")
                .action(async (type: unknown, options: unknown) => {
                    const opts = options as Record<string, unknown>;
                    await addCommand(type as string, {
                        name: opts.name as string | undefined,
                        pattern: opts.pattern as string,
                        placeholder: opts.placeholder as string | undefined,
                        force: opts.force as boolean | undefined,
                    });
                });

            // Remove command
            bshield
                .command("remove <name>")
                .description("Remove a custom rule by name")
                .action(async (name: unknown) => {
                    await removeCommand(name as string);
                });

            // List command
            bshield
                .command("list")
                .description("List all rules (built-in and custom)")
                .action(async () => {
                    await listCommand();
                });

            // Test command
            bshield
                .command("test <input>")
                .description("Test if input matches any security pattern")
                .action(async (input: unknown) => {
                    await testCommand(input as string);
                });
        },
        { commands: ["bshield"] }
    );

    api.logger.info("[berry-shield] CLI commands registered: bshield");
}
