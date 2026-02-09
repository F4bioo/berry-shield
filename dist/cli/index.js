/**
 * Berry Shield CLI Registration
 *
 * Registers the 'bshield' command with OpenClaw's CLI system.
 * This allows users to manage custom rules via: openclaw bshield <command>
 */
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
export function registerBerryShieldCli(api) {
    // Cast to extended type - registerCli exists at runtime
    const extendedApi = api;
    // Check if registerCli is available (may not be in older versions)
    if (typeof extendedApi.registerCli !== "function") {
        api.logger.warn("[berry-shield] CLI registration not available in this OpenClaw version");
        return;
    }
    extendedApi.registerCli(({ program }) => {
        const bshield = program
            .command("bshield")
            .description("🍓 Berry Shield - Custom security rules management");
        // Add command
        bshield
            .command("add <type>")
            .description("Add a custom rule (secret | file | command)")
            .requiredOption("--name <name>", "Rule name (required for secrets)")
            .requiredOption("--pattern <pattern>", "Regex pattern to match")
            .option("--placeholder <text>", "Custom placeholder for redaction")
            .option("--force", "Override existing rule with same name")
            .action(async (type, options) => {
            const opts = options;
            await addCommand(type, {
                name: opts.name,
                pattern: opts.pattern,
                placeholder: opts.placeholder,
                force: opts.force,
            });
        });
        // Remove command
        bshield
            .command("remove <name>")
            .description("Remove a custom rule by name")
            .action(async (name) => {
            await removeCommand(name);
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
            .action(async (input) => {
            await testCommand(input);
        });
    }, { commands: ["bshield"] });
    api.logger.info("[berry-shield] CLI commands registered: bshield");
}
