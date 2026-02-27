import { cancel, confirm, isCancel } from "@clack/prompts";
import {
    disableBuiltInRule,
    loadCustomRules,
    restoreBuiltInRule,
    saveCustomRules,
} from "../storage.js";
import { loadCustomRulesFromConfig, saveCustomRulesToConfig } from "../custom-rules-config.js";
import {
    SECRET_PATTERNS,
    PII_PATTERNS,
    INTERNAL_SENSITIVE_FILE_PATTERNS,
    INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS,
} from "../../patterns/index.js";
import type {
    BerryShieldCustomCommandRule,
    BerryShieldCustomFileRule,
    BerryShieldCustomRulesConfig,
    BerryShieldCustomSecretRule,
} from "../../types/config.js";
import { ui } from "../ui/tui.js";
import { theme } from "../ui/theme.js";
import { type ConfigWrapper } from "../../config/wrapper.js";

type RuleTarget = "baseline" | "custom";
type CustomRuleKind = "secret" | "file" | "command";
type Mode = "enable" | "disable";

function collectBaselineIds(): string[] {
    const ids = [
        ...SECRET_PATTERNS.map((rule) => rule.id),
        ...PII_PATTERNS.map((rule) => rule.id),
        ...INTERNAL_SENSITIVE_FILE_PATTERNS.map((rule) => rule.id),
        ...INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS.map((rule) => rule.id),
    ];
    return Array.from(new Set(ids));
}

function parseTarget(value: string | undefined): RuleTarget | undefined {
    if (value === "baseline" || value === "custom") return value;
    return undefined;
}

function toCustomRuleId(kind: CustomRuleKind, value: string): string {
    return `${kind}:${value}`;
}

function parseCustomRuleId(input: string): { ok: true; kind: CustomRuleKind; value: string } | { ok: false } {
    const trimmed = input.trim();
    const separator = trimmed.indexOf(":");
    if (separator <= 0) return { ok: false };
    const kindRaw = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1);
    if (!value) return { ok: false };
    if (kindRaw !== "secret" && kindRaw !== "file" && kindRaw !== "command") return { ok: false };
    return { ok: true, kind: kindRaw, value };
}

function parseIdAndAll(id: string | undefined, all: boolean | undefined): {
    valid: boolean;
    id?: string;
    all: boolean;
} {
    const useAll = Boolean(all);
    const normalizedId = id?.trim();

    if (useAll && normalizedId) return { valid: false, all: true };
    if (!useAll && !normalizedId) return { valid: false, all: false };
    return { valid: true, id: normalizedId, all: useAll };
}

function printUsage(message: string): never {
    ui.scaffold({
        header: (s) => s.header("Operation Failed"),
        content: (s) => s.failureMsg(message),
    });
    process.exit(1);
}

function requireWrapperForCustom(wrapper: ConfigWrapper | undefined): ConfigWrapper {
    if (wrapper) return wrapper;
    printUsage("Custom rule state requires config wrapper context.");
}

function asConfigShapeFromStorage(state: Awaited<ReturnType<typeof loadCustomRules>>): BerryShieldCustomRulesConfig {
    const toSecret = (rule: { name: string; pattern: string; placeholder: string }): BerryShieldCustomSecretRule => ({
        name: rule.name,
        pattern: rule.pattern,
        placeholder: rule.placeholder,
        enabled: true,
    });
    const toFile = (rule: { name: string; pattern: string }): BerryShieldCustomFileRule => ({
        name: rule.name,
        pattern: rule.pattern,
        enabled: true,
    });
    const toCommand = (rule: { name: string; pattern: string }): BerryShieldCustomCommandRule => ({
        name: rule.name,
        pattern: rule.pattern,
        enabled: true,
    });

    return {
        secrets: state.secrets.map(toSecret),
        sensitiveFiles: state.sensitiveFiles.map(toFile),
        destructiveCommands: state.destructiveCommands.map(toCommand),
    };
}

async function loadEffectiveCustomRules(wrapper?: ConfigWrapper): Promise<BerryShieldCustomRulesConfig> {
    if (wrapper) {
        return loadCustomRulesFromConfig(wrapper);
    }
    const storageState = await loadCustomRules();
    return asConfigShapeFromStorage(storageState);
}

async function saveEffectiveCustomRules(wrapper: ConfigWrapper | undefined, customRules: BerryShieldCustomRulesConfig): Promise<void> {
    const realWrapper = requireWrapperForCustom(wrapper);
    await saveCustomRulesToConfig(realWrapper, customRules);
}

function setCustomRuleEnabledById(
    rules: BerryShieldCustomRulesConfig,
    id: string,
    enabled: boolean
): { exists: boolean; changed: boolean } {
    const parsed = parseCustomRuleId(id);
    if (!parsed.ok) return { exists: false, changed: false };

    const normalized = parsed.value.toLowerCase();

    if (parsed.kind === "secret") {
        const index = rules.secrets.findIndex((rule) => rule.name.toLowerCase() === normalized);
        if (index === -1) return { exists: false, changed: false };
        const previous = rules.secrets[index].enabled;
        rules.secrets[index].enabled = enabled;
        return { exists: true, changed: previous !== enabled };
    }

    if (parsed.kind === "file") {
        const index = rules.sensitiveFiles.findIndex((rule) => rule.name.toLowerCase() === normalized);
        if (index === -1) return { exists: false, changed: false };
        const previous = rules.sensitiveFiles[index].enabled;
        rules.sensitiveFiles[index].enabled = enabled;
        return { exists: true, changed: previous !== enabled };
    }

    const index = rules.destructiveCommands.findIndex((rule) => rule.name.toLowerCase() === normalized);
    if (index === -1) return { exists: false, changed: false };
    const previous = rules.destructiveCommands[index].enabled;
    rules.destructiveCommands[index].enabled = enabled;
    return { exists: true, changed: previous !== enabled };
}

function setAllCustomRulesEnabled(rules: BerryShieldCustomRulesConfig, enabled: boolean): boolean {
    let changed = false;

    for (const rule of rules.secrets) {
        if (rule.enabled !== enabled) changed = true;
        rule.enabled = enabled;
    }
    for (const rule of rules.sensitiveFiles) {
        if (rule.enabled !== enabled) changed = true;
        rule.enabled = enabled;
    }
    for (const rule of rules.destructiveCommands) {
        if (rule.enabled !== enabled) changed = true;
        rule.enabled = enabled;
    }

    return changed;
}

function hasAnyCustomRules(rules: BerryShieldCustomRulesConfig): boolean {
    return rules.secrets.length + rules.sensitiveFiles.length + rules.destructiveCommands.length > 0;
}

async function disableAllBaseline(): Promise<{ changed: boolean }> {
    const rules = await loadCustomRules();
    const baselineIds = collectBaselineIds().map((value) => value.toLowerCase());
    const current = new Set((rules.disabledBuiltInIds ?? []).map((value) => value.toLowerCase()));
    const alreadyAllDisabled = baselineIds.every((idValue) => current.has(idValue)) && current.size === baselineIds.length;
    if (alreadyAllDisabled) return { changed: false };
    rules.disabledBuiltInIds = baselineIds;
    await saveCustomRules(rules);
    return { changed: true };
}

async function enableAllBaseline(): Promise<{ changed: boolean }> {
    const rules = await loadCustomRules();
    if ((rules.disabledBuiltInIds ?? []).length === 0) return { changed: false };
    rules.disabledBuiltInIds = [];
    await saveCustomRules(rules);
    return { changed: true };
}

async function runGlobalAllOperation(mode: Mode, wrapper?: ConfigWrapper): Promise<void> {
    const realWrapper = requireWrapperForCustom(wrapper);
    const baselineSnapshot = await loadCustomRules();
    const customSnapshot = await loadCustomRulesFromConfig(realWrapper);
    const desiredEnabled = mode === "enable";

    const customWorking = structuredClone(customSnapshot);
    const customChanged = setAllCustomRulesEnabled(customWorking, desiredEnabled);
    const baselineChanged = mode === "enable"
        ? (baselineSnapshot.disabledBuiltInIds ?? []).length > 0
        : (() => {
            const baselineIds = collectBaselineIds().map((value) => value.toLowerCase());
            const current = new Set((baselineSnapshot.disabledBuiltInIds ?? []).map((value) => value.toLowerCase()));
            return !(baselineIds.every((idValue) => current.has(idValue)) && current.size === baselineIds.length);
        })();

    if (!customChanged && !baselineChanged) {
        ui.scaffold({
            header: (s) => s.header("No Changes Applied"),
            content: (s) => {
                s.warningMsg(
                    mode === "enable"
                        ? "Baseline and custom rules are already enabled."
                        : "Baseline and custom rules are already disabled."
                );
                s.row("Target", "BASELINE + CUSTOM");
                s.row("Mode", "--all");
            },
        });
        return;
    }

    let customPersisted = false;
    try {
        await saveCustomRulesToConfig(realWrapper, customWorking);
        customPersisted = true;

        const baselineWorking = structuredClone(baselineSnapshot);
        if (mode === "enable") {
            baselineWorking.disabledBuiltInIds = [];
        } else {
            baselineWorking.disabledBuiltInIds = collectBaselineIds().map((value) => value.toLowerCase());
        }
        await saveCustomRules(baselineWorking);
    } catch (error: unknown) {
        if (customPersisted) {
            try {
                await saveCustomRulesToConfig(realWrapper, customSnapshot);
            } catch {
                // Keep best-effort rollback semantics.
            }
        }
        const message = error instanceof Error ? error.message : String(error);
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => {
                s.failureMsg(`Global --all operation failed: ${message}`);
                s.warningMsg("Recovery hint: run the inverse operation with --all --yes after resolving config/storage issues.");
            },
        });
        process.exit(1);
    }

    ui.scaffold({
        header: (s) => s.header(mode === "enable" ? "Rules Enabled" : "Rules Disabled"),
        content: (s) => {
            s.successMsg(mode === "enable" ? "Baseline and custom rules enabled." : "Baseline and custom rules disabled.");
            if (mode === "disable") {
                s.warningMsg("Security impact: disabling rules may reduce protection coverage.");
            }
            s.row("Target", "BASELINE + CUSTOM");
            s.row("Mode", "--all");
        },
    });
}

export async function rulesListCommand(wrapper?: ConfigWrapper, options?: { detailed?: boolean }): Promise<void> {
    const customDelta = await loadCustomRules();
    const custom = wrapper ? await loadEffectiveCustomRules(wrapper) : asConfigShapeFromStorage(customDelta);
    const disabledSet = new Set((customDelta.disabledBuiltInIds ?? []).map((value) => value.toLowerCase()));

    const baselineRows = collectBaselineIds().map((id) => {
        const disabled = disabledSet.has(id.toLowerCase());
        const status = disabled ? theme.warning("[DISABLED]") : theme.success("[ENABLED]");
        return {
            label: "BASELINE",
            value: `id: ${id} ${status}`,
        };
    });

    const customRows = [
        ...custom.secrets.map((rule) => ({
            label: "CUSTOM",
            value: `id: ${toCustomRuleId("secret", rule.name)} ${rule.enabled ? theme.success("[ENABLED]") : theme.warning("[DISABLED]")}`,
        })),
        ...custom.sensitiveFiles.map((rule) => ({
            label: "CUSTOM",
            value: `id: ${toCustomRuleId("file", rule.name)} ${rule.enabled ? theme.success("[ENABLED]") : theme.warning("[DISABLED]")}`,
        })),
        ...custom.destructiveCommands.map((rule) => ({
            label: "CUSTOM",
            value: `id: ${toCustomRuleId("command", rule.name)} ${rule.enabled ? theme.success("[ENABLED]") : theme.warning("[DISABLED]")}`,
        })),
    ];

    ui.scaffold({
        header: (s) => s.header("Security Rules"),
        content: (s) => {
            if (options?.detailed) {
                s.section(`Baseline (${baselineRows.length})`);
                for (const rule of SECRET_PATTERNS) {
                    const disabled = disabledSet.has(rule.id.toLowerCase());
                    const status = disabled ? theme.warning("[DISABLED]") : theme.success("[ENABLED]");
                    s.row("BASELINE", `id: ${rule.id} ${status}`);
                    s.row("", `pattern: ${rule.pattern.toString()}`);
                }
                for (const rule of PII_PATTERNS) {
                    const disabled = disabledSet.has(rule.id.toLowerCase());
                    const status = disabled ? theme.warning("[DISABLED]") : theme.success("[ENABLED]");
                    s.row("BASELINE", `id: ${rule.id} ${status}`);
                    s.row("", `pattern: ${rule.pattern.toString()}`);
                }
                for (const rule of INTERNAL_SENSITIVE_FILE_PATTERNS) {
                    const disabled = disabledSet.has(rule.id.toLowerCase());
                    const status = disabled ? theme.warning("[DISABLED]") : theme.success("[ENABLED]");
                    s.row("BASELINE", `id: ${rule.id} ${status}`);
                    s.row("", `pattern: ${rule.pattern.toString()}`);
                }
                for (const rule of INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS) {
                    const disabled = disabledSet.has(rule.id.toLowerCase());
                    const status = disabled ? theme.warning("[DISABLED]") : theme.success("[ENABLED]");
                    s.row("BASELINE", `id: ${rule.id} ${status}`);
                    s.row("", `pattern: ${rule.pattern.toString()}`);
                }

                s.spacer();
                s.section(`Custom (${customRows.length})`);
                if (customRows.length === 0) {
                    s.warningMsg("No custom rules configured.");
                } else {
                    for (const rule of custom.secrets) {
                        const status = rule.enabled ? theme.success("[ENABLED]") : theme.warning("[DISABLED]");
                        s.row("CUSTOM", `id: ${toCustomRuleId("secret", rule.name)} ${status}`);
                        s.row("", `pattern: ${rule.pattern}`);
                    }
                    for (const rule of custom.sensitiveFiles) {
                        const status = rule.enabled ? theme.success("[ENABLED]") : theme.warning("[DISABLED]");
                        s.row("CUSTOM", `id: ${toCustomRuleId("file", rule.name)} ${status}`);
                        s.row("", `pattern: ${rule.pattern}`);
                    }
                    for (const rule of custom.destructiveCommands) {
                        const status = rule.enabled ? theme.success("[ENABLED]") : theme.warning("[DISABLED]");
                        s.row("CUSTOM", `id: ${toCustomRuleId("command", rule.name)} ${status}`);
                        s.row("", `pattern: ${rule.pattern}`);
                    }
                }
                return;
            }

            s.section(`Baseline (${baselineRows.length})`);
            s.table(baselineRows, 10);

            s.spacer();
            s.section(`Custom (${customRows.length})`);
            if (customRows.length === 0) {
                s.warningMsg("No custom rules configured.");
            } else {
                s.table(customRows, 10);
            }
        },
    });
}

export async function rulesRemoveCommand(
    target: string,
    id: string | undefined,
    wrapper?: ConfigWrapper
): Promise<void> {
    const parsedTarget = parseTarget(target);
    if (parsedTarget !== "custom") {
        printUsage("Usage: openclaw bshield rules remove custom <id>\nExpected format: secret:<name> | file:<name> | command:<name>");
    }
    if (!id) {
        printUsage("Usage: openclaw bshield rules remove custom <id>\nExpected format: secret:<name> | file:<name> | command:<name>");
    }

    const parsed = parseCustomRuleId(id);
    if (!parsed.ok) {
        printUsage("Invalid identifier. Use: secret:<name> | file:<name> | command:<name>");
    }

    let removed = false;
    if (wrapper) {
        const customRules = await loadCustomRulesFromConfig(wrapper);
        if (parsed.kind === "secret") {
            const initial = customRules.secrets.length;
            customRules.secrets = customRules.secrets.filter((rule) => rule.name.toLowerCase() !== parsed.value.toLowerCase());
            removed = customRules.secrets.length < initial;
        } else if (parsed.kind === "file") {
            const initial = customRules.sensitiveFiles.length;
            customRules.sensitiveFiles = customRules.sensitiveFiles.filter((rule) => rule.name.toLowerCase() !== parsed.value.toLowerCase());
            removed = customRules.sensitiveFiles.length < initial;
        } else {
            const initial = customRules.destructiveCommands.length;
            customRules.destructiveCommands = customRules.destructiveCommands.filter((rule) => rule.name.toLowerCase() !== parsed.value.toLowerCase());
            removed = customRules.destructiveCommands.length < initial;
        }

        if (removed) {
            await saveCustomRulesToConfig(wrapper, customRules);
        }
    } else {
        const customRules = await loadCustomRules();
        if (parsed.kind === "secret") {
            const initial = customRules.secrets.length;
            customRules.secrets = customRules.secrets.filter((rule) => rule.name.toLowerCase() !== parsed.value.toLowerCase());
            removed = customRules.secrets.length < initial;
        } else if (parsed.kind === "file") {
            const initial = customRules.sensitiveFiles.length;
            customRules.sensitiveFiles = customRules.sensitiveFiles.filter((rule) => rule.name.toLowerCase() !== parsed.value.toLowerCase());
            removed = customRules.sensitiveFiles.length < initial;
        } else {
            const initial = customRules.destructiveCommands.length;
            customRules.destructiveCommands = customRules.destructiveCommands.filter((rule) => rule.name.toLowerCase() !== parsed.value.toLowerCase());
            removed = customRules.destructiveCommands.length < initial;
        }

        if (removed) {
            await saveCustomRules(customRules);
        }
    }

    if (!removed) {
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg(`Custom rule '${id}' not found.`),
        });
        process.exit(1);
    }

    ui.scaffold({
        header: (s) => s.header("Custom Rule Removed"),
        content: (s) => {
            s.successMsg("Custom rule removed successfully.");
            s.row("Target", "CUSTOM");
            s.row("ID", id);
        },
    });
}

async function runCustomTargetOperation(mode: Mode, id: string | undefined, all: boolean, wrapper?: ConfigWrapper): Promise<void> {
    const customRules = await loadEffectiveCustomRules(wrapper);
    const desiredEnabled = mode === "enable";

    if (all) {
        if (!hasAnyCustomRules(customRules)) {
            ui.scaffold({
                header: (s) => s.header("No Changes Applied"),
                content: (s) => {
                    s.warningMsg("No custom rules configured.");
                    s.row("Target", "CUSTOM");
                    s.row("Mode", "--all");
                },
            });
            return;
        }

        const changed = setAllCustomRulesEnabled(customRules, desiredEnabled);
        if (!changed) {
            ui.scaffold({
                header: (s) => s.header("No Changes Applied"),
                content: (s) => {
                    s.warningMsg(desiredEnabled ? "All custom rules are already enabled." : "All custom rules are already disabled.");
                    s.row("Target", "CUSTOM");
                    s.row("Mode", "--all");
                },
            });
            return;
        }

        await saveEffectiveCustomRules(wrapper, customRules);

        ui.scaffold({
            header: (s) => s.header(desiredEnabled ? "Custom Rules Enabled" : "Custom Rules Disabled"),
            content: (s) => {
                s.successMsg(desiredEnabled ? "All custom rules enabled." : "All custom rules disabled.");
                if (!desiredEnabled) {
                    s.warningMsg("Security impact: disabling custom rules may reduce coverage.");
                }
                s.row("Target", "CUSTOM");
                s.row("Mode", "--all");
            },
        });
        return;
    }

    if (!id) {
        printUsage(`Usage: openclaw bshield rules ${mode} custom <id> | --all [--yes]`);
    }

    const parsed = parseCustomRuleId(id);
    if (!parsed.ok) {
        printUsage("Invalid custom identifier. Use: secret:<name> | file:<name> | command:<name>");
    }

    const result = setCustomRuleEnabledById(customRules, id, desiredEnabled);
    if (!result.exists) {
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg(`Unknown custom rule id: ${id}`),
        });
        process.exit(1);
    }

    if (!result.changed) {
        ui.scaffold({
            header: (s) => s.header("No Changes Applied"),
            content: (s) => {
                s.warningMsg(desiredEnabled ? "Custom rule is already enabled." : "Custom rule is already disabled.");
                s.row("ID", id);
            },
        });
        return;
    }

    await saveEffectiveCustomRules(wrapper, customRules);

    ui.scaffold({
        header: (s) => s.header(desiredEnabled ? "Custom Rule Enabled" : "Custom Rule Disabled"),
        content: (s) => {
            s.successMsg(desiredEnabled ? "Custom rule enabled successfully." : "Custom rule disabled successfully.");
            if (!desiredEnabled) {
                s.warningMsg("Security impact: disabling custom rules may reduce protection coverage.");
            }
            s.row("Target", "CUSTOM");
            s.row("ID", id);
        },
    });
}

async function runBaselineTargetOperation(mode: Mode, id: string | undefined, all: boolean, options: { yes?: boolean }): Promise<void> {
    if (all) {
        if (mode === "disable") {
            const result = await disableAllBaseline();
            if (!result.changed) {
                ui.scaffold({
                    header: (s) => s.header("No Changes Applied"),
                    content: (s) => {
                        s.warningMsg("All baseline rules are already disabled.");
                        s.row("Target", "BASELINE");
                        s.row("Mode", "--all");
                    },
                });
                return;
            }
            ui.scaffold({
                header: (s) => s.header("Baseline Disabled"),
                content: (s) => {
                    s.successMsg("All baseline rules disabled.");
                    s.warningMsg("Security impact: baseline coverage was reduced.");
                    s.row("Target", "BASELINE");
                    s.row("Mode", "--all");
                },
            });
            return;
        }

        const result = await enableAllBaseline();
        if (!result.changed) {
            ui.scaffold({
                header: (s) => s.header("No Changes Applied"),
                content: (s) => {
                    s.warningMsg("All baseline rules are already enabled.");
                    s.row("Target", "BASELINE");
                    s.row("Mode", "--all");
                },
            });
            return;
        }
        ui.scaffold({
            header: (s) => s.header("Baseline Enabled"),
            content: (s) => {
                s.successMsg("All baseline rules enabled.");
                s.row("Target", "BASELINE");
                s.row("Mode", "--all");
            },
        });
        return;
    }

    if (!id) {
        printUsage(`Usage: openclaw bshield rules ${mode} baseline <id> | --all [--yes]`);
    }

    if (mode === "disable") {
        const result = await disableBuiltInRule(id);
        if (!result.success) {
            if (result.error === "Rule is already disabled.") {
                ui.scaffold({
                    header: (s) => s.header("No Changes Applied"),
                    content: (s) => {
                        s.warningMsg("Baseline rule is already disabled.");
                        s.row("ID", id);
                    },
                });
                return;
            }
            ui.scaffold({
                header: (s) => s.header("Operation Failed"),
                content: (s) => s.failureMsg(result.error ?? "Failed to disable baseline rule."),
            });
            process.exit(1);
        }

        ui.scaffold({
            header: (s) => s.header("Baseline Rule Disabled"),
            content: (s) => {
                s.successMsg("Baseline rule disabled successfully.");
                s.warningMsg("Security impact: disabling baseline rules may reduce protection coverage.");
                s.row("Target", "BASELINE");
                s.row("ID", id);
            },
        });
        return;
    }

    const knownIds = new Set(collectBaselineIds().map((value) => value.toLowerCase()));
    const normalizedId = id.toLowerCase();
    if (!knownIds.has(normalizedId)) {
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg(`Unknown baseline rule id: ${id}`),
        });
        process.exit(1);
    }

    const result = await restoreBuiltInRule(id);
    if (!result.success) {
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg("Failed to enable baseline rule."),
        });
        process.exit(1);
    }

    if (!result.restored) {
        ui.scaffold({
            header: (s) => s.header("No Changes Applied"),
            content: (s) => {
                s.warningMsg("Baseline rule is already enabled.");
                s.row("ID", id);
            },
        });
        return;
    }

    ui.scaffold({
        header: (s) => s.header("Baseline Rule Enabled"),
        content: (s) => {
            s.successMsg("Baseline rule enabled successfully.");
            s.row("Target", "BASELINE");
            s.row("ID", id);
        },
    });
    void options;
}

async function runRulesToggle(
    mode: Mode,
    targetRaw: string | undefined,
    id: string | undefined,
    options: { all?: boolean; yes?: boolean },
    wrapper?: ConfigWrapper,
): Promise<void> {
    const parsedTarget = parseTarget(targetRaw);
    const parsed = parseIdAndAll(id, options.all);
    if (!parsed.valid) {
        printUsage(`Usage: openclaw bshield rules ${mode} [baseline|custom] <id> | --all [--yes]`);
    }

    if (parsed.all && !options.yes) {
        const confirmation = await confirm({
            message: parsedTarget
                ? `${mode === "disable" ? "Disable" : "Enable"} all ${parsedTarget} rules?`
                : `${mode === "disable" ? "Disable" : "Enable"} all baseline and custom rules?`,
            initialValue: false,
        });
        if (isCancel(confirmation) || !confirmation) {
            cancel("Operation cancelled.");
            return;
        }
    }

    if (!parsedTarget && parsed.all) {
        await runGlobalAllOperation(mode, wrapper);
        return;
    }

    if (!parsedTarget && !parsed.all) {
        printUsage(`Usage: openclaw bshield rules ${mode} [baseline|custom] <id> | --all [--yes]`);
    }

    if (parsedTarget === "custom") {
        await runCustomTargetOperation(mode, parsed.id, parsed.all, wrapper);
        return;
    }

    await runBaselineTargetOperation(mode, parsed.id, parsed.all, options);
}

export async function rulesDisableCommand(
    target: string | undefined,
    id: string | undefined,
    options: { all?: boolean; yes?: boolean },
    wrapper?: ConfigWrapper,
): Promise<void> {
    await runRulesToggle("disable", target, id, options, wrapper);
}

export async function rulesEnableCommand(
    target: string | undefined,
    id: string | undefined,
    options: { all?: boolean; yes?: boolean },
    wrapper?: ConfigWrapper,
): Promise<void> {
    await runRulesToggle("enable", target, id, options, wrapper);
}
