import { BRAND_SYMBOL, VINE_APPROVAL_INJECT } from "../../constants.js";
import type { ApprovalCardMessage, ApprovalFailureContext } from "./types.js";

export type ApprovalFailureKind =
    | "usage_error"
    | "invalid_code"
    | "expired_or_missing"
    | "max_attempts_exceeded"
    | "ambiguous"
    | "resume_failed";

function formatUseCodeAction(actualCode?: string): string {
    const code = actualCode ?? "<4-digit-code>";
    return `${VINE_APPROVAL_INJECT.ACTION_USE_CODE_PREFIX}${code}.`;
}

export function formatApprovalCardMessage(message: ApprovalCardMessage): string {
    const lines = [
        `${BRAND_SYMBOL} ${VINE_APPROVAL_INJECT.TITLE}`,
        `${VINE_APPROVAL_INJECT.FIELD_STATUS}: ${message.status}`,
        `${VINE_APPROVAL_INJECT.FIELD_DETAIL}: ${message.detail}`,
    ];
    if (message.action) {
        lines.push(`${VINE_APPROVAL_INJECT.FIELD_ACTION}: ${message.action}`);
    }
    return lines.join("\n");
}

export function buildApprovedApprovalCardMessage(): string {
    return formatApprovalCardMessage({
        status: VINE_APPROVAL_INJECT.STATUS_SUCCESS,
        detail: VINE_APPROVAL_INJECT.DETAIL_SUCCESS,
    });
}
export function buildApprovedApprovalCardWithCodeMessage(code: string): string {
    const card = buildApprovedApprovalCardMessage();
    return `${card}\n\n${VINE_APPROVAL_INJECT.ACTION_USE_CODE_PREFIX}${code}.`;
}

export function buildFailureApprovalContextFromKind(
    kind: ApprovalFailureKind,
    options?: { actualCode?: string }
): ApprovalFailureContext {
    switch (kind) {
        case "usage_error":
            return {
                detail: VINE_APPROVAL_INJECT.DETAIL_USAGE_ERROR,
                action: formatUseCodeAction(options?.actualCode),
                reason: VINE_APPROVAL_INJECT.REASON_USAGE_ERROR,
            };
        case "invalid_code":
            return {
                detail: VINE_APPROVAL_INJECT.DETAIL_INVALID_CODE,
                action: formatUseCodeAction(options?.actualCode),
                reason: VINE_APPROVAL_INJECT.REASON_INVALID_CODE,
            };
        case "max_attempts_exceeded":
            return {
                detail: VINE_APPROVAL_INJECT.DETAIL_MAX_ATTEMPTS_EXCEEDED,
                action: VINE_APPROVAL_INJECT.ACTION_NEW_CODE,
                reason: VINE_APPROVAL_INJECT.REASON_MAX_ATTEMPTS_EXCEEDED,
            };
        case "ambiguous":
            return {
                detail: VINE_APPROVAL_INJECT.DETAIL_AMBIGUOUS,
                action: VINE_APPROVAL_INJECT.ACTION_RETRY_ORIGINAL_PROMPT,
                reason: VINE_APPROVAL_INJECT.REASON_AMBIGUOUS,
            };
        case "resume_failed":
            return {
                detail: VINE_APPROVAL_INJECT.DETAIL_RESUME_FAILED,
                action: options?.actualCode
                    ? `${VINE_APPROVAL_INJECT.ACTION_USE_CODE_PREFIX}${options.actualCode}.`
                    : VINE_APPROVAL_INJECT.ACTION_RETRY_CURRENT_CODE,
                reason: VINE_APPROVAL_INJECT.REASON_RESUME_FAILED,
            };
        case "expired_or_missing":
        default:
            return {
                detail: VINE_APPROVAL_INJECT.DETAIL_EXPIRED_OR_MISSING,
                action: VINE_APPROVAL_INJECT.ACTION_NEW_CODE,
                reason: VINE_APPROVAL_INJECT.REASON_EXPIRED_OR_MISSING,
            };
    }
}

export function buildFailureApprovalCardMessage(
    kind: ApprovalFailureKind,
    options?: { actualCode?: string }
): string {
    const context = buildFailureApprovalContextFromKind(kind, options);
    return formatApprovalCardMessage({
        status: VINE_APPROVAL_INJECT.STATUS_FAILURE,
        detail: context.detail,
        action: context.action,
    });
}
