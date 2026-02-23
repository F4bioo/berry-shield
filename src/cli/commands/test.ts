/**
 * CLI command: test
 * 
 * Tests if an input string matches any Berry Shield pattern.
 * Usage: openclaw bshield test <input>
 */

import type { OpenClawPluginApi, OpenClawConfig } from "openclaw/plugin-sdk";
type PluginLogger = OpenClawPluginApi["logger"];

import { loadCustomRulesFromConfig } from "../custom-rules-config.js";
import { SECRET_PATTERNS, PII_PATTERNS } from "../../patterns/index.js";
import { matchAgainstPattern } from "../utils/match.js";
import { ui } from "../ui/tui.js";
import { theme } from "../ui/theme.js";
import { type ConfigWrapper } from "../../config/wrapper.js";

interface MatchResult {
    name: string;
    source: "built-in" | "custom";
    placeholder: string;
}

function looksLikeCustomRuleId(value: string): boolean {
    return /^(command|file):.+/i.test(value.trim());
}

/**
 * Handler for the test command
 */
export async function testCommand(
    input: string,
    _config: OpenClawConfig,
    logger: PluginLogger,
    wrapper: ConfigWrapper
): Promise<void> {
    const custom = await loadCustomRulesFromConfig(wrapper);
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
                s.warningMsg("Scope: baseline secret/pii + custom secret (enabled rules only).");
                if (looksLikeCustomRuleId(input)) {
                    s.warningMsg("Input looks like a custom rule ID, not a payload value.");
                }
                s.row(
                    "Inspect",
                    theme.dim("openclaw bshield rules list --detailed (verify exists, ENABLED, active pattern)"),
                );
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
