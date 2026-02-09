/**
 * CLI command: remove
 *
 * Removes a custom rule from Berry Shield by name.
 * Usage: openclaw bshield remove <name>
 */
import { loadCustomRules, saveCustomRules, secretRuleExists } from "../storage.js";
/**
 * Handler for the remove command
 */
export async function removeCommand(name) {
    const rules = loadCustomRules();
    // Check if rule exists
    if (!secretRuleExists(rules, name)) {
        console.error(`\n✗ Rule '${name}' not found.\n`);
        return;
    }
    // Remove the rule
    rules.secrets = rules.secrets.filter(s => s.name.toLowerCase() !== name.toLowerCase());
    saveCustomRules(rules);
    console.log(`
✓ Removed rule: ${name}

To apply changes, run:

    sudo systemctl restart openclaw

`);
}
