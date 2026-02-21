/**
 * Storage module for Berry Shield custom rules.
 * 
 * Manages reading/writing custom-rules.json from ~/.openclaw/config/berry-shield/
 * This location is outside the plugin directory so rules persist across reinstalls.
 */

import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { theme, symbols } from "./ui/theme.js";

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
    disabledBuiltInIds?: string[];
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
        disabledBuiltInIds: [],
    };
}

function normalizeRules(rules: CustomRules): CustomRules {
    return {
        ...rules,
        disabledBuiltInIds: (rules.disabledBuiltInIds ?? []).map((id) => id.toLowerCase()),
    };
}

function getBrokenBackupPath(): string {
    return `${RULES_FILE}.broken.${Date.now()}`;
}

async function writeRulesAtomicAsync(rules: CustomRules): Promise<void> {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    const tmpPath = `${RULES_FILE}.tmp.${process.pid}.${Date.now()}`;
    const payload = JSON.stringify(rules, null, 2);

    await fs.writeFile(tmpPath, payload, "utf-8");

    try {
        await fs.rename(tmpPath, RULES_FILE);
    } catch {
        try {
            await fs.unlink(RULES_FILE);
        } catch {
            // Ignore if destination does not exist or cannot be removed here.
        }
        await fs.rename(tmpPath, RULES_FILE);
    }
}

function writeRulesAtomicSync(rules: CustomRules): void {
    fsSync.mkdirSync(CONFIG_DIR, { recursive: true });
    const tmpPath = `${RULES_FILE}.tmp.${process.pid}.${Date.now()}`;
    const payload = JSON.stringify(rules, null, 2);

    fsSync.writeFileSync(tmpPath, payload, "utf-8");

    try {
        fsSync.renameSync(tmpPath, RULES_FILE);
    } catch {
        try {
            fsSync.unlinkSync(RULES_FILE);
        } catch {
            // Ignore if destination does not exist or cannot be removed here.
        }
        fsSync.renameSync(tmpPath, RULES_FILE);
    }
}

async function recoverCorruptedRulesFileAsync(message: string): Promise<void> {
    console.error(`   ${symbols.warning} ${theme.warning("Warning:")} Invalid custom-rules.json structure, creating backup and restoring defaults`);

    try {
        await fs.mkdir(CONFIG_DIR, { recursive: true });
        try {
            await fs.rename(RULES_FILE, getBrokenBackupPath());
        } catch {
            // Keep best-effort behavior: if rename fails, continue writing defaults.
        }
        await writeRulesAtomicAsync(emptyRules());
    } catch (recoveryErr: unknown) {
        const recoveryMessage = recoveryErr instanceof Error ? recoveryErr.message : String(recoveryErr);
        console.error(`   ${symbols.warning} ${theme.warning("Warning:")} Failed to recover corrupted custom-rules.json: ${recoveryMessage}`);
        console.error(`   ${symbols.warning} ${theme.warning("Warning:")} Original parse error: ${message}`);
    }
}

function recoverCorruptedRulesFileSync(message: string): void {
    console.error(`   ${symbols.warning} ${theme.warning("Warning:")} Invalid custom-rules.json structure, creating backup and restoring defaults`);

    try {
        fsSync.mkdirSync(CONFIG_DIR, { recursive: true });
        try {
            fsSync.renameSync(RULES_FILE, getBrokenBackupPath());
        } catch {
            // Keep best-effort behavior: if rename fails, continue writing defaults.
        }
        writeRulesAtomicSync(emptyRules());
    } catch (recoveryErr: unknown) {
        const recoveryMessage = recoveryErr instanceof Error ? recoveryErr.message : String(recoveryErr);
        console.error(`   ${symbols.warning} ${theme.warning("Warning:")} Failed to recover corrupted custom-rules.json: ${recoveryMessage}`);
        console.error(`   ${symbols.warning} ${theme.warning("Warning:")} Original parse error: ${message}`);
    }
}

function isSystemErrorWithCode(err: unknown): err is { code: string } {
    return typeof err === "object" && err !== null && "code" in err && typeof (err as { code: unknown }).code === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isSecretRule(value: unknown): value is SecretRule {
    if (!isRecord(value)) return false;
    return typeof value.name === "string"
        && typeof value.pattern === "string"
        && typeof value.placeholder === "string"
        && typeof value.addedAt === "string";
}

function isFileRule(value: unknown): value is FileRule {
    if (!isRecord(value)) return false;
    return typeof value.pattern === "string" && typeof value.addedAt === "string";
}

function isCommandRule(value: unknown): value is CommandRule {
    if (!isRecord(value)) return false;
    return typeof value.pattern === "string" && typeof value.addedAt === "string";
}

function isCustomRules(value: unknown): value is CustomRules {
    if (!isRecord(value)) return false;
    if (typeof value.version !== "string") return false;
    if (!Array.isArray(value.secrets) || !value.secrets.every(isSecretRule)) return false;
    if (!Array.isArray(value.sensitiveFiles) || !value.sensitiveFiles.every(isFileRule)) return false;
    if (!Array.isArray(value.destructiveCommands) || !value.destructiveCommands.every(isCommandRule)) return false;
    if (value.disabledBuiltInIds !== undefined && (!Array.isArray(value.disabledBuiltInIds) || !value.disabledBuiltInIds.every(id => typeof id === "string"))) return false;
    return true;
}

function parseCustomRulesContent(content: string): CustomRules {
    const parsed: unknown = JSON.parse(content);
    if (!isCustomRules(parsed)) {
        throw new Error("Invalid custom-rules.json structure");
    }
    // Fallback for older rule files without disabledBuiltInIds
    return normalizeRules(parsed);
}

/**
 * Load custom rules from disk asynchronously.
 * Returns empty rules if file doesn't exist or is corrupted.
 */
export async function loadCustomRules(): Promise<CustomRules> {
    try {
        await fs.access(RULES_FILE); // Check if file exists
        const content = await fs.readFile(RULES_FILE, "utf-8");
        return parseCustomRulesContent(content);
    } catch (err: unknown) {
        // Return empty rules if file not found or other error
        if (isSystemErrorWithCode(err) && err.code !== "ENOENT") {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`   ${symbols.warning} ${theme.warning("Warning:")} Could not read custom-rules.json: ${message}`);
        }
        if (err instanceof Error && !isSystemErrorWithCode(err)) {
            await recoverCorruptedRulesFileAsync(err.message);
        }
        return emptyRules();
    }
}

/**
 * Load custom rules from disk synchronously.
 * Used during plugin bootstrap when register lifecycle must stay synchronous.
 */
export function loadCustomRulesSync(): CustomRules {
    try {
        fsSync.accessSync(RULES_FILE);
        const content = fsSync.readFileSync(RULES_FILE, "utf-8");
        return parseCustomRulesContent(content);
    } catch (err: unknown) {
        if (isSystemErrorWithCode(err) && err.code !== "ENOENT") {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`   ${symbols.warning} ${theme.warning("Warning:")} Could not read custom-rules.json: ${message}`);
        }
        if (err instanceof Error && !isSystemErrorWithCode(err)) {
            recoverCorruptedRulesFileSync(err.message);
        }
        return emptyRules();
    }
}

/**
 * Save custom rules to disk asynchronously.
 * Creates the config directory if it doesn't exist.
 */
export async function saveCustomRules(rules: CustomRules): Promise<void> {
    await writeRulesAtomicAsync(normalizeRules(rules));
}

/**
 * Detect if a pattern is potentially too broad (Yellow Flag)
 */
export function isBroadPattern(pattern: string): boolean {
    if (pattern === ".*" || pattern === ".+") return true;
    if (pattern.length < 3) return true;
    if (pattern.includes(".*") && pattern.length < 8) return true;
    return false;
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

function collectPatternIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((entry): entry is { id: string } =>
            typeof entry === "object"
            && entry !== null
            && "id" in entry
            && typeof (entry as { id: unknown }).id === "string"
        )
        .map((entry) => entry.id.toLowerCase());
}

async function loadKnownBuiltInIds(): Promise<Set<string>> {
    try {
        const patterns = await import("../patterns/index.js");
        const ids = [
            ...collectPatternIds((patterns as Record<string, unknown>).SECRET_PATTERNS),
            ...collectPatternIds((patterns as Record<string, unknown>).PII_PATTERNS),
            ...collectPatternIds((patterns as Record<string, unknown>).INTERNAL_SENSITIVE_FILE_PATTERNS),
            ...collectPatternIds((patterns as Record<string, unknown>).INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS),
        ];
        return new Set(ids);
    } catch {
        return new Set<string>();
    }
}

/**
 * Ensures diff-state fields exist in custom-rules.json during bootstrap.
 * Keeps register() lifecycle synchronous for OpenClaw compatibility.
 */
export function ensureRulesDeltaSync(): void {
    try {
        fsSync.mkdirSync(CONFIG_DIR, { recursive: true });

        if (!fsSync.existsSync(RULES_FILE)) {
            writeRulesAtomicSync(emptyRules());
            return;
        }

        const content = fsSync.readFileSync(RULES_FILE, "utf-8");
        const parsed = parseCustomRulesContent(content);
        const normalized = normalizeRules(parsed);

        if (content !== JSON.stringify(normalized, null, 2)) {
            writeRulesAtomicSync(normalized);
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`   ${symbols.warning} ${theme.warning("Warning:")} Could not ensure rules delta sync: ${message}`);
    }
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

/**
 * Disable a built-in rule by its ID.
 */
export async function disableBuiltInRule(id: string): Promise<{ success: boolean; error?: string }> {
    const rules = await loadCustomRules();
    rules.disabledBuiltInIds = rules.disabledBuiltInIds || [];

    // Normalize to lowercase for consistency
    const normalizedId = id.toLowerCase();
    const knownBuiltInIds = await loadKnownBuiltInIds();

    if (!knownBuiltInIds.has(normalizedId)) {
        return { success: false, error: `Unknown built-in rule id: ${id}` };
    }

    if (!rules.disabledBuiltInIds.includes(normalizedId)) {
        rules.disabledBuiltInIds.push(normalizedId);
        await saveCustomRules(rules);
        return { success: true };
    }
    return { success: false, error: "Rule is already disabled." };
}

/**
 * Restore a disabled built-in rule by its ID.
 */
export async function restoreBuiltInRule(id: string): Promise<{ success: boolean; restored: boolean }> {
    const rules = await loadCustomRules();
    if (!rules.disabledBuiltInIds) return { success: true, restored: false };

    const normalizedId = id.toLowerCase();
    const initialCount = rules.disabledBuiltInIds.length;
    rules.disabledBuiltInIds = rules.disabledBuiltInIds.filter(d => d !== normalizedId);

    if (rules.disabledBuiltInIds.length < initialCount) {
        await saveCustomRules(rules);
        return { success: true, restored: true };
    }
    return { success: true, restored: false };
}

