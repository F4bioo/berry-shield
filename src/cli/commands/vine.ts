import type { OpenClawPluginCliContext } from "../../types/openclaw-local.js";
import type { ConfigWrapper } from "../../config/wrapper.js";
import { CONFIG_PATHS } from "../../constants.js";
import { mergeConfig } from "../../config/utils.js";
import { ui } from "../ui/tui.js";

type VineAction = "status" | "get" | "set" | "allow" | "deny";
type VinePath =
    | "mode"
    | "thresholds.externalSignalsToEscalate"
    | "thresholds.forcedGuardTurns"
    | "retention.maxEntries"
    | "retention.ttlSeconds";

const VALID_ACTIONS: readonly VineAction[] = ["status", "get", "set", "allow", "deny"];
const VALID_VINE_PATHS: readonly VinePath[] = [
    "mode",
    "thresholds.externalSignalsToEscalate",
    "thresholds.forcedGuardTurns",
    "retention.maxEntries",
    "retention.ttlSeconds",
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
