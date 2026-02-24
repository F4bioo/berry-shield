import * as fs from "node:fs";
import * as https from "node:https";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
// @ts-ignore
import toml from "@iarna/toml";

const GITLEAKS_URL = "https://raw.githubusercontent.com/gitleaks/gitleaks/master/config/gitleaks.toml";
const TARGET_FILE = path.resolve(process.cwd(), "src/patterns/generated.ts");

export interface GitleaksRule {
    description: string;
    id: string;
    regex?: string;
    secretGroup?: number;
    entropy?: number;
    tags?: string[];
}

export interface GitleaksConfig {
    title: string;
    rules: GitleaksRule[];
}

export interface GeneratedPattern {
    id: string;
    description: string;
    pattern: string;
    tags: string[];
}

const BASELINE_GITLEAKS_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

export function isValidGitleaksId(id: string): boolean {
    return BASELINE_GITLEAKS_ID_RE.test(id.toLowerCase());
}

export function assertGeneratedRulesContract(rules: readonly GeneratedPattern[]): void {
    const byId = new Map<string, number>();
    const byPattern = new Map<string, number>();

    for (const rule of rules) {
        const normalizedId = rule.id.toLowerCase();
        const normalizedPattern = rule.pattern;

        byId.set(normalizedId, (byId.get(normalizedId) ?? 0) + 1);
        byPattern.set(normalizedPattern, (byPattern.get(normalizedPattern) ?? 0) + 1);

        if (!isValidGitleaksId(normalizedId)) {
            throw new Error(
                `[update-patterns] Invalid gitleaks id '${rule.id}'. Expected lowercase-safe id matching ${BASELINE_GITLEAKS_ID_RE}.`
            );
        }
    }

    const duplicateIds = Array.from(byId.entries())
        .filter(([, count]) => count > 1)
        .map(([id]) => id)
        .sort((a, b) => a.localeCompare(b));

    if (duplicateIds.length > 0) {
        throw new Error(`[update-patterns] Duplicate gitleaks ids detected: ${duplicateIds.join(", ")}`);
    }

    const duplicatePatterns = Array.from(byPattern.entries())
        .filter(([, count]) => count > 1)
        .map(([pattern]) => pattern)
        .sort((a, b) => a.localeCompare(b));

    if (duplicatePatterns.length > 0) {
        throw new Error(
            `[update-patterns] Duplicate gitleaks regex patterns detected (${duplicatePatterns.length}). Resolve upstream collisions explicitly.`
        );
    }
}

export function collectGeneratedPatterns(config: GitleaksConfig): {
    validRules: GeneratedPattern[];
    skippedRules: string[];
} {
    const validRules: GeneratedPattern[] = [];
    const skippedRules: string[] = [];

    for (const rule of config.rules) {
        if (!rule.regex) {
            continue;
        }

        try {
            new RegExp(rule.regex);
            validRules.push({
                id: rule.id,
                description: rule.description,
                pattern: rule.regex,
                tags: rule.tags ?? [],
            });
        } catch {
            skippedRules.push(`${rule.id} (Regex: ${rule.regex})`);
        }
    }

    assertGeneratedRulesContract(validRules);

    return { validRules, skippedRules };
}

function fetchGitleaksConfig(): Promise<string> {
    return new Promise((resolve, reject) => {
        https.get(GITLEAKS_URL, (res) => {
            let data = "";
            res.on("data", (chunk) => {
                data += chunk;
            });
            res.on("end", () => resolve(data));
        }).on("error", reject);
    });
}

function buildGeneratedFile(validRules: readonly GeneratedPattern[]): string {
    return `
/**
 * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 *
 * Source: Gitleaks (https://github.com/gitleaks/gitleaks)
 * License: MIT (https://github.com/gitleaks/gitleaks/blob/master/LICENSE)
 * Source URL: ${GITLEAKS_URL}
 * Generated at: ${new Date().toISOString()}
 *
 * This file contains security patterns extracted from the Gitleaks project.
 * These patterns are used to detect secrets and sensitive information.
 */

export interface GeneratedPattern {
    id: string;
    description: string;
    pattern: string; // Stored as string to be re-compiled with banners
    tags: string[];
}

export const GITLEAKS_PATTERNS: GeneratedPattern[] = ${JSON.stringify(validRules, null, 4)};
`;
}

export async function main(): Promise<void> {
    console.log("[update-patterns] Fetching Gitleaks rules...");
    const tomlContent = await fetchGitleaksConfig();

    console.log("[update-patterns] Parsing TOML...");
    const config = toml.parse(tomlContent) as unknown as GitleaksConfig;

    console.log(`[update-patterns] Found ${config.rules.length} rules. Validating regex compatibility...`);

    const { validRules, skippedRules } = collectGeneratedPatterns(config);

    console.log(`[update-patterns] Validated ${validRules.length} rules.`);
    console.log(`[update-patterns] Skipped ${skippedRules.length} incompatible rules.`);

    const fileContent = buildGeneratedFile(validRules);
    fs.writeFileSync(TARGET_FILE, fileContent.trim());
    console.log(`[update-patterns] Saved to ${TARGET_FILE}`);
}

const isDirectExecution = (() => {
    const entrypoint = process.argv[1];
    if (!entrypoint) {
        return false;
    }

    const currentFile = path.resolve(fileURLToPath(import.meta.url));
    const entryFile = path.resolve(entrypoint);
    if (process.platform === "win32") {
        return currentFile.toLowerCase() === entryFile.toLowerCase();
    }

    return currentFile === entryFile;
})();

if (isDirectExecution) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
