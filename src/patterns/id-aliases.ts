/**
 * Baseline ID aliases for compatibility across upstream community rule renames.
 *
 * Keys and values must be lowercase full baseline IDs (e.g. secret:gitleaks:<id>).
 */
export const BASELINE_ID_ALIASES: Record<string, string> = {
    // Proof of Concept (POC) - Example of drift in Gitleaks
    // If an external pattern ID changes in the future, map it here to maintain compatibility.
    "secret:gitleaks:gitlab-runner-token": "gitleaks:secret:gitlab-runner-authentication-token",
};

/**
 * Remap baseline IDs using alias table.
 * - Lowercases input IDs
 * - Resolves alias chains safely
 * - Deduplicates output IDs
 */
export function remapDisabledBuiltInIds(
    ids: readonly string[],
    aliases: Readonly<Record<string, string>> = BASELINE_ID_ALIASES
): string[] {
    const out = new Set<string>();

    for (const rawId of ids) {
        let current = rawId.toLowerCase();
        const seen = new Set<string>();

        while (aliases[current]) {
            if (seen.has(current)) {
                // Break circular alias chains defensively.
                break;
            }
            seen.add(current);
            current = aliases[current].toLowerCase();
        }

        out.add(current);
    }

    return Array.from(out);
}
