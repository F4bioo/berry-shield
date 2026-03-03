import { cancel, confirm, isCancel, select, text } from "@clack/prompts";
import { mergeConfig } from "../../config/utils.js";
import { type ConfigWrapper } from "../../config/wrapper.js";
import { CONFIG_PATHS } from "../../constants.js";
import { OpenClawPluginCliContext } from "../../types/openclaw-local.js";
import { ui } from "../ui/tui.js";

type PolicyAction = "set" | "get";
type PolicyPath =
    | "profile"
    | "adaptive.staleAfterMinutes"
    | "adaptive.escalationTurns"
    | "adaptive.heartbeatEveryTurns"
    | "adaptive.allowGlobalEscalation"
    | "retention.maxEntries"
    | "retention.ttlSeconds";

const VALID_POLICY_PATHS: readonly PolicyPath[] = [
    "profile",
    "adaptive.staleAfterMinutes",
    "adaptive.escalationTurns",
    "adaptive.heartbeatEveryTurns",
    "adaptive.allowGlobalEscalation",
    "retention.maxEntries",
    "retention.ttlSeconds",
];

function isPolicyAction(value: string | undefined): value is PolicyAction {
    return value === "set" || value === "get";
}

function isPolicyPath(value: string | undefined): value is PolicyPath {
    return typeof value === "string" && (VALID_POLICY_PATHS as readonly string[]).includes(value);
}

function parseInteger(value: string | undefined, fieldLabel: string, min: number): { ok: true; value: number } | { ok: false; error: string } {
    if (value === undefined) return { ok: false, error: `${fieldLabel} is required.` };
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
        return { ok: false, error: `${fieldLabel} must be an integer.` };
    }
    if (parsed < min) {
        return { ok: false, error: `${fieldLabel} must be >= ${min}.` };
    }
    return { ok: true, value: parsed };
}

function parsePolicyValue(path: PolicyPath, rawValue: string): { ok: true; value: string | number | boolean } | { ok: false; error: string } {
    if (path === "profile") {
        if (rawValue === "strict" || rawValue === "balanced" || rawValue === "minimal") {
            return { ok: true, value: rawValue };
        }
        return { ok: false, error: "profile must be one of: strict, balanced, minimal." };
    }

    if (path === "adaptive.allowGlobalEscalation") {
        const normalized = rawValue.trim().toLowerCase();
        if (normalized === "true") return { ok: true, value: true };
        if (normalized === "false") return { ok: true, value: false };
        return { ok: false, error: "allowGlobalEscalation must be true or false." };
    }

    if (path === "adaptive.staleAfterMinutes") {
        return parseInteger(rawValue, "staleAfterMinutes", 1);
    }
    if (path === "adaptive.escalationTurns") {
        return parseInteger(rawValue, "escalationTurns", 1);
    }
    if (path === "adaptive.heartbeatEveryTurns") {
        return parseInteger(rawValue, "heartbeatEveryTurns", 0);
    }
    if (path === "retention.maxEntries") {
        return parseInteger(rawValue, "maxEntries", 1);
    }
    return parseInteger(rawValue, "ttlSeconds", 1);
}

async function loadEffectivePolicy(wrapper: ConfigWrapper) {
    const rawPluginConfig = await wrapper.get<unknown>(CONFIG_PATHS.PLUGIN_CONFIG) || {};
    const shieldConfig = mergeConfig(rawPluginConfig);
    return shieldConfig.policy;
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

async function runPolicyWizard(
    context: OpenClawPluginCliContext,
    wrapper: ConfigWrapper
): Promise<void> {
    const { logger } = context;
    const policy = await loadEffectivePolicy(wrapper);

    const selectedProfileResult: unknown = await select({
        message: "Policy profile",
        options: [
            { value: "strict", label: "strict", hint: "Inject full policy every turn" },
            { value: "balanced", label: "balanced", hint: "Full once, then adaptive reminders" },
            { value: "minimal", label: "minimal", hint: "Silent by default, trigger-driven" },
            { value: "cancel", label: "Cancel", hint: "Exit without saving" },
        ],
    });
    if (isCancel(selectedProfileResult) || selectedProfileResult === "cancel") {
        cancel("Operation cancelled.");
        return;
    }
    if (selectedProfileResult !== "strict" && selectedProfileResult !== "balanced" && selectedProfileResult !== "minimal") {
        cancel("Operation cancelled.");
        return;
    }
    const selectedProfile = selectedProfileResult;

    const staleAfterMinutes = await text({
        message: "adaptive.staleAfterMinutes",
        initialValue: String(policy.adaptive.staleAfterMinutes),
        validate: (value) => parseInteger(value, "staleAfterMinutes", 1).ok ? undefined : "Must be integer >= 1",
    });
    if (isCancel(staleAfterMinutes)) {
        cancel("Operation cancelled.");
        return;
    }

    const escalationTurns = await text({
        message: "adaptive.escalationTurns",
        initialValue: String(policy.adaptive.escalationTurns),
        validate: (value) => parseInteger(value, "escalationTurns", 1).ok ? undefined : "Must be integer >= 1",
    });
    if (isCancel(escalationTurns)) {
        cancel("Operation cancelled.");
        return;
    }

    const heartbeatEveryTurns = await text({
        message: "adaptive.heartbeatEveryTurns",
        initialValue: String(policy.adaptive.heartbeatEveryTurns),
        validate: (value) => parseInteger(value, "heartbeatEveryTurns", 0).ok ? undefined : "Must be integer >= 0",
    });
    if (isCancel(heartbeatEveryTurns)) {
        cancel("Operation cancelled.");
        return;
    }

    const allowGlobalEscalation = await confirm({
        message: "adaptive.allowGlobalEscalation",
        initialValue: policy.adaptive.allowGlobalEscalation,
    });
    if (isCancel(allowGlobalEscalation)) {
        cancel("Operation cancelled.");
        return;
    }

    const maxEntries = await text({
        message: "retention.maxEntries",
        initialValue: String(policy.retention.maxEntries),
        validate: (value) => parseInteger(value, "maxEntries", 1).ok ? undefined : "Must be integer >= 1",
    });
    if (isCancel(maxEntries)) {
        cancel("Operation cancelled.");
        return;
    }

    const ttlSeconds = await text({
        message: "retention.ttlSeconds",
        initialValue: String(policy.retention.ttlSeconds),
        validate: (value) => parseInteger(value, "ttlSeconds", 1).ok ? undefined : "Must be integer >= 1",
    });
    if (isCancel(ttlSeconds)) {
        cancel("Operation cancelled.");
        return;
    }

    const parsedStale = parseInteger(staleAfterMinutes, "staleAfterMinutes", 1);
    const parsedEscalation = parseInteger(escalationTurns, "escalationTurns", 1);
    const parsedHeartbeat = parseInteger(heartbeatEveryTurns, "heartbeatEveryTurns", 0);
    const parsedMaxEntries = parseInteger(maxEntries, "maxEntries", 1);
    const parsedTtl = parseInteger(ttlSeconds, "ttlSeconds", 1);

    if (!parsedStale.ok || !parsedEscalation.ok || !parsedHeartbeat.ok || !parsedMaxEntries.ok || !parsedTtl.ok) {
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg("Invalid numeric input detected. Re-run the wizard."),
        });
        process.exit(1);
    }

    ui.scaffold({
        header: (s) => s.header("Policy Review"),
        content: (s) => {
            s.row("profile", selectedProfile);
            s.row("staleAfterMinutes", String(parsedStale.value));
            s.row("escalationTurns", String(parsedEscalation.value));
            s.row("heartbeatEveryTurns", String(parsedHeartbeat.value));
            s.row("allowGlobalEscalation", String(allowGlobalEscalation));
            s.row("maxEntries", String(parsedMaxEntries.value));
            s.row("ttlSeconds", String(parsedTtl.value));
        },
    });

    const shouldSave = await confirm({
        message: "Save policy changes?",
        initialValue: true,
    });
    if (isCancel(shouldSave) || !shouldSave) {
        cancel("Operation cancelled.");
        return;
    }

    try {
        await wrapper.set(`${CONFIG_PATHS.POLICY_CONFIG}.profile`, selectedProfile);
        await wrapper.set(`${CONFIG_PATHS.POLICY_CONFIG}.adaptive.staleAfterMinutes`, parsedStale.value);
        await wrapper.set(`${CONFIG_PATHS.POLICY_CONFIG}.adaptive.escalationTurns`, parsedEscalation.value);
        await wrapper.set(`${CONFIG_PATHS.POLICY_CONFIG}.adaptive.heartbeatEveryTurns`, parsedHeartbeat.value);
        await wrapper.set(`${CONFIG_PATHS.POLICY_CONFIG}.adaptive.allowGlobalEscalation`, allowGlobalEscalation);
        await wrapper.set(`${CONFIG_PATHS.POLICY_CONFIG}.retention.maxEntries`, parsedMaxEntries.value);
        await wrapper.set(`${CONFIG_PATHS.POLICY_CONFIG}.retention.ttlSeconds`, parsedTtl.value);

        ui.scaffold({
            header: (s) => s.header("Policy Configuration"),
            content: (s) => s.successMsg("Policy updated successfully."),
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg(`Failed to update policy: ${message}`),
        });
        logger.error(`[berry-shield] CLI error: Failed to update policy: ${message}`);
        process.exit(1);
    }
}

export async function policyCommand(
    action: string | undefined,
    path: string | undefined,
    value: string | undefined,
    context: OpenClawPluginCliContext,
    wrapper: ConfigWrapper
): Promise<void> {
    const { logger } = context;

    if (!action) {
        await runPolicyWizard(context, wrapper);
        return;
    }

    if (!isPolicyAction(action)) {
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg("Invalid action. Use: get, set"),
        });
        process.exit(1);
    }

    if (action === "set") {
        if (!isPolicyPath(path) || typeof value !== "string") {
            ui.scaffold({
                header: (s) => s.header("Operation Failed"),
                content: (s) => s.failureMsg(`Usage: openclaw bshield policy set <path> <value>. Paths: ${VALID_POLICY_PATHS.join(", ")}`),
            });
            process.exit(1);
        }

        const parsed = parsePolicyValue(path, value);
        if (!parsed.ok) {
            ui.scaffold({
                header: (s) => s.header("Operation Failed"),
                content: (s) => s.failureMsg(parsed.error),
            });
            process.exit(1);
        }

        try {
            await wrapper.set(`${CONFIG_PATHS.POLICY_CONFIG}.${path}`, parsed.value);
            ui.scaffold({
                header: (s) => s.header("Policy Configuration"),
                content: (s) => s.successMsg(`Updated ${path} = ${String(parsed.value)}`),
            });
            return;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            ui.scaffold({
                header: (s) => s.header("Operation Failed"),
                content: (s) => s.failureMsg(`Failed to set policy: ${message}`),
            });
            logger.error(`[berry-shield] CLI error: Failed to set policy: ${message}`);
            process.exit(1);
        }
    }

    if (path && !isPolicyPath(path)) {
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg(`Invalid path. Allowed: ${VALID_POLICY_PATHS.join(", ")}`),
        });
        process.exit(1);
    }

    try {
        const policy = await loadEffectivePolicy(wrapper);
        const selectedValue = getPathValue(policy, path);

        ui.scaffold({
            header: (s) => s.header("Policy Configuration"),
            content: (s) => {
                if (path) {
                    s.row(path, JSON.stringify(selectedValue));
                    return;
                }
                s.row("profile", policy.profile);
                s.row("adaptive.staleAfterMinutes", String(policy.adaptive.staleAfterMinutes));
                s.row("adaptive.escalationTurns", String(policy.adaptive.escalationTurns));
                s.row("adaptive.heartbeatEveryTurns", String(policy.adaptive.heartbeatEveryTurns));
                s.row("adaptive.allowGlobalEscalation", String(policy.adaptive.allowGlobalEscalation));
                s.row("retention.maxEntries", String(policy.retention.maxEntries));
                s.row("retention.ttlSeconds", String(policy.retention.ttlSeconds));
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg(`Failed to read policy: ${message}`),
        });
        logger.error(`[berry-shield] CLI error: Failed to read policy: ${message}`);
        process.exit(1);
    }
}
