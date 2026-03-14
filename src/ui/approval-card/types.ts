/** Approval card status contract for user-visible inject messages. */
export type ApprovalCardStatus = "SUCCESS" | "FAILURE";

/** User-visible approval card payload. */
export interface ApprovalCardMessage {
    status: ApprovalCardStatus;
    detail: string;
    action?: string;
}

/** Internal failure context used by warning payload builders. */
export interface ApprovalFailureContext {
    detail: string;
    action?: string;
    reason: string;
}
