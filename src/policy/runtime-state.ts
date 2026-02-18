import type { BerryShieldPolicyRetentionConfig } from "../types/config.js";
import { PolicyStateManager } from "../utils/policy-state.js";

let sharedPolicyStateManager: PolicyStateManager | null = null;
let sharedRetentionSignature = "";

export function getSharedPolicyStateManager(
    retention: BerryShieldPolicyRetentionConfig
): PolicyStateManager {
    const signature = `${retention.maxEntries}:${retention.ttlSeconds}`;
    if (!sharedPolicyStateManager || sharedRetentionSignature !== signature) {
        sharedPolicyStateManager = new PolicyStateManager(retention);
        sharedRetentionSignature = signature;
    }
    return sharedPolicyStateManager;
}

export function notifyPolicyDenied(
    sessionKey: string | undefined,
    escalationTurns: number,
    allowGlobalEscalation = false
): void {
    if (!sharedPolicyStateManager) return;
    sharedPolicyStateManager.markDenied(sessionKey, escalationTurns, allowGlobalEscalation);
}

export function resetSharedPolicyStateManagerForTests(): void {
    sharedPolicyStateManager = null;
    sharedRetentionSignature = "";
}
