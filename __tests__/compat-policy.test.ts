import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { COMPAT_POLICY } from "../src/constants";

function parseOpenClawVersion(input: string): [number, number, number, number] {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-(\d+))?$/.exec(input.trim());
    if (!match) {
        throw new Error(`Invalid OpenClaw version format: ${input}`);
    }
    return [
        Number(match[1]),
        Number(match[2]),
        Number(match[3]),
        Number(match[4] ?? 0),
    ];
}

function compareVersion(a: [number, number, number, number], b: [number, number, number, number]): number {
    for (let i = 0; i < 4; i += 1) {
        if (a[i] > b[i]) return 1;
        if (a[i] < b[i]) return -1;
    }
    return 0;
}

function satisfiesCaretRange(version: string, range: string): boolean {
    if (!range.startsWith("^")) return false;
    const base = range.slice(1);
    const parsedVersion = parseOpenClawVersion(version);
    const parsedBase = parseOpenClawVersion(base);
    if (parsedVersion[0] !== parsedBase[0]) return false;
    return compareVersion(parsedVersion, parsedBase) >= 0;
}

describe("Compatibility Policy Contract", () => {
    it("keeps package peerDependencies aligned with compat policy constants", () => {
        const pkgPath = path.join(process.cwd(), "package.json");
        expect(fs.existsSync(pkgPath)).toBe(true);

        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
            peerDependencies?: Record<string, string>;
        };
        const peer = pkg.peerDependencies?.openclaw;

        expect(peer).toBe(COMPAT_POLICY.PEER_RANGE);
        expect(peer).toBe(`^${COMPAT_POLICY.MIN_OPENCLAW_VERSION}`);
    });

    it("keeps installed SDK within declared peer range policy", () => {
        const pkgPath = path.join(process.cwd(), "package.json");
        const sdkPkgPath = path.join(process.cwd(), "node_modules", "openclaw", "package.json");
        expect(fs.existsSync(pkgPath)).toBe(true);
        expect(fs.existsSync(sdkPkgPath)).toBe(true);

        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
            peerDependencies?: Record<string, string>;
        };
        const sdkPkg = JSON.parse(fs.readFileSync(sdkPkgPath, "utf-8")) as {
            version: string;
        };

        const peerRange = pkg.peerDependencies?.openclaw;
        expect(typeof peerRange).toBe("string");
        expect(satisfiesCaretRange(sdkPkg.version, peerRange as string)).toBe(true);
    });

    it("keeps floor version declared in the versioning plan", () => {
        const planPath = path.join(
            process.cwd(),
            ".backstage",
            "plans",
            "plan-versionamento-compat-openclaw-2026-02-15.md",
        );
        expect(fs.existsSync(planPath)).toBe(true);

        const planContent = fs.readFileSync(planPath, "utf-8");
        expect(planContent).toContain(COMPAT_POLICY.MIN_OPENCLAW_VERSION);
    });
});

