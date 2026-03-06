/**
 * Structured audit event types for Berry Shield.
 *
 * Used by all layers to produce consistent, machine-parseable
 * log entries in both audit (Shadow Mode) and enforce modes.
 */

import { AUDIT_DECISIONS, SECURITY_LAYERS } from "../constants.js";

/**
 * Base fields shared by all audit events.
 */
interface AuditEventBase {
    /** Current operating mode */
    mode: "audit" | "enforce";
    /** Security layer that produced the event */
    layer: typeof SECURITY_LAYERS[keyof typeof SECURITY_LAYERS];
    /** ISO 8601 timestamp */
    ts: string;
}

/**
 * Event emitted when an action would be (or was) blocked.
 */
export interface AuditBlockEvent extends AuditEventBase {
    decision:
        | typeof AUDIT_DECISIONS.WOULD_BLOCK
        | typeof AUDIT_DECISIONS.BLOCKED
        | typeof AUDIT_DECISIONS.CONFIRM_REQUIRED
        | typeof AUDIT_DECISIONS.WOULD_CONFIRM_REQUIRED
        | typeof AUDIT_DECISIONS.ALLOWED_BY_CONFIRM;
    /** Why the action was flagged */
    reason: string;
    /** The target of the action (command, file path, etc.) */
    target: string;
}

/**
 * Event emitted when output would be (or was) redacted.
 */
export interface AuditRedactEvent extends AuditEventBase {
    decision: typeof AUDIT_DECISIONS.WOULD_REDACT | typeof AUDIT_DECISIONS.REDACTED;
    /** Hook that triggered the redaction */
    hook: string;
    /** Tool or source name */
    toolName: string;
    /** Number of redactions */
    count: number;
    /** Types of sensitive data detected */
    types: string[];
}

/** Union of all audit event types */
export type AuditEvent = AuditBlockEvent | AuditRedactEvent;

/**
 * Serializes an audit event to a JSON string for structured logging.
 */
export function formatAuditEvent(event: AuditEvent): string {
    return JSON.stringify(event);
}
