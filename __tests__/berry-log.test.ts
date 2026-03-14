import { describe, expect, it, vi } from "vitest";
import {
    BERRY_LOG_CATEGORY,
    BERRY_LOG_LEVEL,
    berryLog,
    formatBerryLogMessage,
    getBerryLogSuffix,
} from "../src/log/berry-log.js";

function createLogger() {
    return {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };
}

const EXPECTED_BERRY_LOG_CATEGORY = {
    LAYER_TRACE: "layer_trace",
    POLICY_TRACE: "policy_trace",
    SECURITY_EVENT: "security_event",
    RUNTIME_EVENT: "runtime_event",
    COMPAT_EVENT: "compat_event",
} as const;

const EXPECTED_BERRY_LOG_LEVEL = {
    DEBUG: "debug",
    INFO: "info",
    WARN: "warn",
    ERROR: "error",
} as const;

describe("Berry Log Contract", () => {
    it("keeps stable public log categories", () => {
        expect(BERRY_LOG_CATEGORY).toEqual(EXPECTED_BERRY_LOG_CATEGORY);
        expect(
            Object.keys(BERRY_LOG_CATEGORY).sort(),
            "New log category added but berry-log.test.ts was not updated."
        ).toEqual(Object.keys(EXPECTED_BERRY_LOG_CATEGORY).sort());
    });

    it("keeps stable public log levels", () => {
        expect(BERRY_LOG_LEVEL).toEqual(EXPECTED_BERRY_LOG_LEVEL);
        expect(
            Object.keys(BERRY_LOG_LEVEL).sort(),
            "New log level added but berry-log.test.ts was not updated."
        ).toEqual(Object.keys(EXPECTED_BERRY_LOG_LEVEL).sort());
    });

    it("keeps stable suffixes for every log category", () => {
        expect(getBerryLogSuffix(BERRY_LOG_CATEGORY.LAYER_TRACE)).toBe("[layer-trace]");
        expect(getBerryLogSuffix(BERRY_LOG_CATEGORY.POLICY_TRACE)).toBe("[policy-trace]");
        expect(getBerryLogSuffix(BERRY_LOG_CATEGORY.SECURITY_EVENT)).toBe("[security]");
        expect(getBerryLogSuffix(BERRY_LOG_CATEGORY.RUNTIME_EVENT)).toBe("[runtime]");
        expect(getBerryLogSuffix(BERRY_LOG_CATEGORY.COMPAT_EVENT)).toBe("[compat]");
    });

    it("formats the shared berry-shield prefix with category suffix", () => {
        expect(formatBerryLogMessage(BERRY_LOG_CATEGORY.LAYER_TRACE, "hello world"))
            .toBe("[berry-shield][layer-trace] hello world");
    });

    it("routes debug level to logger.debug", () => {
        const logger = createLogger();

        berryLog(logger as any, BERRY_LOG_CATEGORY.LAYER_TRACE, "debug message", BERRY_LOG_LEVEL.DEBUG);

        expect(logger.debug).toHaveBeenCalledWith("[berry-shield][layer-trace] debug message");
        expect(logger.info).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
    });

    it("routes info level to logger.info", () => {
        const logger = createLogger();

        berryLog(logger as any, BERRY_LOG_CATEGORY.RUNTIME_EVENT, "info message", BERRY_LOG_LEVEL.INFO);

        expect(logger.info).toHaveBeenCalledWith("[berry-shield][runtime] info message");
        expect(logger.debug).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
    });

    it("routes warn level to logger.warn", () => {
        const logger = createLogger();

        berryLog(logger as any, BERRY_LOG_CATEGORY.SECURITY_EVENT, "warn message", BERRY_LOG_LEVEL.WARN);

        expect(logger.warn).toHaveBeenCalledWith("[berry-shield][security] warn message");
        expect(logger.debug).not.toHaveBeenCalled();
        expect(logger.info).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
    });

    it("routes error level to logger.error", () => {
        const logger = createLogger();

        berryLog(logger as any, BERRY_LOG_CATEGORY.COMPAT_EVENT, "error message", BERRY_LOG_LEVEL.ERROR);

        expect(logger.error).toHaveBeenCalledWith("[berry-shield][compat] error message");
        expect(logger.debug).not.toHaveBeenCalled();
        expect(logger.info).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it("uses the category default level when no explicit level is provided", () => {
        const logger = createLogger();

        berryLog(logger as any, BERRY_LOG_CATEGORY.RUNTIME_EVENT, "runtime message");

        expect(logger.info).toHaveBeenCalledWith("[berry-shield][runtime] runtime message");
        expect(logger.debug).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
    });

    it("falls back to debug when an unexpected level reaches the dispatcher", () => {
        const logger = createLogger();

        berryLog(logger as any, BERRY_LOG_CATEGORY.LAYER_TRACE, "fallback message", "unexpected" as any);

        expect(logger.debug).toHaveBeenCalledWith("[berry-shield][layer-trace] fallback message");
        expect(logger.info).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
    });
});
