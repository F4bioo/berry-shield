/**
 * Berry.Root - Prompt Guard Layer
 *
 * Injects security policies into the agent's context before each turn.
 * Uses the `before_agent_start` hook to prepend security rules that
 * instruct the agent to call berry_check before exec/read operations.
 */
/**
 * Security policy XML that gets injected into the agent's context.
 * The agent MUST follow these rules at all times.
 */
const SECURITY_POLICY = `<berry_shield_policy>
SECURITY RULES - You MUST follow these rules at all times:

1. BEFORE executing any command (exec, bash, shell) or reading any file, you MUST call the \`berry_check\` tool first to verify if the operation is allowed.

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
/**
 * Registers the Berry.Root layer (Prompt Guard).
 *
 * @param api - OpenClaw plugin API
 * @param config - Plugin configuration
 */
export function registerBerryRoot(api, config) {
    // Skip if layer is disabled
    if (!config.layers.root) {
        api.logger.debug?.("[berry-shield] Berry.Root layer disabled");
        return;
    }
    api.on("before_agent_start", (_event) => {
        // Inject security policy into the agent's context
        api.logger.debug?.("[berry-shield] Berry.Root: injecting security policy");
        return {
            prependContext: SECURITY_POLICY
        };
    }, { priority: 200 } // High priority - security runs first
    );
    api.logger.debug?.("[berry-shield] Berry.Root layer registered");
}
