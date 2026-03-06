import type { OpenClawPluginCliContext } from "../../types/openclaw-local.js";
import type { ConfigWrapper } from "../../config/wrapper.js";
import { CONFIG_PATHS, VINE_CONFIRMATION_STRATEGY } from "../../constants.js";
import { mergeConfig } from "../../config/utils.js";
import { ui } from "../ui/tui.js";
import { cancel, isCancel, select } from "@clack/prompts";
import { isatty } from "node:tty";

type VineAction = "status" | "get" | "set" | "allow" | "deny" | "confirmation";
type VinePath =
    | "mode"
    | "thresholds.externalSignalsToEscalate"
    | "thresholds.forcedGuardTurns"
    | "retention.maxEntries"
    | "retention.ttlSeconds"
    | "confirmation.strategy"
    | "confirmation.codeTtlSeconds"
    | "confirmation.maxAttempts"
    | "confirmation.windowSeconds"
    | "confirmation.maxActionsPerWindow";

const VALID_ACTIONS: readonly VineAction[] = ["status", "get", "set", "allow", "deny", "confirmation"];
const VALID_VINE_PATHS: readonly VinePath[] = [
    "mode",
    "thresholds.externalSignalsToEscalate",
    "thresholds.forcedGuardTurns",
    "retention.maxEntries",
    "retention.ttlSeconds",
    "confirmation.strategy",
    "confirmation.codeTtlSeconds",
    "confirmation.maxAttempts",
    "confirmation.windowSeconds",
    "confirmation.maxActionsPerWindow",
];

function isVineAction(value: string | undefined): value is VineAction {
    return typeof value === "string" && (VALID_ACTIONS as readonly string[]).includes(value);
}

function isVinePath(value: string | undefined): value is VinePath {
    return typeof value === "string" && (VALID_VINE_PATHS as readonly string[]).includes(value);
}

function parseInteger(value: string, fieldLabel: string, min: number): { ok: true; value: number } | { ok: false; error: string } {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
        return { ok: false, error: `${fieldLabel} must be an integer.` };
    }
    if (parsed < min) {
        return { ok: false, error: `${fieldLabel} must be >= ${min}.` };
    }
    return { ok: true, value: parsed };
}

function parsePathValue(path: VinePath, rawValue: string): { ok: true; value: string | number } | { ok: false; error: string } {
    if (path === "mode") {
        if (rawValue === "balanced" || rawValue === "strict") {
            return { ok: true, value: rawValue };
        }
        return { ok: false, error: "mode must be one of: balanced, strict." };
    }
    if (path === "confirmation.strategy") {
        if (rawValue === VINE_CONFIRMATION_STRATEGY.ONE_TO_ONE || rawValue === VINE_CONFIRMATION_STRATEGY.ONE_TO_MANY) {
            return { ok: true, value: rawValue };
        }
        return {
            ok: false,
            error: `confirmation.strategy must be one of: ${VINE_CONFIRMATION_STRATEGY.ONE_TO_ONE}, ${VINE_CONFIRMATION_STRATEGY.ONE_TO_MANY}.`,
        };
    }
    return parseInteger(rawValue, path, 1);
}

function printUsageError(message: string): never {
    ui.scaffold({
        header: (s) => s.header("Operation Failed"),
        content: (s) => s.failureMsg(message),
    });
    process.exit(1);
}

async function readEffectiveVine(wrapper: ConfigWrapper) {
    const rawPluginConfig = await wrapper.get<unknown>(CONFIG_PATHS.PLUGIN_CONFIG) || {};
    const shieldConfig = mergeConfig(rawPluginConfig);
    return shieldConfig.vine;
}

function getPathValue(obj: unknown, path?: string): unknown {
    if (!path) return obj;
    if (!obj || typeof obj !== "object") return undefined;

    const parts = path.split(".");
    let current: unknown = obj;
    for (const part of parts) {
        if (!current || typeof current !== "object" || !(part in current)) {
            return undefined;
        }
        current = (current as Record<string, unknown>)[part];
    }
    return current;
}

async function handleStatus(wrapper: ConfigWrapper): Promise<void> {
    const vine = await readEffectiveVine(wrapper);
    ui.scaffold({
        header: (s) => s.header("Vine Configuration"),
        content: (s) => {
            s.row("mode", vine.mode.toUpperCase());
            s.row("thresholds.externalSignalsToEscalate", String(vine.thresholds.externalSignalsToEscalate));
            s.row("thresholds.forcedGuardTurns", String(vine.thresholds.forcedGuardTurns));
            s.row("retention.maxEntries", String(vine.retention.maxEntries));
            s.row("retention.ttlSeconds", String(vine.retention.ttlSeconds));
            s.row("toolAllowlist.count", String(vine.toolAllowlist.length));
            s.row("confirmation.strategy", vine.confirmation.strategy);
            s.row("confirmation.codeTtlSeconds", String(vine.confirmation.codeTtlSeconds));
            s.row("confirmation.maxAttempts", String(vine.confirmation.maxAttempts));
            s.row("confirmation.windowSeconds", String(vine.confirmation.windowSeconds));
            s.row("confirmation.maxActionsPerWindow", String(vine.confirmation.maxActionsPerWindow));
        },
    });
}

async function handleGet(path: string | undefined, wrapper: ConfigWrapper): Promise<void> {
    if (path && !isVinePath(path)) {
        printUsageError(`Invalid path. Allowed: ${VALID_VINE_PATHS.join(", ")}`);
    }
    const vine = await readEffectiveVine(wrapper);
    const value = getPathValue(vine, path);
    ui.scaffold({
        header: (s) => s.header("Vine Configuration"),
        content: (s) => {
            if (path) {
                s.row(path, JSON.stringify(value));
                return;
            }
            s.row("mode", vine.mode);
            s.row("thresholds.externalSignalsToEscalate", String(vine.thresholds.externalSignalsToEscalate));
            s.row("thresholds.forcedGuardTurns", String(vine.thresholds.forcedGuardTurns));
            s.row("retention.maxEntries", String(vine.retention.maxEntries));
            s.row("retention.ttlSeconds", String(vine.retention.ttlSeconds));
            s.row("toolAllowlist", JSON.stringify(vine.toolAllowlist));
            s.row("confirmation.strategy", vine.confirmation.strategy);
            s.row("confirmation.codeTtlSeconds", String(vine.confirmation.codeTtlSeconds));
            s.row("confirmation.maxAttempts", String(vine.confirmation.maxAttempts));
            s.row("confirmation.windowSeconds", String(vine.confirmation.windowSeconds));
            s.row("confirmation.maxActionsPerWindow", String(vine.confirmation.maxActionsPerWindow));
        },
    });
}

async function handleSet(path: string | undefined, value: string | undefined, wrapper: ConfigWrapper): Promise<void> {
    if (!isVinePath(path) || typeof value !== "string") {
        printUsageError(`Usage: openclaw bshield vine set <path> <value>. Paths: ${VALID_VINE_PATHS.join(", ")}`);
    }
    const parsed = parsePathValue(path, value);
    if (!parsed.ok) {
        printUsageError(parsed.error);
    }
    await wrapper.set(`${CONFIG_PATHS.PLUGIN_CONFIG}.vine.${path}`, parsed.value);
    ui.scaffold({
        header: (s) => s.header("Vine Configuration"),
        content: (s) => s.successMsg(`Updated ${path} = ${String(parsed.value)}`),
    });
}

async function handleAllow(toolName: string | undefined, wrapper: ConfigWrapper): Promise<void> {
    if (!toolName || toolName.trim().length === 0) {
        printUsageError("Usage: openclaw bshield vine allow <toolName>");
    }
    const vine = await readEffectiveVine(wrapper);
    const normalized = toolName.trim().toLowerCase();
    const current = new Set(vine.toolAllowlist.map((value) => value.toLowerCase()));
    if (current.has(normalized)) {
        ui.scaffold({
            header: (s) => s.header("No Changes Applied"),
            content: (s) => s.warningMsg(`Tool '${toolName}' is already allowlisted.`),
        });
        return;
    }

    const next = [...vine.toolAllowlist, toolName.trim()];
    await wrapper.set(`${CONFIG_PATHS.PLUGIN_CONFIG}.vine.toolAllowlist`, next);
    ui.scaffold({
        header: (s) => s.header("Vine Allowlist"),
        content: (s) => {
            s.successMsg("Tool allowlisted.");
            s.row("Tool", toolName.trim());
        },
    });
}

async function handleDeny(toolName: string | undefined, wrapper: ConfigWrapper): Promise<void> {
    if (!toolName || toolName.trim().length === 0) {
        printUsageError("Usage: openclaw bshield vine deny <toolName>");
    }
    const normalized = toolName.trim().toLowerCase();
    const vine = await readEffectiveVine(wrapper);
    const next = vine.toolAllowlist.filter((value) => value.toLowerCase() !== normalized);
    if (next.length === vine.toolAllowlist.length) {
        ui.scaffold({
            header: (s) => s.header("No Changes Applied"),
            content: (s) => s.warningMsg(`Tool '${toolName}' is not allowlisted.`),
        });
        return;
    }

    await wrapper.set(`${CONFIG_PATHS.PLUGIN_CONFIG}.vine.toolAllowlist`, next);
    ui.scaffold({
        header: (s) => s.header("Vine Allowlist"),
        content: (s) => {
            s.successMsg("Tool removed from allowlist.");
            s.row("Tool", toolName.trim());
        },
    });
}

async function handleConfirmation(wrapper: ConfigWrapper): Promise<void> {
    if (!isatty(0) || !isatty(1)) {
        printUsageError(
            `Interactive confirmation selector requires a TTY. Use: openclaw bshield vine set confirmation.strategy <${VINE_CONFIRMATION_STRATEGY.ONE_TO_ONE}|${VINE_CONFIRMATION_STRATEGY.ONE_TO_MANY}>`
        );
    }

    const selected = await select({
        message: "Confirmation Strategy",
        options: [
            {
                value: VINE_CONFIRMATION_STRATEGY.ONE_TO_ONE,
                label: "1:1 - One code per sensitive action",
                hint: "Highest security, more prompts.",
            },
            {
                value: VINE_CONFIRMATION_STRATEGY.ONE_TO_MANY,
                label: "1:N - One code for multiple sensitive actions (time-limited)",
                hint: "Better UX, limited by time and action cap.",
            },
            {
                value: "cancel",
                label: "Cancel",
                hint: "Exit without changes",
            },
        ],
    });

    if (isCancel(selected) || selected === "cancel") {
        cancel("Operation cancelled.");
        return;
    }
    if (selected !== VINE_CONFIRMATION_STRATEGY.ONE_TO_ONE && selected !== VINE_CONFIRMATION_STRATEGY.ONE_TO_MANY) {
        printUsageError("Invalid selection for confirmation strategy.");
    }

    await wrapper.set(`${CONFIG_PATHS.PLUGIN_CONFIG}.vine.confirmation.strategy`, selected);
    ui.scaffold({
        header: (s) => s.header("Vine Confirmation"),
        content: (s) => {
            s.successMsg("Confirmation strategy updated.");
            s.row("confirmation.strategy", selected);
        },
    });
}

export async function vineCommand(
    action: string | undefined,
    pathOrTool: string | undefined,
    value: string | undefined,
    context: OpenClawPluginCliContext,
    wrapper: ConfigWrapper
): Promise<void> {
    const selectedAction = action ?? "status";
    if (!isVineAction(selectedAction)) {
        printUsageError(`Invalid action. Use: ${VALID_ACTIONS.join(", ")}`);
    }

    try {
        if (selectedAction === "status") {
            await handleStatus(wrapper);
            return;
        }
        if (selectedAction === "get") {
            await handleGet(pathOrTool, wrapper);
            return;
        }
        if (selectedAction === "set") {
            await handleSet(pathOrTool, value, wrapper);
            return;
        }
        if (selectedAction === "allow") {
            await handleAllow(pathOrTool, wrapper);
            return;
        }
        if (selectedAction === "confirmation") {
            await handleConfirmation(wrapper);
            return;
        }
        await handleDeny(pathOrTool, wrapper);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        context.logger.error?.(`[berry-shield] CLI error: Failed to update vine config: ${message}`);
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg(`Failed to update vine config: ${message}`),
        });
        process.exit(1);
    }
}
