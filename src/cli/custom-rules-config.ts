import { mergeConfig } from "../config/utils.js";
import { CONFIG_PATHS } from "../constants.js";
import type {
    BerryShieldCustomCommandRule,
    BerryShieldCustomFileRule,
    BerryShieldCustomRulesConfig,
    BerryShieldCustomSecretRule,
} from "../types/config.js";
import type { ConfigWrapper } from "../config/wrapper.js";

export type CustomRuleType = "secret" | "file" | "command";

export interface AddCustomRuleOptions {
    name?: string;
    pattern: string;
    placeholder?: string;
    force?: boolean;
}

export interface AddCustomRuleResult {
    success: boolean;
    error?: string;
    rule?: BerryShieldCustomSecretRule | BerryShieldCustomFileRule | BerryShieldCustomCommandRule;
}

const MAX_ITEMS_PER_LIST = 500;
const MAX_PATTERN_LENGTH = 512;

function normalizeName(value: string): string {
    return value.trim().toLowerCase();
}

export function generatePlaceholder(name: string): string {
    const sanitized = name.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    return `[${sanitized}_REDACTED]`;
}

export function validateRegex(pattern: string): { valid: boolean; error?: string } {
    if (pattern.length > MAX_PATTERN_LENGTH) {
        return { valid: false, error: `Pattern exceeds ${MAX_PATTERN_LENGTH} characters.` };
    }
    try {
        new RegExp(pattern, "gi");
        return { valid: true };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return { valid: false, error: message };
    }
}

function enforceListLimit<T>(entries: T[], label: string): void {
    if (entries.length > MAX_ITEMS_PER_LIST) {
        throw new Error(`${label} exceeds maximum of ${MAX_ITEMS_PER_LIST} entries.`);
    }
}

function normalizeCustomRulesConfig(customRules: BerryShieldCustomRulesConfig): BerryShieldCustomRulesConfig {
    return {
        secrets: customRules.secrets.map((rule) => ({
            ...rule,
            enabled: typeof rule.enabled === "boolean" ? rule.enabled : true,
        })),
        sensitiveFiles: customRules.sensitiveFiles.map((rule) => ({
            ...rule,
            enabled: typeof rule.enabled === "boolean" ? rule.enabled : true,
        })),
        destructiveCommands: customRules.destructiveCommands.map((rule) => ({
            ...rule,
            enabled: typeof rule.enabled === "boolean" ? rule.enabled : true,
        })),
    };
}

function validateCustomRulesConfig(customRules: BerryShieldCustomRulesConfig): void {
    for (const rule of customRules.secrets) {
        if (!rule.name.trim()) throw new Error("Secret rule name cannot be empty.");
        if (!rule.placeholder.trim()) throw new Error(`Secret rule '${rule.name}' placeholder cannot be empty.`);
        if (typeof rule.enabled !== "boolean") throw new Error(`Secret rule '${rule.name}' enabled must be boolean.`);
        const validation = validateRegex(rule.pattern);
        if (!validation.valid) throw new Error(`Invalid secret regex for '${rule.name}': ${validation.error}`);
    }
    for (const rule of customRules.sensitiveFiles) {
        if (!rule.name.trim()) throw new Error("Sensitive file rule name cannot be empty.");
        if (typeof rule.enabled !== "boolean") throw new Error(`Sensitive file rule '${rule.name}' enabled must be boolean.`);
        const validation = validateRegex(rule.pattern);
        if (!validation.valid) throw new Error(`Invalid sensitive file regex for '${rule.name}': ${validation.error}`);
    }
    for (const rule of customRules.destructiveCommands) {
        if (!rule.name.trim()) throw new Error("Destructive command rule name cannot be empty.");
        if (typeof rule.enabled !== "boolean") throw new Error(`Destructive command rule '${rule.name}' enabled must be boolean.`);
        const validation = validateRegex(rule.pattern);
        if (!validation.valid) throw new Error(`Invalid destructive command regex for '${rule.name}': ${validation.error}`);
    }

    enforceListLimit(customRules.secrets, "customRules.secrets");
    enforceListLimit(customRules.sensitiveFiles, "customRules.sensitiveFiles");
    enforceListLimit(customRules.destructiveCommands, "customRules.destructiveCommands");
}

async function loadEffectiveConfig(wrapper: ConfigWrapper) {
    const rawPluginConfig = await wrapper.get<unknown>(CONFIG_PATHS.PLUGIN_CONFIG) || {};
    return mergeConfig(rawPluginConfig);
}

async function pruneRootRuleArrays(wrapper: ConfigWrapper): Promise<void> {
    const legacyPaths = [
        `${CONFIG_PATHS.PLUGIN_CONFIG}.sensitiveFilePaths`,
        `${CONFIG_PATHS.PLUGIN_CONFIG}.destructiveCommands`,
    ];

    for (const path of legacyPaths) {
        try {
            await wrapper.unset(path);
        } catch {
            // Best effort: path may not exist in current config.
        }
    }
}

export async function loadCustomRulesFromConfig(wrapper: ConfigWrapper): Promise<BerryShieldCustomRulesConfig> {
    const config = await loadEffectiveConfig(wrapper);
    return normalizeCustomRulesConfig(config.customRules);
}

export async function saveCustomRulesToConfig(
    wrapper: ConfigWrapper,
    customRules: BerryShieldCustomRulesConfig
): Promise<void> {
    const normalized = normalizeCustomRulesConfig(customRules);
    validateCustomRulesConfig(normalized);
    await wrapper.set(CONFIG_PATHS.CUSTOM_RULES_CONFIG, normalized);
    await pruneRootRuleArrays(wrapper);
}

export async function addCustomRuleToConfig(
    wrapper: ConfigWrapper,
    type: CustomRuleType,
    options: AddCustomRuleOptions
): Promise<AddCustomRuleResult> {
    const { name, pattern, placeholder, force } = options;
    const validation = validateRegex(pattern);
    if (!validation.valid) {
        return { success: false, error: `Invalid regex pattern: ${validation.error}` };
    }

    const customRules = await loadCustomRulesFromConfig(wrapper);

    if (type === "secret") {
        if (!name || !name.trim()) return { success: false, error: "Secret rules require a name." };

        const normalized = normalizeName(name);
        const exists = customRules.secrets.some((rule) => normalizeName(rule.name) === normalized);
        if (exists && !force) {
            return { success: false, error: `Rule '${name}' already exists. Use --force to override.` };
        }

        if (exists) {
            customRules.secrets = customRules.secrets.filter((rule) => normalizeName(rule.name) !== normalized);
        }

        const rule: BerryShieldCustomSecretRule = {
            name: name.trim(),
            pattern,
            placeholder: placeholder ?? generatePlaceholder(name),
            enabled: true,
        };
        customRules.secrets.push(rule);
        await saveCustomRulesToConfig(wrapper, customRules);
        return { success: true, rule };
    }

    if (type === "file") {
        if (!name || !name.trim()) return { success: false, error: "File rules require a name." };
        const normalized = normalizeName(name);
        const exists = customRules.sensitiveFiles.some((rule) => normalizeName(rule.name) === normalized);
        if (exists && !force) {
            return { success: false, error: `Rule '${name}' already exists. Use --force to override.` };
        }
        if (exists) {
            customRules.sensitiveFiles = customRules.sensitiveFiles.filter((rule) => normalizeName(rule.name) !== normalized);
        }
        const rule: BerryShieldCustomFileRule = { name: name.trim(), pattern, enabled: true };
        customRules.sensitiveFiles.push(rule);
        await saveCustomRulesToConfig(wrapper, customRules);
        return { success: true, rule };
    }

    if (!name || !name.trim()) return { success: false, error: "Command rules require a name." };
    const normalized = normalizeName(name);
    const exists = customRules.destructiveCommands.some((rule) => normalizeName(rule.name) === normalized);
    if (exists && !force) {
        return { success: false, error: `Rule '${name}' already exists. Use --force to override.` };
    }
    if (exists) {
        customRules.destructiveCommands = customRules.destructiveCommands.filter((rule) => normalizeName(rule.name) !== normalized);
    }
    const rule: BerryShieldCustomCommandRule = { name: name.trim(), pattern, enabled: true };
    customRules.destructiveCommands.push(rule);
    await saveCustomRulesToConfig(wrapper, customRules);
    return { success: true, rule };
}

export async function removeCustomRuleFromConfig(
    wrapper: ConfigWrapper,
    identifier: string
): Promise<{ success: boolean; removed: boolean; type?: string }> {
    const customRules = await loadCustomRulesFromConfig(wrapper);
    let removed = false;
    let type: string | undefined;

    const initialSecrets = customRules.secrets.length;
    customRules.secrets = customRules.secrets.filter((rule) => normalizeName(rule.name) !== normalizeName(identifier));
    if (customRules.secrets.length < initialSecrets) {
        removed = true;
        type = "secret";
    }

    if (!removed) {
        const initialFiles = customRules.sensitiveFiles.length;
        customRules.sensitiveFiles = customRules.sensitiveFiles.filter((rule) => normalizeName(rule.name) !== normalizeName(identifier));
        if (customRules.sensitiveFiles.length < initialFiles) {
            removed = true;
            type = "file";
        }
    }

    if (!removed) {
        const initialCommands = customRules.destructiveCommands.length;
        customRules.destructiveCommands = customRules.destructiveCommands.filter((rule) => normalizeName(rule.name) !== normalizeName(identifier));
        if (customRules.destructiveCommands.length < initialCommands) {
            removed = true;
            type = "command";
        }
    }

    if (!removed) return { success: true, removed: false };

    await saveCustomRulesToConfig(wrapper, customRules);
    return { success: true, removed: true, type };
}
