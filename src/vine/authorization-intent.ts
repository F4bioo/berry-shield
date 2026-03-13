import {
    createIntentKind,
    type VineIntent,
    type VineIntentCapability,
    type VineIntentExternalSource,
    type VineIntentTargetSensitivity,
} from "./vine-intent.js";
import { findMatches } from "../utils/redaction.js";
import {
    getAllDestructiveCommandPatterns,
    getAllSensitiveFilePatterns,
} from "../patterns/index.js";

export type VineAuthorizationOperation = "exec" | "read" | "write";

const SENSITIVE_ACTION_TOOL_HINTS = [
    "exec",
    "bash",
    "shell",
    "run_command",
    "execute",
    "read",
    "write",
    "file",
    "edit",
];

function normalizeName(value: string): string {
    return value.trim().toLowerCase();
}

function normalizeTarget(target: string): string {
    return target.trim().replace(/\s+/g, " ");
}

function stripWrappingQuotes(value: string): string {
    let trimmed = value.trim();
    if (
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
        || (trimmed.startsWith("\"") && trimmed.endsWith("\""))
    ) {
        trimmed = trimmed.slice(1, -1);
    }

    trimmed = trimmed
        .replace(/^\\?['"]+/, "")
        .replace(/\\?['"]+$/, "");

    return trimmed;
}

function extractWriteLikeTarget(command: string): string | undefined {
    const redirectMatch = command.match(/\s+>>?\s*([^\s|;&]+)/);
    if (redirectMatch?.[1]) {
        return stripWrappingQuotes(redirectMatch[1]);
    }

    const teeMatch = command.match(/\btee\b(?:\s+-a)?\s+([^\s|;&]+)/);
    if (teeMatch?.[1]) {
        return stripWrappingQuotes(teeMatch[1]);
    }

    const catRedirectMatch = command.match(/\bcat\b[\s\S]*?>>?\s*([^\s|;&]+)/);
    if (catRedirectMatch?.[1]) {
        return stripWrappingQuotes(catRedirectMatch[1]);
    }

    return undefined;
}

function extractUrls(command: string): string[] {
    return command.match(/https?:\/\/[^\s'"`|)]+/gi) ?? [];
}

function tryParseExternalSource(urlValue: string | undefined): VineIntentExternalSource | undefined {
    if (!urlValue) {
        return undefined;
    }

    try {
        const parsed = new URL(urlValue);
        return {
            scheme: parsed.protocol.replace(/:$/, ""),
            host: parsed.hostname,
            port: parsed.port || undefined,
            normalizedUrl: parsed.toString(),
            parserConfidence: "high",
        };
    } catch {
        return {
            normalizedUrl: urlValue,
            parserConfidence: "unknown",
        };
    }
}

function isDestructiveCommand(command: string): boolean {
    return findMatches(command, getAllDestructiveCommandPatterns()).length > 0;
}

// Detect common interpreter-execution patterns in shell commands so Vine can treat script sinks as high-risk exec intents.
function looksLikeInterpreterSink(command: string): boolean {
    return /\|\s*(?:sh|bash|zsh|pwsh|powershell|python|python3|node|perl|ruby)\b/i.test(command)
        || /(?:^|\s)(?:python|python3|node|perl|ruby|pwsh|powershell)\b[\s\S]*<<\s*['"]?[A-Za-z_][A-Za-z0-9_]*['"]?/i.test(command)
        || /(?:^|\s)(?:python|python3|node|perl|ruby|pwsh|powershell)\b[\s\S]*\s(?:-c|-e|-Command)\b/i.test(command);
}

function getTargetSensitivity(value: string | undefined): VineIntentTargetSensitivity {
    if (!value) {
        return "none";
    }
    const normalizedPath = value.replace(/\\/g, "/");
    return findMatches(normalizedPath, getAllSensitiveFilePatterns()).length > 0
        ? "sensitive"
        : "none";
}

function collectExecCapabilities(command: string, writeLikeTarget: string | undefined): VineIntentCapability[] {
    const capabilities: VineIntentCapability[] = [];
    if (extractUrls(command).length > 0) {
        capabilities.push("external_read");
    }
    if (/[|;&]|\$\(|`/.test(command)) {
        capabilities.push("local_transform");
    }
    if (writeLikeTarget) {
        capabilities.push("local_write");
        if (getTargetSensitivity(writeLikeTarget) === "sensitive") {
            capabilities.push("sensitive_write");
        }
    }
    if (isDestructiveCommand(command)) {
        capabilities.push("destructive_exec");
    }
    if (looksLikeInterpreterSink(command)) {
        capabilities.push("destructive_exec");
    }
    return capabilities;
}

export function hasIntrinsicExternalHostActionRisk(intent: VineIntent): boolean {
    if (!intent.capabilities.includes("external_read")) {
        return false;
    }

    return (
        intent.capabilities.includes("local_write")
        || intent.capabilities.includes("sensitive_write")
        || intent.capabilities.includes("external_send")
        || intent.capabilities.includes("destructive_exec")
    );
}

function buildIntentFromExecCommand(command: string): VineIntent {
    const urls = extractUrls(command);
    const writeLikeTarget = extractWriteLikeTarget(command);
    const capabilities = collectExecCapabilities(command, writeLikeTarget);
    return {
        kind: createIntentKind(capabilities),
        externalSource: tryParseExternalSource(urls[0]),
        capabilities,
        localEffect: {
            writesLocal: Boolean(writeLikeTarget),
            targetPath: writeLikeTarget,
            targetSensitivity: getTargetSensitivity(writeLikeTarget),
        },
        rawTarget: normalizeTarget(command),
    };
}

function buildIntentFromPathTarget(operation: VineAuthorizationOperation, target: string): VineIntent {
    const targetSensitivity = getTargetSensitivity(target);
    const capabilities: VineIntentCapability[] = operation === "write"
        ? ["local_write"]
        : [];
    if (operation === "write" && targetSensitivity === "sensitive") {
        capabilities.push("sensitive_write");
    }

    return {
        kind: createIntentKind(capabilities),
        capabilities,
        localEffect: {
            writesLocal: operation === "write",
            targetPath: target,
            targetSensitivity,
        },
        rawTarget: normalizeTarget(target),
    };
}

function extractCommand(toolName: string, params: Record<string, unknown>): string | undefined {
    const commandKeys = ["command", "cmd", "script", "bash", "shell", "exec", "CommandLine"];
    const normalizedTool = normalizeName(toolName);

    if (SENSITIVE_ACTION_TOOL_HINTS.some((hint) => normalizedTool.includes(hint))) {
        for (const key of commandKeys) {
            if (typeof params[key] === "string") {
                return params[key] as string;
            }
        }
    }

    for (const key of commandKeys) {
        if (typeof params[key] === "string") {
            return params[key] as string;
        }
    }
    return undefined;
}

function extractFilePath(toolName: string, params: Record<string, unknown>): string | undefined {
    const pathKeys = [
        "path",
        "file",
        "filePath",
        "file_path",
        "target",
        "AbsolutePath",
        "TargetFile",
    ];
    const normalized = normalizeName(toolName);

    if (!SENSITIVE_ACTION_TOOL_HINTS.some((hint) => normalized.includes(hint))) {
        return undefined;
    }

    for (const key of pathKeys) {
        if (typeof params[key] === "string") {
            return params[key] as string;
        }
    }
    return undefined;
}

export function inferVineOperationFromToolName(toolName: string): VineAuthorizationOperation {
    const normalized = normalizeName(toolName);
    if (normalized.includes("write") || normalized.includes("edit")) {
        return "write";
    }
    if (normalized.includes("read") || normalized.includes("view")) {
        return "read";
    }
    return "exec";
}

export function resolveAuthorizationTargetFromToolCall(
    toolName: string,
    params: Record<string, unknown>,
    operation = inferVineOperationFromToolName(toolName)
): string {
    if (operation === "exec") {
        return extractCommand(toolName, params) ?? toolName;
    }

    return extractFilePath(toolName, params) ?? toolName;
}

export function createVineIntentFromOperationTarget(
    operation: VineAuthorizationOperation,
    target: string
): VineIntent {
    if (operation === "exec") {
        return buildIntentFromExecCommand(target);
    }
    return buildIntentFromPathTarget(operation, target);
}

export function extractVineIntent(
    toolName: string,
    params: Record<string, unknown>,
    operation = inferVineOperationFromToolName(toolName)
): VineIntent {
    const target = resolveAuthorizationTargetFromToolCall(toolName, params, operation);
    return createVineIntentFromOperationTarget(operation, target);
}

export function resolveDisplayTargetFromToolCall(
    toolName: string,
    params: Record<string, unknown>
): string {
    const command = extractCommand(toolName, params);
    if (command) {
        const writeLikeTarget = extractWriteLikeTarget(command);
        if (writeLikeTarget) {
            return writeLikeTarget.slice(0, 120);
        }

        return command.slice(0, 120);
    }

    const filePath = extractFilePath(toolName, params);
    if (filePath) {
        return filePath.slice(0, 120);
    }

    return toolName;
}

export function resolveWriteLikeTargetFromToolCall(
    toolName: string,
    params: Record<string, unknown>
): string | undefined {
    const command = extractCommand(toolName, params);
    if (!command) {
        return undefined;
    }
    return extractWriteLikeTarget(command);
}
