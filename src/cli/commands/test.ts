/**
 * CLI command: test
 * 
 * Tests if an input string matches any Berry Shield pattern.
 * Usage: openclaw bshield test <input>
 */

import type { OpenClawPluginApi, OpenClawConfig } from "openclaw/plugin-sdk";
type PluginLogger = OpenClawPluginApi["logger"];

import { loadCustomRules } from "../storage.js";
import { SECRET_PATTERNS, PII_PATTERNS } from "../../patterns/index.js";

interface MatchResult {
    name: string;
    source: "built-in" | "custom";
    placeholder: string;
}

/**
 * Handler for the test command
 */
export async function testCommand(
    input: string,
    _config: OpenClawConfig,
    logger: PluginLogger
): Promise<void> {
    const custom = loadCustomRules();
    logger.debug?.(`[berry-shield] CLI: Testing input: ${input.substring(0, 20)}...`);
    const matches: MatchResult[] = [];

    // Test against built-in secret patterns
    for (const pattern of SECRET_PATTERNS) {
        // Create fresh regex (reset lastIndex)
        const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
        if (regex.test(input)) {
            matches.push({
                name: pattern.name,
                source: "built-in",
                placeholder: pattern.placeholder,
            });
        }
    }

    // Test against built-in PII patterns
    for (const pattern of PII_PATTERNS) {
        const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
        if (regex.test(input)) {
            matches.push({
                name: pattern.name,
                source: "built-in",
                placeholder: pattern.placeholder,
            });
        }
    }

    // Test against custom secret patterns
    for (const rule of custom.secrets) {
        try {
            const regex = new RegExp(rule.pattern, "gi");
            if (regex.test(input)) {
                matches.push({
                    name: rule.name,
                    source: "custom",
                    placeholder: rule.placeholder,
                });
            }
        } catch {
            // Invalid regex, skip
        }
    }

    // Display results
    if (matches.length === 0) {
        console.log(`\n✗ No matches found for input.\n`);
        return;
    }

    console.log(`\n✓ Found ${matches.length} match(es):\n`);
    for (const match of matches) {
        console.log(`  [${match.source}] ${match.name}`);
        console.log(`  Would be redacted → ${match.placeholder}\n`);
    }
}
