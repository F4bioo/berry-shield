import { OpenClawPluginCliContext } from "../../types/openclaw-local.js";
import { CONFIG_PATHS } from "../../constants.js";
import { type ConfigWrapper } from "../../config/wrapper.js";
import { ui } from "../ui/tui.js";

const VALID_PROFILES = ["strict", "balanced", "minimal"] as const;
type PolicyProfile = typeof VALID_PROFILES[number];

function isValidProfile(value: string): value is PolicyProfile {
    return (VALID_PROFILES as readonly string[]).includes(value);
}

export async function profileCommand(
    profile: string,
    context: OpenClawPluginCliContext,
    wrapper: ConfigWrapper
): Promise<void> {
    const { logger } = context;

    if (!isValidProfile(profile)) {
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg(`Invalid profile. Use: ${VALID_PROFILES.join(", ")}`),
        });
        process.exit(1);
    }

    try {
        await wrapper.set(`${CONFIG_PATHS.POLICY_CONFIG}.profile`, profile);
        ui.scaffold({
            header: (s) => s.header("Security Profile"),
            content: (s) => s.successMsg(`Switched to ${profile.toUpperCase()} profile.`),
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        ui.scaffold({
            header: (s) => s.header("Operation Failed"),
            content: (s) => s.failureMsg(`Failed to set profile: ${message}`),
        });
        logger.error(`[berry-shield] CLI error: Failed to set profile: ${message}`);
        process.exit(1);
    }
}

