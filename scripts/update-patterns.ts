
import * as fs from 'node:fs';
import * as https from 'node:https';
import * as path from 'node:path';
// @ts-ignore
import toml from '@iarna/toml';

const GITLEAKS_URL = 'https://raw.githubusercontent.com/gitleaks/gitleaks/master/config/gitleaks.toml';
const TARGET_FILE = path.resolve(process.cwd(), 'src/patterns/generated.ts');

interface GitleaksRule {
    description: string;
    id: string;
    regex?: string;
    secretGroup?: number;
    entropy?: number;
    tags?: string[];
}

interface GitleaksConfig {
    title: string;
    rules: GitleaksRule[];
}

function fetchGitleaksConfig(): Promise<string> {
    return new Promise((resolve, reject) => {
        https.get(GITLEAKS_URL, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function main() {
    console.log('🔒 Fetching Gitleaks rules...');
    const tomlContent = await fetchGitleaksConfig();

    console.log('📦 Parsing TOML...');
    const config = toml.parse(tomlContent) as unknown as GitleaksConfig;

    console.log(`🔍 Found ${config.rules.length} rules. Validating regex compatibility...`);

    const validRules: any[] = [];
    const skippedRules: string[] = [];

    for (const rule of config.rules) {
        if (!rule.regex) continue;

        try {
            // Test if the regex is valid in Node.js
            // Gitleaks uses Go regex, which is mostly compatible but has some differences
            // We strip (?i) because we can use the 'i' flag, BUT for simplicity we keep it 
            // if Node supports it (Node 20+ supports inline flags). 
            // If it fails, we try to strip it.

            let pattern = rule.regex;
            // Basic conversion for common Go regex features if needed
            // For now, let's try direct compilation
            new RegExp(pattern);

            validRules.push({
                id: rule.id,
                description: rule.description,
                pattern: pattern,
                tags: rule.tags || []
            });
        } catch {
            skippedRules.push(`${rule.id} (Regex: ${rule.regex})`);
        }
    }

    console.log(`✅ Validated ${validRules.length} rules.`);
    console.log(`⚠️ Skipped ${skippedRules.length} rules due to incompatibility.`);

    const fileContent = `
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

    fs.writeFileSync(TARGET_FILE, fileContent.trim());
    console.log(`💾 Saved to ${TARGET_FILE}`);
}

main().catch(console.error);
