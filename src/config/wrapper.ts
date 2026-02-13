import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ENV_VARS, DEFAULTS } from "../constants.js";
import type { OpenClawConfig } from "openclaw/plugin-sdk";

const execFileAsync = promisify(execFile);

/**
 * Safe navigation helper to get nested values by dot-notation path.
 * Avoids 'as any' and handles 'unknown' types securely.
 */
function getValueByPath(obj: unknown, path: string): unknown {
    if (!obj || typeof obj !== "object") return undefined;
    const parts = path.split(".");
    let current: any = obj;

    for (const part of parts) {
        if (current && typeof current === "object" && part in current) {
            current = current[part];
        } else {
            return undefined;
        }
    }
    return current;
}

export interface ConfigWrapperOptions {
    /** In-memory OpenClaw configuration object from SDK */
    config?: OpenClawConfig;
    /** Custom OpenClaw binary path override */
    binaryPath?: string;
}

/**
 * Performance-optimized wrapper around OpenClaw configuration.
 * 
 * Supports two modes:
 * 1. Memory Mode (Fast): Reads directly from the SDK's injected config object.
 * 2. CLI Mode (Safe/Fallback): Spawns the OpenClaw binary for reading/writing.
 */
export class ConfigWrapper {
    private inMemoryConfig?: OpenClawConfig;
    private binaryPathBase: string;

    constructor(options: ConfigWrapperOptions = {}) {
        this.inMemoryConfig = options.config;
        this.binaryPathBase = options.binaryPath || DEFAULTS.BINARY_NAME;
    }

    /**
     * Resolves the correct executable command based on environment and platform.
     * Priorities: 
     * 1. OPENCLAW_EXECUTABLE (internal hit)
     * 2. OPENCLAW_BIN (user override)
     * 3. OS Detection (.cmd on Windows)
     */
    private getCommand(): string {
        const envExec = process.env[ENV_VARS.OPENCLAW_EXECUTABLE] || process.env[ENV_VARS.OPENCLAW_BIN];
        if (envExec) return envExec;

        if (process.platform === "win32" && this.binaryPathBase === DEFAULTS.BINARY_NAME) {
            return `${DEFAULTS.BINARY_NAME}${DEFAULTS.WIN_BINARY_EXT}`;
        }
        return this.binaryPathBase;
    }

    /**
     * Gets a configuration value by path.
     * Tries memory first (O(1)), falls back to CLI (Slow).
     */
    async get<T>(path: string): Promise<T | undefined> {
        // FAST PATH: Memory Read
        if (this.inMemoryConfig) {
            return getValueByPath(this.inMemoryConfig, path) as T | undefined;
        }

        // SLOW PATH: CLI Fallback
        try {
            const { stdout } = await execFileAsync(this.getCommand(), ["config", "get", path, "--json"]);
            const trimmed = stdout.trim();
            if (!trimmed) return undefined;
            return JSON.parse(trimmed) as T;
        } catch (error: unknown) {
            if (error instanceof Error && "stderr" in error && (error as any).stderr?.includes("Config path not found")) {
                return undefined;
            }
            throw new Error(`Failed to get config '${path}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Sets a configuration value. 
     * Always uses the CLI (writes to disk/global config).
     */
    async set(path: string, value: unknown): Promise<void> {
        const valueStr = JSON.stringify(value);
        try {
            await execFileAsync(this.getCommand(), ["config", "set", path, valueStr, "--json"]);
        } catch (error: unknown) {
            throw new Error(`Failed to set config '${path}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Clears a configuration value.
     */
    async unset(path: string): Promise<void> {
        try {
            await execFileAsync(this.getCommand(), ["config", "unset", path]);
        } catch (error: unknown) {
            throw new Error(`Failed to unset config '${path}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

/** Global instance for backwards compatibility (no memory mode defaults) */
export const configWrapper = new ConfigWrapper();
