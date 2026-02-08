/**
 * Berry.Stem - Security Gate Layer
 *
 * Provides a tool (`berry_check`) that the agent MUST call before
 * executing commands or reading files. This is the MAIN INNOVATION
 * of Berry Shield.
 *
 * Why Berry.Stem is important:
 * - Works in ALL OpenClaw versions (uses tool API, not hooks)
 * - Harder for LLM to ignore a tool result than an instruction
 * - Covers the gap when `before_tool_call` hook is not wired
 *
 * The agent is instructed by Berry.Root to always call this tool
 * before exec/read operations.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { PluginConfig } from "../types/config";
import {
    DESTRUCTIVE_COMMAND_PATTERNS,
    SENSITIVE_FILE_PATTERNS,
} from "../patterns";

/**
 * Operation types for berry_check.
 */
type OperationType = "exec" | "read" | "write";

/**
 * Parameters for berry_check tool.
 */
interface BerryCheckParams {
    /** Type of operation to check */
    operation: OperationType;
    /** File path or command to check */
    target: string;
}

/**
 * Tool result content item.
 */
interface ToolResultContent {
    type: "text";
    text: string;
}

/**
 * Tool result structure.
 */
interface ToolResult {
    content: ToolResultContent[];
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
 * Formats an ALLOWED response.
 *
 * @param operation - The operation type
 * @param target - The target path/command
 * @returns Formatted response string
 */
function formatAllowed(operation: OperationType, target: string): string {
    return `🍓 Berry Shield

STATUS: ALLOWED
OPERATION: ${operation}
TARGET: ${target}

You may proceed with this operation.`;
}

/**
 * Formats a DENIED response for sensitive files.
 *
 * @param filePath - The sensitive file path
 * @returns Formatted response string
 */
function formatDeniedSensitiveFile(filePath: string): string {
    return `🍓 Berry Shield

STATUS: DENIED
REASON: Sensitive file detected
FILE: ${filePath}

This file may contain secrets or credentials.
ACTION: Do NOT read this file. Inform the user it is blocked by security policy.`;
}

/**
 * Formats a DENIED response for destructive commands.
 *
 * @param command - The destructive command
 * @returns Formatted response string
 */
function formatDeniedDestructiveCommand(command: string): string {
    // Truncate long commands for display
    const displayCommand =
        command.length > 50 ? `${command.substring(0, 50)}...` : command;

    return `🍓 Berry Shield

STATUS: DENIED
REASON: Destructive command detected
COMMAND: ${displayCommand}

This command could cause irreversible damage.
ACTION: Do NOT execute this command. Suggest a safer alternative to the user.`;
}

/**
 * Registers the Berry.Stem layer (Security Gate).
 *
 * @param api - OpenClaw plugin API
 * @param config - Plugin configuration
 */
export function registerBerryStem(
    api: OpenClawPluginApi,
    config: PluginConfig
): void {
    // Skip if layer is disabled
    if (!config.layers.stem) {
        api.logger.debug("[berry-shield] Berry.Stem layer disabled");
        return;
    }

    api.registerTool({
        name: "berry_check",
        description:
            "Security gate - call BEFORE exec or file read to verify permission",
        parameters: {
            type: "object",
            properties: {
                operation: {
                    type: "string",
                    enum: ["exec", "read", "write"],
                    description: "Type of operation to check",
                },
                target: {
                    type: "string",
                    description: "File path or command to check",
                },
            },
            required: ["operation", "target"],
        },

        async execute(
            _id: string,
            params: BerryCheckParams
        ): Promise<ToolResult> {
            const { operation, target } = params;

            // Check for destructive commands on exec operations
            if (operation === "exec") {
                if (isDestructiveCommand(target, config.destructiveCommands)) {
                    api.logger.warn(
                        `[berry-shield] Berry.Stem: DENIED exec - destructive command: ${target.substring(0, 50)}`
                    );

                    // In audit mode, still return DENIED but log differently
                    if (config.mode === "audit") {
                        api.logger.info(
                            "[berry-shield] Berry.Stem: AUDIT mode - would block destructive command"
                        );
                    }

                    return {
                        content: [
                            { type: "text", text: formatDeniedDestructiveCommand(target) },
                        ],
                    };
                }
            }

            // Check for sensitive files on read/write operations
            if (operation === "read" || operation === "write") {
                if (isSensitiveFile(target, config.sensitiveFilePaths)) {
                    api.logger.warn(
                        `[berry-shield] Berry.Stem: DENIED ${operation} - sensitive file: ${target}`
                    );

                    // In audit mode, still return DENIED but log differently
                    if (config.mode === "audit") {
                        api.logger.info(
                            "[berry-shield] Berry.Stem: AUDIT mode - would block sensitive file access"
                        );
                    }

                    return {
                        content: [
                            { type: "text", text: formatDeniedSensitiveFile(target) },
                        ],
                    };
                }
            }

            // Operation is allowed
            api.logger.debug(
                `[berry-shield] Berry.Stem: ALLOWED ${operation} on ${target}`
            );

            return {
                content: [{ type: "text", text: formatAllowed(operation, target) }],
            };
        },
    });

    api.logger.debug("[berry-shield] Berry.Stem layer registered");
}
