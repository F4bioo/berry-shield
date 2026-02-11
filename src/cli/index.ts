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
 * Register the Berry Shield CLI commands with OpenClaw.
 * 
 * Commands:
 * - openclaw bshield add <type> --name <name> --pattern <pattern>
 * - openclaw bshield remove <name>
 * - openclaw bshield list
 * - openclaw bshield test <input>
 */
export function registerBerryShieldCli(api: OpenClawPluginApi): void {
    // Register the CLI with OpenClaw using the official SDK registrar
    api.registerCli(
        (ctx) => {
            const { program, config, logger } = ctx;

            const bshield = program
                .command("bshield")
                .description("🍓 Berry Shield - Custom security rules management")
                .addHelpText('after', '\nFor more info, visit: https://github.com/F4bioo/berry-shield\n');

            // Add command
            bshield
                .command("add <type>")
                .description("Add a custom rule (secret | file | command)")
                .option("--name <name>", "Rule name (required for secrets)")
                .requiredOption("--pattern <pattern>", "Regex pattern to match")
                .option("--placeholder <text>", "Custom placeholder for redaction")
                .option("--force", "Override existing rule with same name")
                .action(async (type, options) => {
                    await addCommand(type as string, options, config, logger);
                });

            // Remove command
            bshield
                .command("remove <name>")
                .description("Remove a custom rule by name")
                .action(async (name) => {
                    await removeCommand(name as string, config, logger);
                });

            // List command
            bshield
                .command("list")
                .description("List all rules (built-in and custom)")
                .action(async () => {
                    await listCommand(config, logger);
                });

            // Test command
            bshield
                .command("test <input>")
                .description("Test if input matches any security pattern")
                .action(async (input) => {
                    await testCommand(input as string, config, logger);
                });
        },
        { commands: ["bshield"] }
    );
}
