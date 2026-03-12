import { describe, expect, it } from "vitest";
import { BRAND_SYMBOL, VINE_APPROVAL_INJECT } from "../src/constants.js";
import {
    buildApprovedApprovalCardMessage,
    buildApprovedApprovalCardWithCodeMessage,
    buildFailureApprovalCardMessage,
    buildFailureApprovalContextFromKind,
} from "../src/ui/approval-card/index.js";

describe("approval card contract", () => {
    it("formats approved message using shared brand symbol", () => {
        const message = buildApprovedApprovalCardMessage();

        expect(message).toContain(`${BRAND_SYMBOL} ${VINE_APPROVAL_INJECT.TITLE}`);
        expect(message).toContain(`${VINE_APPROVAL_INJECT.FIELD_STATUS}: ${VINE_APPROVAL_INJECT.STATUS_SUCCESS}`);
        expect(message).toContain(`${VINE_APPROVAL_INJECT.FIELD_DETAIL}: ${VINE_APPROVAL_INJECT.DETAIL_SUCCESS}`);
    });

    it("formats usage-error failure with actionable code hint", () => {
        const message = buildFailureApprovalCardMessage("usage_error", { actualCode: "1234" });

        expect(message).toContain(`${VINE_APPROVAL_INJECT.FIELD_STATUS}: ${VINE_APPROVAL_INJECT.STATUS_FAILURE}`);
        expect(message).toContain(`${VINE_APPROVAL_INJECT.FIELD_DETAIL}: ${VINE_APPROVAL_INJECT.DETAIL_USAGE_ERROR}`);
        expect(message).toContain(`${VINE_APPROVAL_INJECT.FIELD_ACTION}: Send a message containing this 4-digit code: 1234.`);
    });

    it("formats approved message with numeric code line", () => {
        const message = buildApprovedApprovalCardWithCodeMessage("2596");
        expect(message).toContain(`${VINE_APPROVAL_INJECT.FIELD_STATUS}: ${VINE_APPROVAL_INJECT.STATUS_SUCCESS}`);
        expect(message).toContain("Send a message containing this 4-digit code: 2596.");
    });

    it("maps reason text for command rejection context", () => {
        const ctx = buildFailureApprovalContextFromKind("expired_or_missing");
        expect(ctx.reason).toBe(VINE_APPROVAL_INJECT.REASON_EXPIRED_OR_MISSING);
    });

    it("maps every failure kind to expected detail and reason", () => {
        const matrix = [
            {
                kind: "usage_error" as const,
                expectedDetail: VINE_APPROVAL_INJECT.DETAIL_USAGE_ERROR,
                expectedReason: VINE_APPROVAL_INJECT.REASON_USAGE_ERROR,
            },
            {
                kind: "invalid_code" as const,
                expectedDetail: VINE_APPROVAL_INJECT.DETAIL_INVALID_CODE,
                expectedReason: VINE_APPROVAL_INJECT.REASON_INVALID_CODE,
            },
            {
                kind: "expired_or_missing" as const,
                expectedDetail: VINE_APPROVAL_INJECT.DETAIL_EXPIRED_OR_MISSING,
                expectedReason: VINE_APPROVAL_INJECT.REASON_EXPIRED_OR_MISSING,
            },
            {
                kind: "max_attempts_exceeded" as const,
                expectedDetail: VINE_APPROVAL_INJECT.DETAIL_MAX_ATTEMPTS_EXCEEDED,
                expectedReason: VINE_APPROVAL_INJECT.REASON_MAX_ATTEMPTS_EXCEEDED,
            },
            {
                kind: "ambiguous" as const,
                expectedDetail: VINE_APPROVAL_INJECT.DETAIL_AMBIGUOUS,
                expectedReason: VINE_APPROVAL_INJECT.REASON_AMBIGUOUS,
            },
            {
                kind: "resume_failed" as const,
                expectedDetail: VINE_APPROVAL_INJECT.DETAIL_RESUME_FAILED,
                expectedReason: VINE_APPROVAL_INJECT.REASON_RESUME_FAILED,
            },
        ];

        for (const item of matrix) {
            const ctx = buildFailureApprovalContextFromKind(item.kind, { actualCode: "9999" });
            expect(ctx.detail).toBe(item.expectedDetail);
            expect(ctx.reason).toBe(item.expectedReason);
        }
    });

    it("uses placeholder code when actual code is unavailable", () => {
        const message = buildFailureApprovalCardMessage("usage_error");
        expect(message).toContain("ACTION: Send a message containing this 4-digit code: <4-digit-code>.");
    });

    it("uses retry-current-code fallback action for resume_failed without code", () => {
        const ctx = buildFailureApprovalContextFromKind("resume_failed");
        expect(ctx.action).toBe(VINE_APPROVAL_INJECT.ACTION_RETRY_CURRENT_CODE);
    });
});
