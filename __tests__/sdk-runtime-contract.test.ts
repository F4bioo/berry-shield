import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

describe("OpenClaw SDK Runtime Contract", () => {
    it("tracks runtime registration behavior sentinel (async register handling)", () => {
        const distPath = path.join(process.cwd(), "node_modules", "openclaw", "dist");
        expect(fs.existsSync(distPath)).toBe(true);

        const candidateFiles = fs.readdirSync(distPath)
            .filter((name) => name.endsWith(".js"))
            .map((name) => path.join(distPath, name));

        const sentinel = "plugin register returned a promise; async registration is ignored";
        const found = candidateFiles.some((filePath) => {
            const content = fs.readFileSync(filePath, "utf-8");
            return content.includes(sentinel);
        });

        // If this flips, we need manual review of register lifecycle strategy.
        expect(found).toBe(true);
    });
});

