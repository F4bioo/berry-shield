import { BRAND_SYMBOL } from "../../constants.js";

/**
 * Palette for CLI/UI theming.
 * Ref: OpenClaw Core Palette
 */
const BERRY_PALETTE = {
    accent: "#FF5A2D",       // Coral (Header titles)
    accentBright: "#FF7A3D", // Highlighted commands
    muted: "#8B7F77",        // Labels (Grayish)
    success: "#2FBF71",      // Green (Active/Safe)
    warning: "#FFB000",      // Gold/Amber (Caution)
    error: "#E23D2D",        // Red (Blocked/Error)
    border: "#3C414B",       // Separators (─)
    marker: "#7DD3A5",       // Section Diamonds (◇)
} as const;

/**
 * Utility to convert Hex to ANSI 256-color or 24-bit color.
 * Since we want maximum performance on RPI4, we use simple ANSI escape codes.
 */
function hexToAnsi(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `\x1b[38;2;${r};${g};${b}m`;
}

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

export const theme = {
    accent: (text: string) => `${hexToAnsi(BERRY_PALETTE.accent)}${text}${RESET}`,
    accentBold: (text: string) => `${BOLD}${hexToAnsi(BERRY_PALETTE.accent)}${text}${RESET}`,
    muted: (text: string) => `${hexToAnsi(BERRY_PALETTE.muted)}${text}${RESET}`,
    success: (text: string) => `${hexToAnsi(BERRY_PALETTE.success)}${text}${RESET}`,
    warning: (text: string) => `${hexToAnsi(BERRY_PALETTE.warning)}${text}${RESET}`,
    error: (text: string) => `${hexToAnsi(BERRY_PALETTE.error)}${text}${RESET}`,
    border: (text: string) => `${hexToAnsi(BERRY_PALETTE.border)}${text}${RESET}`,
    marker: (text: string) => `${hexToAnsi(BERRY_PALETTE.marker)}${text}${RESET}`,
    dim: (text: string) => `${DIM}${text}${RESET}`,
    bold: (text: string) => `${BOLD}${text}${RESET}`,
    version: (text: string) => `${hexToAnsi(BERRY_PALETTE.accentBright)}${text}${RESET}`,
    tipText: (text: string) => `${DIM}${hexToAnsi(BERRY_PALETTE.accentBright)}${text}${RESET}`,
};

export const symbols = {
    brand: BRAND_SYMBOL,
    success: theme.success("✓"),
    warning: theme.warning("!"),
    failure: theme.error("✗"),
    error: theme.error("✗"),
    marker: theme.marker("◇"),
};
