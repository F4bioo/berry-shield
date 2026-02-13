import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigWrapper } from "../src/config/wrapper";
import { execFile } from "node:child_process";
import { ENV_VARS, DEFAULTS, CONFIG_PATHS } from "../src/constants";

// Mock child_process.execFile
vi.mock("node:child_process", () => ({
    execFile: vi.fn(),
}));

describe("ConfigWrapper", () => {
    let wrapper: ConfigWrapper;
    const execFileMock = execFile as unknown as ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        // Clear env vars that might affect tests
        delete process.env[ENV_VARS.OPENCLAW_EXECUTABLE];
        delete process.env[ENV_VARS.OPENCLAW_BIN];
    });

    describe("Memory Mode (Fast Path)", () => {
        it("should get a config value from memory without spawning a process", async () => {
            const mockConfig = {
                plugins: {
                    entries: {
                        "berry-shield": {
                            enabled: true,
                            config: { mode: "enforce" }
                        }
                    }
                }
            };

            // Instantiate with memory config
            wrapper = new ConfigWrapper({ config: mockConfig as any });

            const result = await wrapper.get(`${CONFIG_PATHS.PLUGIN_CONFIG}.mode`);

            expect(result).toBe("enforce");
            expect(execFileMock).not.toHaveBeenCalled();
        });

        it("should return undefined for missing paths in memory", async () => {
            wrapper = new ConfigWrapper({ config: {} as any });
            const result = await wrapper.get("missing.path");
            expect(result).toBeUndefined();
            expect(execFileMock).not.toHaveBeenCalled();
        });
    });

    describe("CLI Mode (Fallback/Slow Path)", () => {
        beforeEach(() => {
            wrapper = new ConfigWrapper();
        });

        it("should fallback to CLI if no memory config is provided", async () => {
            execFileMock.mockImplementation((file, args, callback) => {
                callback(null, { stdout: '"audit"' }, { stderr: "" });
            });

            const result = await wrapper.get("some.path");
            expect(result).toBe("audit");
            expect(execFileMock).toHaveBeenCalled();
        });

        it("should use platform defaults for binary name", async () => {
            execFileMock.mockImplementation((file, args, callback) => {
                callback(null, { stdout: "null" }, { stderr: "" });
            });

            await wrapper.get("some.path");

            const expectedBin = process.platform === "win32"
                ? `${DEFAULTS.BINARY_NAME}${DEFAULTS.WIN_BINARY_EXT}`
                : DEFAULTS.BINARY_NAME;

            expect(execFileMock).toHaveBeenCalledWith(expectedBin, expect.any(Array), expect.any(Function));
        });

        it("should respect OPENCLAW_EXECUTABLE env var", async () => {
            process.env[ENV_VARS.OPENCLAW_EXECUTABLE] = "/custom/path/to/openclaw";

            execFileMock.mockImplementation((file, args, callback) => {
                callback(null, { stdout: "null" }, { stderr: "" });
            });

            await wrapper.get("some.path");
            expect(execFileMock).toHaveBeenCalledWith("/custom/path/to/openclaw", expect.any(Array), expect.any(Function));
        });

        it("should respect OPENCLAW_BIN env var if EXECUTABLE is not set", async () => {
            process.env[ENV_VARS.OPENCLAW_BIN] = "oc-alias";

            execFileMock.mockImplementation((file, args, callback) => {
                callback(null, { stdout: "null" }, { stderr: "" });
            });

            await wrapper.get("some.path");
            expect(execFileMock).toHaveBeenCalledWith("oc-alias", expect.any(Array), expect.any(Function));
        });
    });

    describe("Write Operations", () => {
        it("should always use CLI for set operations even if memory exists", async () => {
            wrapper = new ConfigWrapper({ config: {} as any });

            execFileMock.mockImplementation((file, args, callback) => {
                callback(null, { stdout: "" }, { stderr: "" });
            });

            await wrapper.set("some.path", "value");
            expect(execFileMock).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(["set"]), expect.any(Function));
        });

        it("should always use CLI for unset operations", async () => {
            wrapper = new ConfigWrapper({ config: {} as any });

            execFileMock.mockImplementation((file, args, callback) => {
                callback(null, { stdout: "" }, { stderr: "" });
            });

            await wrapper.unset("some.path");
            expect(execFileMock).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(["unset"]), expect.any(Function));
        });
    });
});
