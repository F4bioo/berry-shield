import { describe, expect, it, vi } from "vitest";
import { ui } from "../src/cli/ui/tui.js";

describe("ui.scaffold", () => {
    it("renders header/content and uses default footer when bottom is omitted", () => {
        const order: string[] = [];
        const footerSpy = vi.spyOn(ui, "footer").mockImplementation(() => {
            order.push("footer");
        });

        ui.scaffold({
            header: (helpers) => {
                expect(typeof helpers.header).toBe("function");
                expect("footer" in helpers).toBe(false);
                order.push("header");
            },
            content: (helpers) => {
                expect(typeof helpers.section).toBe("function");
                expect(typeof helpers.row).toBe("function");
                expect(typeof helpers.successMsg).toBe("function");
                expect("header" in helpers).toBe(false);
                expect("footer" in helpers).toBe(false);
                order.push("content");
            },
        });

        expect(order).toEqual(["header", "content", "footer"]);
        expect(footerSpy).toHaveBeenCalledTimes(1);
        footerSpy.mockRestore();
    });

    it("uses custom bottom and does not call default footer", () => {
        const order: string[] = [];
        const footerSpy = vi.spyOn(ui, "footer").mockImplementation(() => {
            order.push("footer");
        });

        ui.scaffold({
            content: () => {
                order.push("content");
            },
            bottom: (helpers) => {
                expect(typeof helpers.footer).toBe("function");
                expect("header" in helpers).toBe(false);
                expect("row" in helpers).toBe(false);
                order.push("bottom");
            },
        });

        expect(order).toEqual(["content", "bottom"]);
        expect(footerSpy).not.toHaveBeenCalled();
        footerSpy.mockRestore();
    });

    it("renders section label", () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

        ui.section("Summary");

        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Summary"));
        logSpy.mockRestore();
    });
});
