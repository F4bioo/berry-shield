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
import { testCommand } from "./commands/test.js";
import { initCommand } from "./commands/init.js";
import { statusCommand } from "./commands/status.js";
import { modeCommand } from "./commands/mode.js";
import { toggleCommand } from "./commands/toggle.js";
import { reportCommand } from "./commands/report.js";
import { profileCommand } from "./commands/profile.js";
import { policyCommand } from "./commands/policy.js";
import { vineCommand } from "./commands/vine.js";
import {
    rulesListCommand,
    rulesRemoveCommand,
    rulesDisableCommand,
    rulesEnableCommand,
} from "./commands/rules.js";
import { resetCommand } from "./commands/reset.js";
import { ui } from "./ui/tui.js";
import { theme } from "./ui/theme.js";

/**
 * Register the Berry Shield CLI commands with OpenClaw.
 * 
 * Commands:
 * - openclaw bshield add <type> --name <name> --pattern <pattern>
 * - openclaw bshield rules remove custom <id>
 * - openclaw bshield rules list [--detailed]
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
                .option("-n, --name <name>", "Rule name (required for secret, file, and command)")
                .option("-p, --pattern <pattern>", "Regex pattern to match")
                .option("-r, --placeholder <text>", "Custom placeholder for redaction")
                .option("-f, --force", "Override existing rule with same name")
                .action(async (type: string | undefined, options: any) => {
                    await addCommand(type, options, config, logger, wrapper);
                }),
            );

            // Rules command group
            const rules = bshield
                .command("rules")
                .description("Manage baseline and custom rules");

            attachSubcommandHelp(
                rules
                .command("list")
                .description("List baseline and custom rules")
                .option("-d, --detailed", "Show detailed pattern view for baseline and custom rules")
                .action(async (options: { detailed?: boolean }) => {
                    await rulesListCommand(wrapper, { detailed: options.detailed });
                }),
            );

            attachSubcommandHelp(
                rules
                .command("remove <target> [id]")
                .description("Remove custom rule by id (format: secret:<name> | file:<name> | command:<name>)")
                .action(async (target: string, id: string | undefined) => {
                    await rulesRemoveCommand(target, id, wrapper);
                }),
            );

            attachSubcommandHelp(
                rules
                .command("disable <target> [id]")
                .description("Disable baseline rule by id or disable all baseline rules")
                .option("--all", "Apply operation to all baseline rules")
                .option("--yes", "Skip confirmation prompt")
                .action(async (target: string, id: string | undefined, options: { all?: boolean; yes?: boolean }) => {
                    await rulesDisableCommand(target, id, options);
                }),
            );

            attachSubcommandHelp(
                rules
                .command("enable <target> [id]")
                .description("Enable baseline rule by id or enable all baseline rules")
                .option("--all", "Apply operation to all baseline rules")
                .option("--yes", "Skip confirmation prompt")
                .action(async (target: string, id: string | undefined, options: { all?: boolean; yes?: boolean }) => {
                    await rulesEnableCommand(target, id, options);
                }),
            );

            // Test command
            attachSubcommandHelp(
                bshield
                .command("test <input>")
                .description("Test if input matches any security pattern")
                .action(async (input: string) => {
                    await testCommand(input, config, logger, wrapper);
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

            // Profile command
            attachSubcommandHelp(
                bshield
                .command("profile <profile>")
                .description("Set policy profile (strict | balanced | minimal)")
                .action(async (profile: string) => {
                    await profileCommand(profile, context, wrapper);
                }),
            );

            // Policy command
            attachSubcommandHelp(
                bshield
                .command("policy [action] [path] [value]")
                .description("Manage policy settings (wizard, get, set)")
                .action(async (action: string | undefined, path: string | undefined, value: string | undefined) => {
                    await policyCommand(action, path, value, context, wrapper);
                }),
            );

            // Vine command
            attachSubcommandHelp(
                bshield
                .command("vine [action] [pathOrTool] [value]")
                .description("Manage Berry.Vine settings and tool allowlist")
                .action(async (action: string | undefined, pathOrTool: string | undefined, value: string | undefined) => {
                    await vineCommand(action, pathOrTool, value, context, wrapper);
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

            // Reset command
            attachSubcommandHelp(
                bshield
                .command("reset <target>")
                .description("Reset defaults (builtins or full scope)")
                .option("--scope <scope>", "Reset scope (builtins | all)")
                .option("--yes", "Skip confirmation prompt")
                .action(async (target: string, options: { scope?: string; yes?: boolean }) => {
                    await resetCommand(target, options, context, wrapper);
                }),
            );
        },
        { commands: ["bshield"] }
    );
}
