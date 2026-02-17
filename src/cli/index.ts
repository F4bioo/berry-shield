/**
 * Berry Shield CLI Registration
 * 
 * Registers the 'bshield' command with OpenClaw's CLI system.
 * This allows users to manage custom rules via: openclaw bshield <command>
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { OpenClawPluginCliContext, SafeCommand } from "../types/openclaw-local.js";
import { ConfigWrapper } from "../config/wrapper.js";
import { addCommand } from "./commands/add.js";
import { removeCommand } from "./commands/remove.js";
import { listCommand } from "./commands/list.js";
import { testCommand } from "./commands/test.js";
import { initCommand } from "./commands/init.js";
import { statusCommand } from "./commands/status.js";
import { modeCommand } from "./commands/mode.js";
import { toggleCommand } from "./commands/toggle.js";
import { reportCommand } from "./commands/report.js";
import { ui } from "./ui/tui.js";
import { theme } from "./ui/theme.js";

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
    const attachSubcommandHelp = <T extends SafeCommand>(command: T): T => {
        return command
            .helpOption(false)
            .helpOption("-h, --help", "display help for command")
            .addHelpText("after", `\n${ui.formatFooter()}`);
    };

    // Register the CLI with OpenClaw using the official SDK registrar
    api.registerCli(
        (context: OpenClawPluginCliContext) => {
            const { program, config, logger } = context;
            const wrapper = new ConfigWrapper({ config });

            const bshield = program
                .command("bshield")
                .description("Berry Shield - Custom security rules management")
                .addHelpText('after', `\nFor more info, visit: ${theme.muted("https://github.com/F4bioo/berry-shield")}\n\n${ui.formatFooter()}`);

            // Add command
            attachSubcommandHelp(
                bshield
                .command("add [type]")
                .description("Add a new security rule (interactive wizard if no args)")
                .option("-n, --name <name>", "Rule name (required for secrets)")
                .option("-p, --pattern <pattern>", "Regex pattern to match")
                .option("-r, --placeholder <text>", "Custom placeholder for redaction")
                .option("-f, --force", "Override existing rule with same name")
                .action(async (type: string | undefined, options: any) => {
                    await addCommand(type, options, config, logger);
                }),
            );

            // Remove command
            attachSubcommandHelp(
                bshield
                .command("remove <name>")
                .description("Remove a custom rule by name")
                .action(async (name: string) => {
                    await removeCommand(name, config, logger);
                }),
            );

            // List command
            attachSubcommandHelp(
                bshield
                .command("list")
                .description("List all rules (built-in and custom)")
                .action(async () => {
                    await listCommand(logger);
                }),
            );

            // Test command
            attachSubcommandHelp(
                bshield
                .command("test <input>")
                .description("Test if input matches any security pattern")
                .action(async (input: string) => {
                    await testCommand(input, config, logger);
                }),
            );

            // Init command
            attachSubcommandHelp(
                bshield
                .command("init")
                .description("Initialize Berry Shield configuration")
                .action(async () => {
                    await initCommand(context, wrapper);
                }),
            );

            // Status command
            attachSubcommandHelp(
                bshield
                .command("status")
                .description("Show current status and configuration")
                .action(async () => {
                    await statusCommand(context, wrapper);
                }),
            );

            // Mode command
            attachSubcommandHelp(
                bshield
                .command("mode <mode>")
                .description("Set operation mode (audit | enforce)")
                .action(async (mode: string) => {
                    await modeCommand(mode, context, wrapper);
                }),
            );

            // Toggle command
            attachSubcommandHelp(
                bshield
                .command("toggle <layer>")
                .description("Toggle a security layer on/off")
                .action(async (layer: string) => {
                    await toggleCommand(layer, context, wrapper);
                }),
            );

            // Report command
            attachSubcommandHelp(
                bshield
                .command("report")
                .description("Show global audit report from persisted events")
                .option("--clear", "Clear the persisted audit log")
                .action(async (options: { clear?: boolean }) => {
                    await reportCommand(options, logger);
                }),
            );
        },
        { commands: ["bshield"] }
    );
}
