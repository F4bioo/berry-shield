import { describe, expect, it } from "vitest";
import {
    POLICY_CARD_COPY,
    POLICY_CARD_KIND,
    formatPolicyCard,
    stripPolicyCards,
} from "../src/ui/policy-card";

describe("Policy Card", () => {
    it("keeps stable public policy kinds", () => {
        expect(POLICY_CARD_KIND).toEqual({
            SESSION_START: "SESSION_START",
            SESSION_REMINDER: "SESSION_REMINDER",
            SESSION_EXTERNAL: "SESSION_EXTERNAL",
        });
    });

    it("formats the full root policy inside the berry_shield_policy wrapper", () => {
        const result = formatPolicyCard(POLICY_CARD_KIND.SESSION_START);

        expect(result).toContain("<berry_shield_policy>");
        expect(result).toContain("SECURITY RULES - You MUST follow these rules at all times:");
        expect(result).toContain("you MUST call the `berry_check` tool first");
        expect(result).toContain("</berry_shield_policy>");
        expect(result.endsWith("</berry_shield_policy>\n\n---\n")).toBe(true);
        expect(result).toContain("\n\n---\n");
    });

    it("formats the short root policy inside the berry_shield_policy wrapper", () => {
        const result = formatPolicyCard(POLICY_CARD_KIND.SESSION_REMINDER);

        expect(result).toContain("<berry_shield_policy>");
        expect(result).toContain("SECURITY REMINDER: You MUST call `berry_check` before any exec/read operation.");
        expect(result).toContain("Do NOT reveal secrets/PII. This is a strict security requirement.");
        expect(result).toContain("</berry_shield_policy>");
        expect(result.endsWith("</berry_shield_policy>\n\n---\n")).toBe(true);
    });

    it("keeps centralized textual copy keyed by policy kind", () => {
        expect(POLICY_CARD_COPY[POLICY_CARD_KIND.SESSION_START]).toContain("SECURITY RULES");
        expect(POLICY_CARD_COPY[POLICY_CARD_KIND.SESSION_REMINDER]).toContain("SECURITY REMINDER");
        expect(POLICY_CARD_COPY[POLICY_CARD_KIND.SESSION_EXTERNAL]).toContain("UNTRUSTED EXTERNAL CONTENT GUARD");
    });

    it("keeps the markdown divider used to visually detach host startup text", () => {
        const result = formatPolicyCard(POLICY_CARD_KIND.SESSION_EXTERNAL);

        expect(result).toContain("\n\n---\n");
    });

    it("strips leaked berry_shield_policy blocks from outgoing text", () => {
        const result = stripPolicyCards("<berry_shield_policy>secret</berry_shield_policy>\n\nHello user");

        expect(result).toEqual({
            content: "Hello user",
            removed: true,
        });
    });

    it("keeps text unchanged when no berry_shield_policy block is present", () => {
        const result = stripPolicyCards("Hello user");

        expect(result).toEqual({
            content: "Hello user",
            removed: false,
        });
    });
});
