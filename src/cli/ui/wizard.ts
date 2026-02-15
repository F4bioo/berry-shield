import { text, select, confirm, isCancel, cancel } from '@clack/prompts';
import { theme, symbols } from "./theme.js";
import { ui } from "./tui.js";
import { validateRegex, isBroadPattern } from "../storage.js";
import {
    SECRET_PRESETS,
    FILE_PRESETS,
    COMMAND_PRESETS,
    type RulePreset
} from "../presets.js";
import { matchAgainstPattern } from "../utils/match.js";

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

        // Ask for Preset or Custom
        const preset = await this.askPreset(type);

        let name: string | undefined;
        let pattern: string | undefined;
        let placeholder: string | undefined;

        if (preset) {
            // Pre-fill from preset
            name = preset.name;
            pattern = preset.pattern;
            placeholder = preset.placeholder;
        } else {
            // Fallback to manual questions
            if (type === 'secret') {
                const nameInput = await this.askName();
                if (nameInput === null) return null;
                name = nameInput;
            }

            const patternInput = await this.askPattern(type);
            if (patternInput === null) return null;
            pattern = patternInput;

            if (type === 'secret') {
                const placeholderInput = await this.askPlaceholder();
                if (placeholderInput === null) return null;
                placeholder = placeholderInput || undefined;
            }
        }

        if (!pattern) return null;

        // Interactive Validation Loop
        while (true) {
            const decision = await this.runValidationLoop(pattern);
            if (decision === 'save') break;
            if (decision === 'cancel') return null;
            if (decision === 'edit') {
                const newPattern = await this.askPattern(type);
                if (newPattern === null) return null;
                pattern = newPattern;

                if (pattern && isBroadPattern(pattern)) {
                    const confirmed = await this.confirmBroad();
                    if (!confirmed) return null;
                }
            }
            // If 'test_another', it just loops back and asks runValidationLoop again
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

    private async askPreset(type: string): Promise<RulePreset | null> {
        const presets = type === 'secret' ? SECRET_PRESETS :
            type === 'file' ? FILE_PRESETS :
                COMMAND_PRESETS;

        const options = [
            { value: 'custom', label: theme.accentBold('Custom Pattern'), hint: 'Create your own regex' },
            ...presets.map(p => ({
                value: p.name,
                label: p.name,
                hint: theme.dim(p.pattern)
            }))
        ];

        const result = await select({
            message: theme.accent('Select a preset') + ' or create custom:',
            options
        });

        if (typeof result !== 'string' || result === 'custom') return null;

        const found = presets.find(p => p.name === result);
        return found || null;
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
                if (!validation.valid) return `Invalid regex: ${validation.error} `;
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
            message: `${symbols.warning} ${theme.warning('Warning:')} This pattern seems very broad.Continue ? `,
            initialValue: false,
        });

        if (isCancel(result) || !result) {
            cancel('Operation cancelled.');
            return false;
        }

        return true;
    }


    private async runValidationLoop(pattern: string): Promise<'save' | 'edit' | 'cancel' | 'test_another'> {
        const sample = await this.askSample();
        if (sample === null) return 'cancel';

        try {
            const isMatch = matchAgainstPattern(sample, pattern);

            if (isMatch) {
                ui.successMsg(theme.success('Match Found!') + ' The pattern correctly identifies this input.');
            } else {
                ui.row(theme.error('No Match'), 'The pattern did ' + theme.bold('not') + ' trigger for this input.');
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            ui.row(theme.error('Error'), message);
        }

        const action = await select({
            message: theme.accent('What would you like to do?'),
            options: [
                { value: 'save', label: theme.success('Save Rule'), hint: 'Finalize and persist this rule' },
                { value: 'test_another', label: 'Test another sample', hint: 'Verify with different text' },
                { value: 'edit', label: theme.accent('Edit Pattern'), hint: 'Adjust the regex' },
                { value: 'cancel', label: theme.dim('Cancel'), hint: 'Exit without saving' }
            ]
        });

        if (isCancel(action) || action === 'cancel') return 'cancel';
        return action as 'save' | 'edit' | 'cancel' | 'test_another';
    }

    private async askSample(): Promise<string | null> {
        const result = await text({
            message: theme.accent('Test Preview') + ': Enter a sample text to check:',
            placeholder: 'e.g. sk-1234567890...',
            validate(value) {
                if (!value || value.length === 0) return 'Sample text is required for preview';
            }
        });

        if (isCancel(result)) return null;
        return result;
    }
}
