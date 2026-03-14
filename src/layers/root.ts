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
import { BERRY_LOG_CATEGORY, berryLog } from "../log/berry-log.js";
import { formatPolicyCard, POLICY_CARD_KIND } from "../ui/policy-card/index.js";

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
        berryLog(api.logger, BERRY_LOG_CATEGORY.RUNTIME_EVENT, "Berry.Root layer disabled");
        return;
    }

    const policyState = getSharedPolicyStateManager(config.policy.retention);

    api.on(
        HOOKS.BEFORE_AGENT_START,
        (_event, ctx) => {
            const sessionKey = ctx.sessionId ?? ctx.sessionKey ?? "global_session";
            const hasSessionIdentity = sessionKey !== "global_session";

            if (!hasSessionIdentity) {
                berryLog(api.logger, BERRY_LOG_CATEGORY.COMPAT_EVENT, "Berry.Root session id missing, forcing full policy for safety");
            }

            const decision = policyState.consumeTurnDecision({
                sessionKey,
                hasSessionIdentity,
                provider: ctx.messageProvider,
                policy: config.policy,
            });

            if (decision === "full") {
                policyState.markInjected(sessionKey);
                berryLog(api.logger, BERRY_LOG_CATEGORY.POLICY_TRACE, "Berry.Root injecting full security policy");
                return { prependContext: formatPolicyCard(POLICY_CARD_KIND.SESSION_START) };
            }

            if (decision === "short") {
                policyState.markInjected(sessionKey);
                berryLog(api.logger, BERRY_LOG_CATEGORY.POLICY_TRACE, "Berry.Root session active, injecting short reminder");
                return { prependContext: formatPolicyCard(POLICY_CARD_KIND.SESSION_REMINDER) };
            }

            berryLog(api.logger, BERRY_LOG_CATEGORY.POLICY_TRACE, "Berry.Root session active, skipping policy injection");
            return;
        },
        { priority: 200 } // High priority - security runs first
    );

    api.on(
        HOOKS.SESSION_END,
        (event) => {
            policyState.delete(event.sessionId);
            berryLog(api.logger, BERRY_LOG_CATEGORY.RUNTIME_EVENT, `Berry.Root cleared policy state for session ${event.sessionId}`);
        },
        { priority: 200 }
    );

    berryLog(api.logger, BERRY_LOG_CATEGORY.RUNTIME_EVENT, "Berry.Root layer registered (Prompt Guard)");
}
