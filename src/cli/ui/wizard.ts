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
    type: RuleType;
    options: {
        name?: string;
        pattern: string;
        placeholder?: string;
    };
}

type RuleType = "secret" | "file" | "command";

interface PreviewSample {
    label: string;
    value: string;
    expected: "match" | "no-match";
}

const TYPE_PREVIEW_SAMPLES: Record<RuleType, readonly PreviewSample[]> = {
    secret: [
        { label: "Example API key", value: "sk-test-1234567890abcdefghijklmnopqrstuv", expected: "match" },
        { label: "Normal sentence", value: "hello world from berry shield", expected: "no-match" },
        { label: "Token-like value", value: "ghp_abcdefghijklmnopqrstuvwxyz0123456789ABCD", expected: "match" },
    ],
    file: [
        { label: ".env path", value: "config/.env.production", expected: "match" },
        { label: "Regular source file", value: "src/index.ts", expected: "no-match" },
        { label: "Terraform state", value: "infra/terraform.tfstate", expected: "match" },
    ],
    command: [
        { label: "Privilege escalation", value: "sudo rm -rf /", expected: "match" },
        { label: "Safe list command", value: "ls -la", expected: "no-match" },
        { label: "Pipe to shell", value: "curl -sSL https://x.y/install.sh | bash", expected: "match" },
    ],
};

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

        const presetChoice = await this.askPreset(type);
        if (presetChoice === "cancel") return null;
        const preset = presetChoice === "custom" ? null : presetChoice;

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
        if (isBroadPattern(pattern)) {
            const confirmed = await this.confirmBroad();
            if (!confirmed) return null;
        }

        const previewSamples = this.getPreviewSamples(type, preset);

        // Interactive Validation Loop
        while (true) {
            const decision = await this.runValidationLoop(pattern, previewSamples);
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

    private async askType(): Promise<RuleType | null> {
        const result = await select({
            message: theme.accent('What type of rule') + ' do you want to add?',
            options: [
                { value: 'secret', label: 'Secret (API keys, tokens)', hint: theme.dim('Redacts patterns from output') },
                { value: 'file', label: 'Sensitive File', hint: theme.dim('Prevents reading specific files') },
                { value: 'command', label: 'Destructive Command', hint: theme.dim('Blocks dangerous commands') },
                { value: 'cancel', label: theme.dim('Cancel'), hint: theme.dim('Exit the wizard') },
            ],
        });

        if (isCancel(result) || result === "cancel") {
            cancel("Operation cancelled.");
            return null;
        }
        if (result === "secret" || result === "file" || result === "command") {
            return result;
        }
        return null;
    }

    private async askPreset(type: RuleType): Promise<RulePreset | "custom" | "cancel"> {
        const presets = type === 'secret' ? SECRET_PRESETS :
            type === 'file' ? FILE_PRESETS :
                COMMAND_PRESETS;

        const options = [
            { value: 'cancel', label: theme.dim('Cancel'), hint: 'Exit the wizard' },
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

        if (isCancel(result) || result === "cancel") {
            cancel("Operation cancelled.");
            return "cancel";
        }
        if (result === "custom") {
            return "custom";
        }
        if (typeof result !== "string") {
            return "cancel";
        }

        const found = presets.find(p => p.name === result);
        return found || "custom";
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

    private async askPattern(type: RuleType): Promise<string | null> {
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
            message: `${symbols.warning} ${theme.warning("Warning:")} This pattern seems very broad. Continue?`,
            initialValue: false,
        });

        if (isCancel(result) || !result) {
            cancel('Operation cancelled.');
            return false;
        }

        return true;
    }


    private getPreviewSamples(type: RuleType, preset: RulePreset | null): PreviewSample[] {
        if (!preset) {
            return [...TYPE_PREVIEW_SAMPLES[type]];
        }

        const sampleEntries: PreviewSample[] = [];
        for (const sample of preset.testSamples.shouldMatch) {
            sampleEntries.push({
                label: `Expected match (${preset.name})`,
                value: sample,
                expected: "match",
            });
        }
        for (const sample of preset.testSamples.shouldNotMatch) {
            sampleEntries.push({
                label: `Expected no match (${preset.name})`,
                value: sample,
                expected: "no-match",
            });
        }

        return sampleEntries;
    }

    private async runValidationLoop(
        pattern: string,
        samples: PreviewSample[],
    ): Promise<'save' | 'edit' | 'cancel' | 'test_another'> {
        const sample = await this.askPreviewSample(samples);
        if (!sample) return 'cancel';
        if (sample !== "skip") {
            this.renderSampleResult(pattern, sample);
        } else {
            ui.row(theme.dim("Preview"), "Skipped sample check for this round.");
        }

        return this.askValidationAction();
    }

    private renderSampleResult(pattern: string, sample: PreviewSample): void {
        try {
            const isMatch = matchAgainstPattern(sample.value, pattern);
            const expectedMatch = sample.expected === "match";

            if (isMatch) {
                ui.successMsg(theme.success("Match Found!") + ` Sample: ${theme.dim(sample.value)}`);
            } else {
                ui.row(theme.error("No Match"), `Sample: ${theme.dim(sample.value)}`);
            }

            if (isMatch === expectedMatch) {
                ui.row(theme.success("Expectation"), "Result matches expected behavior.");
            } else {
                ui.row(theme.warning("Expectation"), "Result differs from expected behavior.");
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            ui.row(theme.error("Error"), message);
        }
    }

    private async askValidationAction(): Promise<'save' | 'edit' | 'cancel' | 'test_another'> {
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
        if (action === "save" || action === "edit" || action === "test_another") {
            return action;
        }
        return "cancel";
    }

    private async askPreviewSample(samples: PreviewSample[]): Promise<PreviewSample | "skip" | null> {
        const options = [
            { value: "skip", label: theme.dim("Skip preview"), hint: "Continue without running a sample check" },
            ...samples.map((sample, index) => ({
                value: String(index),
                label: sample.label,
                hint: theme.dim(sample.value),
            })),
            { value: "cancel", label: theme.dim("Cancel"), hint: "Exit without saving" },
        ];

        const result = await select({
            message: theme.accent("Test Preview") + ": Select a sample to check:",
            options,
        });

        if (isCancel(result) || result === "cancel") return null;
        if (result === "skip") return "skip";
        if (typeof result !== "string") return null;

        const parsed = Number(result);
        if (Number.isNaN(parsed) || parsed < 0 || parsed >= samples.length) {
            return null;
        }

        return samples[parsed];
    }
}
