import { text, select, confirm, isCancel, cancel } from '@clack/prompts';
import { theme, symbols } from "./theme.js";
import { ui } from "./tui.js";
import {
    validateRegex
} from "../storage.js";

/**
 * Result of a wizard execution.
 */
interface WizardResult {
    type: string;
    options: {
        name?: string;
        pattern: string;
        placeholder?: string;
    };
}

/**
 * Manages an interactive session for rule creation.
 */
export class RuleWizardSession {
    /**
     * Executes the interactive wizard flow.
     */
    async execute(): Promise<WizardResult | null> {
        ui.header("Berry Shield Rule Wizard");

        const selectedType = await this.askType();
        if (!selectedType) return null;

        const type = selectedType;
        let name: string | undefined;

        if (type === 'secret') {
            const nameInput = await this.askName();
            if (nameInput === null) return null;
            name = nameInput;
        }

        const pattern = await this.askPattern(type);
        if (pattern === null) return null;

        if (this.isBroadPattern(pattern)) {
            const confirmed = await this.confirmBroad();
            if (!confirmed) return null;
        }

        let placeholder: string | undefined;
        if (type === 'secret') {
            const placeholderInput = await this.askPlaceholder();
            if (placeholderInput === null) return null;
            placeholder = placeholderInput || undefined;
        }

        return { type, options: { name, pattern, placeholder } };
    }

    private async askType(): Promise<string | null> {
        const result = await select({
            message: theme.accent('What type of rule') + ' do you want to add?',
            options: [
                { value: 'secret', label: 'Secret (API keys, tokens)', hint: theme.dim('Redacts patterns from output') },
                { value: 'file', label: 'Sensitive File', hint: theme.dim('Prevents reading specific files') },
                { value: 'command', label: 'Destructive Command', hint: theme.dim('Blocks dangerous commands') },
                { value: 'cancel', label: theme.dim('Cancel'), hint: theme.dim('Exit the wizard') },
            ],
        });

        if (typeof result !== 'string') return null;

        return result;
    }

    private async askName(): Promise<string | null> {
        const result = await text({
            message: theme.accent('Rule Name') + ' (e.g. "openai-key")',
            placeholder: 'my-secret-key',
            validate(value) {
                if (!value || value.length === 0) return 'Name is required for secrets';
            },
        });

        if (isCancel(result)) {
            cancel('Operation cancelled.');
            return null;
        }

        return result;
    }

    private async askPattern(type: string): Promise<string | null> {
        const result = await text({
            message: theme.accent('Regex Pattern'),
            placeholder: type === 'secret' ? 'sk-[a-zA-Z0-9]{48}' : 'config/secrets.json',
            validate(value) {
                if (!value || value.length === 0) return 'Pattern is required';
                const validation = validateRegex(value);
                if (!validation.valid) return `Invalid regex: ${validation.error}`;
            },
        });

        if (isCancel(result)) {
            cancel('Operation cancelled.');
            return null;
        }

        return result;
    }

    private async askPlaceholder(): Promise<string | null> {
        const result = await text({
            message: theme.accent('Custom Placeholder') + theme.dim(' (optional)'),
            placeholder: '[REDACTED_SECRET]',
            initialValue: '',
        });

        if (isCancel(result)) {
            cancel('Operation cancelled.');
            return null;
        }

        return result;
    }

    private async confirmBroad(): Promise<boolean> {
        const result = await confirm({
            message: `${symbols.warning} ${theme.warning('Warning:')} This pattern seems very broad. Continue?`,
            initialValue: false,
        });

        if (isCancel(result) || !result) {
            cancel('Operation cancelled.');
            return false;
        }

        return true;
    }

    private isBroadPattern(pattern: string): boolean {
        if (pattern === ".*" || pattern === ".+") return true;
        if (pattern.length < 3) return true;
        if (pattern.includes(".*") && pattern.length < 8) return true;
        return false;
    }
}
