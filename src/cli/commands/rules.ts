import { cancel, confirm, isCancel } from "@clack/prompts";
import {
    disableBuiltInRule,
    loadCustomRules,
    removeCustomRule,
    restoreBuiltInRule,
    saveCustomRules,
} from "../storage.js";
import {
    SECRET_PATTERNS,
    PII_PATTERNS,
    INTERNAL_SENSITIVE_FILE_PATTERNS,
    INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS,
} from "../../patterns/index.js";
import { ui } from "../ui/tui.js";
import { theme } from "../ui/theme.js";

type RuleTarget = "baseline" | "custom";

function collectBaselineIds(): string[] {
    const ids = [
        ...SECRET_PATTERNS.map((rule) => rule.id),
        ...PII_PATTERNS.map((rule) => rule.id),
        ...INTERNAL_SENSITIVE_FILE_PATTERNS.map((rule) => rule.id),
        ...INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS.map((rule) => rule.id),
    ];
    return Array.from(new Set(ids));
}

function parseTarget(value: string): RuleTarget | undefined {
    if (value === "baseline" || value === "custom") return value;
    return undefined;
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

export async function rulesListCommand(): Promise<void> {
    const custom = await loadCustomRules();
    const disabledSet = new Set((custom.disabledBuiltInIds ?? []).map((value) => value.toLowerCase()));

    const baselineRows = collectBaselineIds().map((id) => {
        const disabled = disabledSet.has(id.toLowerCase());
        const status = disabled ? theme.warning("[DISABLED]") : theme.success("[ENABLED]");
        return {
            label: "BASELINE",
            value: `id: ${id} ${status}`,
        };
    });

    const customRows = [
        ...custom.secrets.map((rule) => ({ label: "CUSTOM", value: `name: ${rule.name} ${theme.success("[ENABLED]")}` })),
        ...custom.sensitiveFiles.map((rule) => ({ label: "CUSTOM", value: `name: ${rule.pattern} ${theme.success("[ENABLED]")}` })),
        ...custom.destructiveCommands.map((rule) => ({ label: "CUSTOM", value: `name: ${rule.pattern} ${theme.success("[ENABLED]")}` })),
    ];

    ui.scaffold({
        header: (s) => s.header("Security Rules"),
        content: (s) => {
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
    name: string | undefined,
): Promise<void> {
    const parsedTarget = parseTarget(target);
    if (parsedTarget !== "custom") {
        printUsage("Usage: openclaw bshield rules remove custom <name>");
    }
    if (!name) {
        printUsage("Usage: openclaw bshield rules remove custom <name>");
    }

    const result = await removeCustomRule(name);
    if (!result.success || !result.removed) {
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg(`Custom rule '${name}' not found.`),
        });
        process.exit(1);
    }

    ui.scaffold({
        header: (s) => s.header("Custom Rule Removed"),
        content: (s) => {
            s.successMsg("Custom rule removed successfully.");
            s.row("Target", "CUSTOM");
            s.row("Name", name);
        },
    });

}

export async function rulesDisableCommand(
    target: string,
    id: string | undefined,
    options: { all?: boolean; yes?: boolean },
): Promise<void> {
    const parsedTarget = parseTarget(target);
    if (parsedTarget !== "baseline") {
        printUsage("Usage: openclaw bshield rules disable baseline <id> | --all [--yes]");
    }

    const parsed = parseIdAndAll(id, options.all);
    if (!parsed.valid) {
        printUsage("Usage: openclaw bshield rules disable baseline <id> | --all [--yes]");
    }

    if (parsed.all) {
        if (!options.yes) {
            const confirmation = await confirm({
                message: "Disable all baseline rules? This significantly reduces default protection.",
                initialValue: false,
            });
            if (isCancel(confirmation) || !confirmation) {
                cancel("Operation cancelled.");
                return;
            }
        }

        const rules = await loadCustomRules();
        const baselineIds = collectBaselineIds().map((value) => value.toLowerCase());
        const current = new Set((rules.disabledBuiltInIds ?? []).map((value) => value.toLowerCase()));
        const alreadyAllDisabled = baselineIds.every((idValue) => current.has(idValue)) && current.size === baselineIds.length;
        if (alreadyAllDisabled) {
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

        rules.disabledBuiltInIds = baselineIds;
        await saveCustomRules(rules);

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

    const result = await disableBuiltInRule(parsed.id!);
    if (!result.success) {
        if (result.error === "Rule is already disabled.") {
            ui.scaffold({
                header: (s) => s.header("No Changes Applied"),
                content: (s) => {
                    s.warningMsg("Baseline rule is already disabled.");
                    s.row("ID", parsed.id!);
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
            s.row("ID", parsed.id!);
        },
    });

}

export async function rulesEnableCommand(
    target: string,
    id: string | undefined,
    options: { all?: boolean; yes?: boolean },
): Promise<void> {
    const parsedTarget = parseTarget(target);
    if (parsedTarget !== "baseline") {
        printUsage("Usage: openclaw bshield rules enable baseline <id> | --all [--yes]");
    }

    const parsed = parseIdAndAll(id, options.all);
    if (!parsed.valid) {
        printUsage("Usage: openclaw bshield rules enable baseline <id> | --all [--yes]");
    }

    if (parsed.all) {
        if (!options.yes) {
            const confirmation = await confirm({
                message: "Enable all baseline rules?",
                initialValue: false,
            });
            if (isCancel(confirmation) || !confirmation) {
                cancel("Operation cancelled.");
                return;
            }
        }

        const rules = await loadCustomRules();
        if ((rules.disabledBuiltInIds ?? []).length === 0) {
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
        rules.disabledBuiltInIds = [];
        await saveCustomRules(rules);

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

    const knownIds = new Set(collectBaselineIds().map((value) => value.toLowerCase()));
    const normalizedId = parsed.id!.toLowerCase();
    if (!knownIds.has(normalizedId)) {
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg(`Unknown baseline rule id: ${parsed.id!}`),
        });
        process.exit(1);
    }

    const result = await restoreBuiltInRule(parsed.id!);
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
                s.row("ID", parsed.id!);
            },
        });
        return;
    }

    ui.scaffold({
        header: (s) => s.header("Baseline Rule Enabled"),
        content: (s) => {
            s.successMsg("Baseline rule enabled successfully.");
            s.row("Target", "BASELINE");
            s.row("ID", parsed.id!);
        },
    });
}
