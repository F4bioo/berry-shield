/**
 * CLI command: remove
 *
 * Removes a custom rule from Berry Shield by name.
 * Usage: openclaw bshield remove <name>
 */
import { removeCustomRule } from "../storage.js";
/**
 * Handler for the remove command
 */
export async function removeCommand(name) {
    const result = removeCustomRule(name);
    if (!result.removed) {
        console.error(`\n✗ Rule '${name}' not found.\n`);
        return;
    }
    console.log(`
✓ Removed ${(result.type || "")} rule: ${name}

To apply changes, run:

    sudo systemctl restart openclaw

`);
}
