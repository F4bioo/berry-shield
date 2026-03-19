import { describe, expect, it } from "vitest";
import { walkAndRedact } from "../src/utils/redaction";
import { getAllRedactionPatterns } from "../src/patterns";

describe("Pattern Expansion (Gitleaks Rules)", () => {
    const patterns = getAllRedactionPatterns();

    it("should detect and redact secrets defined in Gitleaks rules but not in core patterns", () => {
        // Gitleaks Rule: sentry-user-token
        // Pattern: \b(sntryu_[a-f0-9]{64})(?:[\x60'"\s;]|\\[nr]|$)
        const mockSentryToken = "sntryu_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

        const input = {
            message: `User token is ${mockSentryToken}`,
            config: {
                sentry: mockSentryToken
            }
        };

        const result = walkAndRedact(input, patterns);

        // Expect redaction
        expect(result.content.message).toContain("[SENTRY_USER_TOKEN_REDACTED]");
        expect(result.content.config.sentry).toBe("[SENTRY_USER_TOKEN_REDACTED]");
        expect(result.redactedTypes).toContain("gitleaks:secret:sentry-user-token");
    });

    it("should detect multiple Gitleaks rule types", () => {
        // Gitleaks: slack-legacy-token
        // Pattern: xox[os]-\d+-\d+-\d+-[a-fA-F\d]+
        const mockSlackLegacy = "xoxs-1234567890-1234567890-1234567890-abcdef1234";

        const input = {
            slack: mockSlackLegacy
        };

        const result = walkAndRedact(input, patterns);

        // Check if redacted type matches either custom slack rule or gitleaks rule
        const isRedacted = result.content.slack.includes("SLACK_TOKEN_REDACTED") ||
            result.content.slack.includes("SLACK_LEGACY_TOKEN_REDACTED") ||
            result.content.slack.includes("BERRY:SECRET_SLACK_TOKEN");

        expect(isRedacted).toBe(true);
    });
});
