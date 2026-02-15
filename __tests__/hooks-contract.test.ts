import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const layerFiles = [
    "src/layers/root.ts",
    "src/layers/pulp.ts",
    "src/layers/thorn.ts",
    "src/layers/leaf.ts",
];

function readFile(relPath: string): string {
    const fullPath = path.join(process.cwd(), relPath);
    expect(fs.existsSync(fullPath)).toBe(true);
    return fs.readFileSync(fullPath, "utf-8");
}

describe("Hooks Contract", () => {
    it("does not use hook literals in api.on(...) calls", () => {
        const literalHookCallPattern = /api\.on\(\s*"(.*?)"/g;

        for (const file of layerFiles) {
            const content = readFile(file);
            const matches = [...content.matchAll(literalHookCallPattern)];
            expect(matches.length).toBe(0);
        }
    });

    it("uses centralized HOOKS constants in core layers", () => {
        const root = readFile("src/layers/root.ts");
        const pulp = readFile("src/layers/pulp.ts");
        const thorn = readFile("src/layers/thorn.ts");
        const leaf = readFile("src/layers/leaf.ts");

        expect(root).toContain("HOOKS.BEFORE_AGENT_START");
        expect(pulp).toContain("HOOKS.TOOL_RESULT_PERSIST");
        expect(pulp).toContain("HOOKS.MESSAGE_SENDING");
        expect(thorn).toContain("HOOKS.BEFORE_TOOL_CALL");
        expect(leaf).toContain("HOOKS.MESSAGE_RECEIVED");
    });
});

