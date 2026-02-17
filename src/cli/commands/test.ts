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
import { ui } from "../ui/tui.js";
import { theme } from "../ui/theme.js";

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
        ui.scaffold({
            header: (s) => s.header("Pattern Test"),
            content: (s) => {
                s.failureMsg("No matches found");
                s.row("Input", theme.dim(input.length > 64 ? input.slice(0, 61) + "..." : input));
            },
        });
        return;
    }

    ui.scaffold({
        header: (s) => s.header("Pattern Test"),
        content: (s) => {
            s.successMsg(`${matches.length} match(es) found`);
            s.row("Input", theme.dim(input.length > 64 ? input.slice(0, 61) + "..." : input));
            s.divider(24);
            for (const match of matches) {
                s.row(match.source.toUpperCase(), match.name);
                s.row("Redaction", match.placeholder);
                s.divider(24);
            }
        },
    });
}
