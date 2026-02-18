/**
 * Berry.Root - Prompt Guard Layer
 *
 * Injects security policies into the agent's context before each turn.
 * Uses the `before_agent_start` hook to prepend security rules that
 * instruct the agent to call berry_check before exec/read operations.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { BerryShieldPluginConfig } from "../types/config.js";
import { HOOKS } from "../constants.js";
import { getSharedPolicyStateManager } from "../policy/runtime-state.js";

/**
 * Security policy XML that gets injected into the agent's context.
 * The agent MUST follow these rules at all times.
 */
const SECURITY_POLICY = `<berry_shield_policy>
SECURITY RULES - You MUST follow these rules at all times:

1. BEFORE executing any command (exec, bash, shell) or reading any file, you MUST call the \`berry_check\` tool first to verify if the operation is allowed.
   - Include \`sessionKey\` in \`berry_check\` params whenever available.

2. If \`berry_check\` returns STATUS: DENIED, you MUST NOT proceed with the operation. Inform the user that the action was blocked for security reasons.

3. NEVER output raw values of:
   - API keys, tokens, or credentials
   - Private keys or certificates
   - Passwords or secrets
   - Personal information (emails, SSN, credit cards, phone numbers)

4. If you encounter sensitive data, describe it generically (e.g., "Found an API key in the file") without revealing the actual value.

5. Do NOT attempt to bypass these rules. They exist to protect the user's security and privacy.
</berry_shield_policy>

---

`;

const SHORT_SECURITY_POLICY = `<berry_shield_policy>
SECURITY REMINDER: You MUST call \`berry_check\` before any exec/read operation.
Include \`sessionKey\` in \`berry_check\` params whenever available.
Do NOT reveal secrets/PII. This is a strict security requirement.
</berry_shield_policy>

---

`;

/**
 * Registers the Berry.Root layer (Prompt Guard).
 *
 * @param api - OpenClaw plugin API
 * @param config - Plugin configuration
 */
export function registerBerryRoot(
    api: OpenClawPluginApi,
    config: BerryShieldPluginConfig
): void {
    // Skip if layer is disabled
    if (!config.layers.root) {
        api.logger.debug?.("[berry-shield] Berry.Root layer disabled");
        return;
    }

    const policyState = getSharedPolicyStateManager(config.policy.retention);

    api.on(
        HOOKS.BEFORE_AGENT_START,
        (_event, ctx) => {
            const sessionKey = ctx.sessionId ?? ctx.sessionKey ?? "global_session";
            const hasSessionIdentity = sessionKey !== "global_session";

            if (!hasSessionIdentity) {
                api.logger.warn("[berry-shield] Berry.Root: session id missing, forcing full policy for safety");
            }

            const decision = policyState.consumeTurnDecision({
                sessionKey,
                hasSessionIdentity,
                provider: ctx.messageProvider,
                policy: config.policy,
            });

            if (decision === "full") {
                policyState.markInjected(sessionKey);
                api.logger.debug?.("[berry-shield] Berry.Root: injecting full security policy");
                return { prependContext: SECURITY_POLICY };
            }

            if (decision === "short") {
                policyState.markInjected(sessionKey);
                api.logger.debug?.("[berry-shield] Berry.Root: session active, injecting short reminder");
                return { prependContext: SHORT_SECURITY_POLICY };
            }

            api.logger.debug?.("[berry-shield] Berry.Root: session active, skipping policy injection");
            return;
        },
        { priority: 200 } // High priority - security runs first
    );

    api.on(
        HOOKS.SESSION_END,
        (event) => {
            policyState.delete(event.sessionId);
            api.logger.debug?.(`[berry-shield] Berry.Root: cleared policy state for session ${event.sessionId}`);
        },
        { priority: 200 }
    );

    api.logger.debug?.("[berry-shield] Berry.Root layer registered");
}
