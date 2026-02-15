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
import { matchAgainstPattern } from "../utils/match.js";

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
    const custom = await loadCustomRules();
    logger.debug?.(`[berry-shield] CLI: Testing input: ${input.substring(0, 20)}...`);
    const matches: MatchResult[] = [];

    // Test against built-in patterns and custom rules
    const builtIn = [...SECRET_PATTERNS, ...PII_PATTERNS];

    for (const pattern of builtIn) {
        if (matchAgainstPattern(input, pattern.pattern.source)) {
            matches.push({
                name: pattern.name,
                source: "built-in",
                placeholder: pattern.placeholder,
            });
        }
    }

    for (const rule of custom.secrets) {
        if (matchAgainstPattern(input, rule.pattern)) {
            matches.push({
                name: rule.name,
                source: "custom",
                placeholder: rule.placeholder,
            });
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
