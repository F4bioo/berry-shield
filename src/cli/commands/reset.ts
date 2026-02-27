import { cancel, confirm, isCancel } from "@clack/prompts";
import { DEFAULT_CONFIG } from "../../config/defaults.js";
import { CONFIG_PATHS } from "../../constants.js";
import type { OpenClawPluginCliContext } from "../../types/openclaw-local.js";
import type { ConfigWrapper } from "../../config/wrapper.js";
import { loadCustomRules, saveCustomRules } from "../storage.js";
import { mergeConfig } from "../../config/utils.js";
import { ui } from "../ui/tui.js";

type ResetScope = "builtins" | "all";

function parseScope(value: string | undefined): ResetScope {
    if (value === "all") return "all";
    return "builtins";
}

function printUsageError(): never {
    ui.scaffold({
        header: (s) => s.header("Operation Failed"),
        content: (s) => s.failureMsg("Usage: openclaw bshield reset defaults [--scope builtins|all] [--yes]"),
    });
    process.exit(1);
}

export async function resetCommand(
    target: string | undefined,
    options: { scope?: string; yes?: boolean },
    context: OpenClawPluginCliContext,
    wrapper: ConfigWrapper
): Promise<void> {
    if (target !== "defaults") {
        printUsageError();
    }

    const scope = parseScope(options.scope);
    if (options.scope && options.scope !== "builtins" && options.scope !== "all") {
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg("Invalid --scope. Use: builtins, all"),
        });
        process.exit(1);
    }

    if (!options.yes) {
        const confirmation = await confirm({
            message: scope === "all"
                ? "Reset defaults for built-ins, custom rules, and policy?"
                : "Reset built-in defaults (clear disabled built-ins)?",
            initialValue: false,
        });
        if (isCancel(confirmation) || !confirmation) {
            cancel("Operation cancelled.");
            return;
        }
    }

    const rulesDelta = await loadCustomRules();
    const previouslyDisabled = (rulesDelta.disabledBuiltInIds ?? []).length;
    rulesDelta.disabledBuiltInIds = [];

    let previousCustomCount = 0;
    let customRules = DEFAULT_CONFIG.customRules;

    if (scope === "all") {
        const rawPluginConfig = await wrapper.get<unknown>(CONFIG_PATHS.PLUGIN_CONFIG) || {};
        const shieldConfig = mergeConfig(rawPluginConfig);
        customRules = shieldConfig.customRules;
        previousCustomCount = customRules.secrets.length + customRules.sensitiveFiles.length + customRules.destructiveCommands.length;

        customRules.secrets = [];
        customRules.sensitiveFiles = [];
        customRules.destructiveCommands = [];
    }

    try {
        await saveCustomRules(rulesDelta);
        if (scope === "all") {
            await wrapper.set(CONFIG_PATHS.CUSTOM_RULES_CONFIG, customRules);
        }
        if (scope === "all") {
            await wrapper.set(CONFIG_PATHS.POLICY_CONFIG, DEFAULT_CONFIG.policy);
        }

        ui.scaffold({
            header: (s) => s.header("Defaults Restored"),
            content: (s) => {
                s.successMsg("Default reset completed.");
                s.row("Scope", scope.toUpperCase());
                s.row("Disabled built-ins cleared", String(previouslyDisabled));
                if (scope === "all") {
                    s.row("Custom rules cleared", String(previousCustomCount));
                    s.row("Policy restored", "true");
                }
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        context.logger.error?.(`[berry-shield] CLI error: Failed to reset defaults: ${message}`);
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg(`Failed to reset defaults: ${message}`),
        });
        process.exit(1);
    }
}
