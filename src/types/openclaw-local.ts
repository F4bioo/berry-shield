import { OpenClawPluginApi } from "openclaw/plugin-sdk";

/**
 * Minimal Command interface matching what we use, to avoid version conflicts with SDK.
 */
interface SafeCommand {
    command(name: string): this;
    description(str: string): this;
    option(flags: string, description?: string): this;
    requiredOption(flags: string, description?: string): this;
    action(fn: (...args: any[]) => void | Promise<void>): this;
    addHelpText(position: string, text: string): this;
}

/**
 * Local definition of OpenClawPluginCliContext since it's not exported by the SDK.
 */
export type OpenClawPluginCliContext = {
    program: SafeCommand;
    config: OpenClawPluginApi["config"];
    workspaceDir?: string;
    logger: OpenClawPluginApi["logger"];
};
