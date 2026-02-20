import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { disableBuiltInRule, loadCustomRules } from "../storage.js";
import {
    SECRET_PATTERNS,
    PII_PATTERNS,
    INTERNAL_SENSITIVE_FILE_PATTERNS,
    INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS,
} from "../../patterns/index.js";
import { ui } from "../ui/tui.js";

type PluginLogger = OpenClawPluginApi["logger"];
type BuiltInType = "secret" | "pii" | "file" | "command";

interface BuiltInRule {
    id: string;
    type: BuiltInType;
}

function collectBuiltInRules(): BuiltInRule[] {
    return [
        ...SECRET_PATTERNS.map((rule) => ({ id: rule.id, type: "secret" as const })),
        ...PII_PATTERNS.map((rule) => ({ id: rule.id, type: "pii" as const })),
        ...INTERNAL_SENSITIVE_FILE_PATTERNS.map((rule) => ({ id: rule.id, type: "file" as const })),
        ...INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS.map((rule) => ({ id: rule.id, type: "command" as const })),
    ];
}

function parseType(value: string | undefined): BuiltInType | undefined {
    if (value === "secret" || value === "pii" || value === "file" || value === "command") {
        return value;
    }
    return undefined;
}

export async function builtinListCommand(
    options: { type?: string },
    logger: PluginLogger
): Promise<void> {
    const requestedType = parseType(options.type);
    if (options.type && !requestedType) {
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg("Invalid --type. Use: secret, pii, file, command"),
        });
        process.exit(1);
    }

    const allBuiltIns = collectBuiltInRules();
    const filteredBuiltIns = (requestedType
        ? allBuiltIns.filter((rule) => rule.type === requestedType)
        : allBuiltIns);

    const customRules = await loadCustomRules();
    const disabled = new Set((customRules.disabledBuiltInIds ?? []).map((entry) => entry.toLowerCase()));

    ui.scaffold({
        header: (s) => s.header("Built-in Rules"),
        content: (s) => {
            if (filteredBuiltIns.length === 0) {
                s.warningMsg("No built-in rules found for the selected filter.");
                return;
            }

            const rows = filteredBuiltIns.map((rule) => ({
                label: rule.type.toUpperCase(),
                value: `${rule.id}${disabled.has(rule.id.toLowerCase()) ? " [DISABLED]" : ""}`,
            }));

            s.table(rows, 10);
        },
    });
    logger.debug?.("[berry-shield] CLI: Listed built-in rules");
}

export async function builtinRemoveCommand(
    id: string,
    options: { type?: string },
    logger: PluginLogger
): Promise<void> {
    const requestedType = parseType(options.type);
    if (options.type && !requestedType) {
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg("Invalid --type. Use: secret, pii, file, command"),
        });
        process.exit(1);
    }

    const allBuiltIns = collectBuiltInRules();
    const filteredBuiltIns = requestedType
        ? allBuiltIns.filter((rule) => rule.type === requestedType)
        : allBuiltIns;

    const builtIn = filteredBuiltIns.find((rule) => rule.id.toLowerCase() === id.toLowerCase());
    if (!builtIn) {
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg(`Built-in rule '${id}' not found.`),
        });
        process.exit(1);
    }

    const result = await disableBuiltInRule(builtIn.id);
    if (!result.success) {
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg(result.error ?? "Failed to disable built-in rule."),
        });
        process.exit(1);
    }

    ui.scaffold({
        header: (s) => s.header("Built-in Rule Disabled"),
        content: (s) => {
            s.successMsg("Built-in rule disabled successfully.");
            s.warningMsg("Security impact: disabling built-in rules may reduce protection coverage.");
            s.row("Type", builtIn.type.toUpperCase());
            s.row("ID", builtIn.id);
        },
    });
    logger.info?.(`[berry-shield] CLI: Disabled built-in rule ${builtIn.id}`);
}
