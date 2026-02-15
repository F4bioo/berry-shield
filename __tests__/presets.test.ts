import { describe, it, expect } from 'vitest';
import { SECRET_PRESETS, FILE_PRESETS, COMMAND_PRESETS, type RulePreset } from '../src/cli/presets.js';

function testPresets(presets: readonly RulePreset[]) {
    for (const preset of presets) {
        describe(preset.name, () => {
            it("has a valid regex pattern", () => {
                expect(() => new RegExp(preset.pattern, "gi")).not.toThrow();
            });

            for (const sample of preset.testSamples.shouldMatch) {
                it(`matches: ${sample}`, () => {
                    const regex = new RegExp(preset.pattern, "gi");
                    expect(regex.test(sample)).toBe(true);
                });
            }

            for (const sample of preset.testSamples.shouldNotMatch) {
                it(`does NOT match: ${sample}`, () => {
                    const regex = new RegExp(preset.pattern, "gi");
                    expect(regex.test(sample)).toBe(false);
                });
            }
        });
    }
}

describe("Presets Validation", () => {
    describe("SECRET_PRESETS", () => {
        testPresets(SECRET_PRESETS);
    });

    describe("FILE_PRESETS", () => {
        testPresets(FILE_PRESETS);
    });

    describe("COMMAND_PRESETS", () => {
        testPresets(COMMAND_PRESETS);
    });
});
