/**
 * Storage module for Berry Shield custom rules.
 * 
 * Manages reading/writing custom-rules.json from ~/.openclaw/config/berry-shield/
 * This location is outside the plugin directory so rules persist across reinstalls.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

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
 * Load custom rules from disk.
 * Returns empty rules if file doesn't exist or is corrupted.
 */
export function loadCustomRules(): CustomRules {
    try {
        if (!fs.existsSync(RULES_FILE)) {
            return emptyRules();
        }
        const content = fs.readFileSync(RULES_FILE, "utf-8");
        const parsed = JSON.parse(content);

        // Validate structure
        if (!parsed.version || !Array.isArray(parsed.secrets)) {
            console.error("⚠ Warning: Invalid custom-rules.json structure, using defaults");
            return emptyRules();
        }

        return parsed as CustomRules;
    } catch (err) {
        // File corrupted or unreadable
        console.error(`⚠ Warning: Could not read custom-rules.json: ${err}`);
        return emptyRules();
    }
}

/**
 * Save custom rules to disk.
 * Creates the config directory if it doesn't exist.
 */
export function saveCustomRules(rules: CustomRules): void {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2));
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
