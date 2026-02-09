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
import { getAllDestructiveCommandPatterns, getAllSensitiveFilePatterns, } from "../patterns";
/**
 * Checks if a command is destructive.
 *
 * @param command - The command string to check
 * @param customPatterns - Additional user-defined patterns
 * @returns True if destructive
 */
function isDestructiveCommand(command, customPatterns) {
    // Check built-in + custom patterns from dynamic loader
    for (const pattern of getAllDestructiveCommandPatterns()) {
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
        }
        catch {
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
function isSensitiveFile(filePath, customPatterns) {
    // Normalize path separators
    const normalizedPath = filePath.replace(/\\/g, "/");
    // Check built-in + custom patterns from dynamic loader
    for (const pattern of getAllSensitiveFilePatterns()) {
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
        }
        catch {
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
function extractCommand(toolName, params) {
    // Common parameter names for commands
    const commandKeys = ["command", "cmd", "script", "bash", "shell", "exec"];
    // Check if this is an execution-type tool
    const execTools = ["exec", "bash", "shell", "run_command", "execute"];
    if (!execTools.some((t) => toolName.toLowerCase().includes(t))) {
        // Also check params for command-like content
        for (const key of commandKeys) {
            if (typeof params[key] === "string") {
                return params[key];
            }
        }
        return undefined;
    }
    // Extract command from params
    for (const key of commandKeys) {
        if (typeof params[key] === "string") {
            return params[key];
        }
    }
    // Check CommandLine for run_command style tools
    if (typeof params["CommandLine"] === "string") {
        return params["CommandLine"];
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
function extractFilePath(toolName, params) {
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
            return params[key];
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
export function registerBerryThorn(api, config) {
    // Skip if layer is disabled
    if (!config.layers.thorn) {
        api.logger.debug("[berry-shield] Berry.Thorn layer disabled");
        return;
    }
    api.on("before_tool_call", (event) => {
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
        // Check if exec command references a sensitive file (e.g., cat .env)
        if (command && isSensitiveFile(command, config.sensitiveFilePaths)) {
            const reason = `Command references sensitive file: ${command.substring(0, 50)}${command.length > 50 ? "..." : ""}`;
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
    }, { priority: 200 } // High priority - security runs first
    );
    api.logger.debug("[berry-shield] Berry.Thorn layer registered");
}
