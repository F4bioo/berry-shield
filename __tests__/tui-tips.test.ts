import { describe, expect, it } from "vitest";
import { TIPS } from "../src/cli/ui/tui.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";

describe("TUI tips coverage", () => {
    it("covers every configured security layer with at least one tip", () => {
        const layers = Object.keys(DEFAULT_CONFIG.layers);
        const corpus = TIPS.join(" ").toLowerCase();

        for (const layer of layers) {
            expect(corpus).toContain(layer.toLowerCase());
        }
    });
});

