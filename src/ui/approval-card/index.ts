// Preserved for future UI reuse; the current native Vine approval flow does not import this formatter path.
export type {
    ApprovalCardStatus,
    ApprovalCardMessage,
    ApprovalFailureContext,
} from "./types.js";

export {
    formatApprovalCardMessage,
    buildApprovedApprovalCardMessage,
    buildApprovedApprovalCardWithCodeMessage,
    buildFailureApprovalContextFromKind,
    buildFailureApprovalCardMessage,
} from "./format-text.js";
