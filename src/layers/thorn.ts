/**
 * Berry.Thorn - Tool Blocker Layer
 *
 * Blocks dangerous tool calls before they execute.
 * Uses the `before_tool_call` hook to intercept and block:
 * - Destructive commands (rm, del, format, etc.)
 * - Access to sensitive files (.env, credentials, keys, etc.)
 *
 * NOTE: This hook may not be wired in all OpenClaw versions.
 * Berry.Stem provides a complementary fallback mechanism.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { PluginConfig } from "../types/config";
import {
    DESTRUCTIVE_COMMAND_PATTERNS,
    SENSITIVE_FILE_PATTERNS,
} from "../patterns";

/**
 * Tool call event structure.
 */
interface ToolCallEvent {
    /** Name of the tool being called */
    toolName: string;
    /** Parameters passed to the tool */
    params: Record<string, unknown>;
}

/**
 * Block result structure.
 */
interface BlockResult {
    /** Whether to block the tool call */
    block: boolean;
    /** Reason for blocking */
    blockReason?: string;
}

/**
 * Checks if a command is destructive.
 *
 * @param command - The command string to check
 * @param customPatterns - Additional user-defined patterns
 * @returns True if destructive
 */
function isDestructiveCommand(
    command: string,
    customPatterns: string[]
): boolean {
    // Check built-in patterns
    for (const pattern of DESTRUCTIVE_COMMAND_PATTERNS) {
        if (pattern.test(command)) {
            return true;
        }
    }

    // Check custom patterns
    for (const patternStr of customPatterns) {
        try {
            const pattern = new RegExp(patternStr, "i");
            if (pattern.test(command)) {
                return true;
            }
        } catch {
            // Invalid regex, skip
        }
    }

    return false;
}

/**
 * Checks if a file path is sensitive.
 *
 * @param filePath - The file path to check
 * @param customPatterns - Additional user-defined patterns
 * @returns True if sensitive
 */
function isSensitiveFile(filePath: string, customPatterns: string[]): boolean {
    // Normalize path separators
    const normalizedPath = filePath.replace(/\\/g, "/");

    // Check built-in patterns
    for (const pattern of SENSITIVE_FILE_PATTERNS) {
        if (pattern.test(normalizedPath)) {
            return true;
        }
    }

    // Check custom patterns
    for (const patternStr of customPatterns) {
        try {
            const pattern = new RegExp(patternStr, "i");
            if (pattern.test(normalizedPath)) {
                return true;
            }
        } catch {
            // Invalid regex, skip
        }
    }

    return false;
}

/**
 * Extracts command string from tool parameters.
 *
 * @param toolName - Name of the tool
 * @param params - Tool parameters
 * @returns Command string or undefined
 */
function extractCommand(
    toolName: string,
    params: Record<string, unknown>
): string | undefined {
    // Common parameter names for commands
    const commandKeys = ["command", "cmd", "script", "bash", "shell", "exec"];

    // Check if this is an execution-type tool
    const execTools = ["exec", "bash", "shell", "run_command", "execute"];
    if (!execTools.some((t) => toolName.toLowerCase().includes(t))) {
        // Also check params for command-like content
        for (const key of commandKeys) {
            if (typeof params[key] === "string") {
                return params[key] as string;
            }
        }
        return undefined;
    }

    // Extract command from params
    for (const key of commandKeys) {
        if (typeof params[key] === "string") {
            return params[key] as string;
        }
    }

    // Check CommandLine for run_command style tools
    if (typeof params["CommandLine"] === "string") {
        return params["CommandLine"] as string;
    }

    return undefined;
}

/**
 * Extracts file path from tool parameters.
 *
 * @param toolName - Name of the tool
 * @param params - Tool parameters
 * @returns File path or undefined
 */
function extractFilePath(
    toolName: string,
    params: Record<string, unknown>
): string | undefined {
    // Common parameter names for file paths
    const pathKeys = [
        "path",
        "file",
        "filePath",
        "file_path",
        "target",
        "AbsolutePath",
        "TargetFile",
    ];

    // Check if this is a file-type tool
    const fileTools = ["read", "write", "view", "edit", "file"];
    if (!fileTools.some((t) => toolName.toLowerCase().includes(t))) {
        return undefined;
    }

    // Extract path from params
    for (const key of pathKeys) {
        if (typeof params[key] === "string") {
            return params[key] as string;
        }
    }

    return undefined;
}

/**
 * Registers the Berry.Thorn layer (Tool Blocker).
 *
 * @param api - OpenClaw plugin API
 * @param config - Plugin configuration
 */
export function registerBerryThorn(
    api: OpenClawPluginApi,
    config: PluginConfig
): void {
    // Skip if layer is disabled
    if (!config.layers.thorn) {
        api.logger.debug("[berry-shield] Berry.Thorn layer disabled");
        return;
    }

    api.on(
        "before_tool_call",
        (event: ToolCallEvent): BlockResult | undefined => {
            const { toolName, params } = event;

            // Check for destructive commands
            const command = extractCommand(toolName, params);
            if (command && isDestructiveCommand(command, config.destructiveCommands)) {
                const reason = `Destructive command detected: ${command.substring(0, 50)}${command.length > 50 ? "..." : ""}`;

                if (config.mode === "audit") {
                    api.logger.warn(`[berry-shield] Berry.Thorn: AUDIT - ${reason}`);
                    return undefined; // Don't block in audit mode
                }

                api.logger.warn(`[berry-shield] Berry.Thorn: BLOCKED - ${reason}`);
                return {
                    block: true,
                    blockReason: `🍓 Berry Shield: ${reason}. This command could cause irreversible damage.`,
                };
            }

            // Check for sensitive file access
            const filePath = extractFilePath(toolName, params);
            if (filePath && isSensitiveFile(filePath, config.sensitiveFilePaths)) {
                const reason = `Sensitive file detected: ${filePath}`;

                if (config.mode === "audit") {
                    api.logger.warn(`[berry-shield] Berry.Thorn: AUDIT - ${reason}`);
                    return undefined; // Don't block in audit mode
                }

                api.logger.warn(`[berry-shield] Berry.Thorn: BLOCKED - ${reason}`);
                return {
                    block: true,
                    blockReason: `🍓 Berry Shield: ${reason}. This file may contain secrets or credentials.`,
                };
            }

            // Allow the tool call
            return undefined;
        },
        { priority: 200 } // High priority - security runs first
    );

    api.logger.debug("[berry-shield] Berry.Thorn layer registered");
}
