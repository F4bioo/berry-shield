/**
 * Storage module for Berry Shield custom rules.
 * 
 * Manages reading/writing custom-rules.json from ~/.openclaw/config/berry-shield/
 * This location is outside the plugin directory so rules persist across reinstalls.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

// Storage location outside plugin directory
const CONFIG_DIR = path.join(os.homedir(), ".openclaw", "config", "berry-shield");
const RULES_FILE = path.join(CONFIG_DIR, "custom-rules.json");

/**
 * Custom rule for secrets (API keys, tokens, etc.)
 */
export interface SecretRule {
    name: string;
    pattern: string;
    placeholder: string;
    addedAt: string;
}

/**
 * Custom rule for sensitive files
 */
export interface FileRule {
    pattern: string;
    addedAt: string;
}

/**
 * Custom rule for destructive commands
 */
export interface CommandRule {
    pattern: string;
    addedAt: string;
}

/**
 * Structure of the custom-rules.json file
 */
export interface CustomRules {
    version: string;
    secrets: SecretRule[];
    sensitiveFiles: FileRule[];
    destructiveCommands: CommandRule[];
}

/**
 * Returns an empty rules object with default structure
 */
function emptyRules(): CustomRules {
    return {
        version: "1.0",
        secrets: [],
        sensitiveFiles: [],
        destructiveCommands: [],
    };
}

/**
 * Load custom rules from disk asynchronously.
 * Returns empty rules if file doesn't exist or is corrupted.
 */
export async function loadCustomRules(): Promise<CustomRules> {
    try {
        await fs.access(RULES_FILE); // Check if file exists
        const content = await fs.readFile(RULES_FILE, "utf-8");
        const parsed = JSON.parse(content);

        // Validate structure
        if (!parsed.version || !Array.isArray(parsed.secrets)) {
            console.error("⚠ Warning: Invalid custom-rules.json structure, using defaults");
            return emptyRules();
        }

        return parsed as CustomRules;
    } catch (err: unknown) {
        // Return empty rules if file not found or other error
        if (err instanceof Error && "code" in err && (err as any).code !== "ENOENT") {
            console.error(`⚠ Warning: Could not read custom-rules.json: ${err.message}`);
        }
        return emptyRules();
    }
}

/**
 * Save custom rules to disk asynchronously.
 * Creates the config directory if it doesn't exist.
 */
export async function saveCustomRules(rules: CustomRules): Promise<void> {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(RULES_FILE, JSON.stringify(rules, null, 2));
}

/**
 * Validate a regex pattern string.
 * Returns validation result with optional error message.
 */
export function validateRegex(pattern: string): { valid: boolean; error?: string } {
    try {
        new RegExp(pattern, "gi");
        return { valid: true };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { valid: false, error: message };
    }
}

/**
 * Check if a secret rule with given name already exists.
 */
export function secretRuleExists(rules: CustomRules, name: string): boolean {
    return rules.secrets.some(s => s.name.toLowerCase() === name.toLowerCase());
}

/**
 * Generate automatic placeholder from rule name.
 * Example: "whatsapp_token" -> "[WHATSAPP_TOKEN_REDACTED]"
 */
export function generatePlaceholder(name: string): string {
    const sanitized = name.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    return `[${sanitized}_REDACTED]`;
}

/**
 * Get the path to the rules file (for display purposes)
 */
export function getRulesFilePath(): string {
    return RULES_FILE;
}

export function getStoragePath(): string {
    return RULES_FILE;
}

/**
 * Add a custom rule asynchronously.
 * Returns result object indicating success or failure.
 */
export async function addCustomRule(
    type: string,
    options: {
        name?: string;
        pattern: string;
        placeholder?: string;
        force?: boolean;
    }
): Promise<{ success: boolean; error?: string; rule?: SecretRule | FileRule | CommandRule }> {
    const { name, pattern, placeholder, force } = options;

    // Validate regex
    const validation = validateRegex(pattern);
    if (!validation.valid) {
        return { success: false, error: `Invalid regex pattern: ${validation.error}` };
    }

    const rules = await loadCustomRules();
    const now = new Date().toISOString();

    if (type === "secret") {
        if (!name) return { success: false, error: "Secret rules require a name" };

        if (secretRuleExists(rules, name) && !force) {
            return { success: false, error: `Rule '${name}' already exists. Use --force to override.` };
        }

        // Remove existing if forcing
        if (secretRuleExists(rules, name)) {
            rules.secrets = rules.secrets.filter(s => s.name.toLowerCase() !== name.toLowerCase());
        }

        const finalPlaceholder = placeholder || generatePlaceholder(name);
        const newRule: SecretRule = {
            name,
            pattern,
            placeholder: finalPlaceholder,
            addedAt: now,
        };

        rules.secrets.push(newRule);
        await saveCustomRules(rules);
        return { success: true, rule: newRule };

    } else if (type === "file") {
        const exists = rules.sensitiveFiles.some(f => f.pattern === pattern);
        if (exists && !force) {
            return { success: false, error: "File pattern already exists. Use --force to add anyway." };
        }

        // Remove existing if forcing (to update timestamp or just dedup)
        if (exists) {
            rules.sensitiveFiles = rules.sensitiveFiles.filter(f => f.pattern !== pattern);
        }

        const newRule: FileRule = { pattern, addedAt: now };
        rules.sensitiveFiles.push(newRule);
        await saveCustomRules(rules);
        return { success: true, rule: newRule };

    } else if (type === "command") {
        const exists = rules.destructiveCommands.some(c => c.pattern === pattern);
        if (exists && !force) {
            return { success: false, error: "Command pattern already exists. Use --force to add anyway." };
        }

        if (exists) {
            rules.destructiveCommands = rules.destructiveCommands.filter(c => c.pattern !== pattern);
        }

        const newRule: CommandRule = { pattern, addedAt: now };
        rules.destructiveCommands.push(newRule);
        await saveCustomRules(rules);
        return { success: true, rule: newRule };
    }

    return { success: false, error: `Unknown type: ${type}` };
}

/**
 * Remove a custom rule by name (secrets) or pattern (files/commands) asynchronously.
 */
export async function removeCustomRule(identifier: string): Promise<{ success: boolean; removed: boolean; type?: string }> {
    const rules = await loadCustomRules();
    let removed = false;
    let type = undefined;

    // optimized: check secrets by name first
    const initialSecretsCount = rules.secrets.length;
    rules.secrets = rules.secrets.filter(s => s.name.toLowerCase() !== identifier.toLowerCase());
    if (rules.secrets.length < initialSecretsCount) {
        removed = true;
        type = "secret";
    }

    // if not found, check sensitive files by pattern
    if (!removed) {
        const initialFilesCount = rules.sensitiveFiles.length;
        rules.sensitiveFiles = rules.sensitiveFiles.filter(f => f.pattern !== identifier);
        if (rules.sensitiveFiles.length < initialFilesCount) {
            removed = true;
            type = "file";
        }
    }

    // if not found, check commands by pattern
    if (!removed) {
        const initialCmdsCount = rules.destructiveCommands.length;
        rules.destructiveCommands = rules.destructiveCommands.filter(c => c.pattern !== identifier);
        if (rules.destructiveCommands.length < initialCmdsCount) {
            removed = true;
            type = "command";
        }
    }

    if (removed) {
        await saveCustomRules(rules);
        return { success: true, removed: true, type };
    }

    return { success: true, removed: false };
}
