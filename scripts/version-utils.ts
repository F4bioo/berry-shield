/**
 * Calculates the next version based on CalVer (YYYY.M.D[-suffix]).
 * 
 * @param currentVersion The current version string from package.json
 * @param now The current date (passed as argument to allow testing)
 * @returns The new version string
 */
export function calculateNextVersion(currentVersion: string, now: Date = new Date()): string {
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 0-indexed
    const day = now.getDate();

    // Target base version: YYYY.M.D (no leading zeros)
    const targetBase = `${year}.${month}.${day}`;

    // Check if current version matches today's base
    if (currentVersion === targetBase) {
        // It's the first build of the day, next is -1
        return `${targetBase}-1`;
    }

    if (currentVersion.startsWith(`${targetBase}-`)) {
        // It already has a suffix
        const suffixPart = currentVersion.substring(targetBase.length + 1);
        const suffixNum = parseInt(suffixPart, 10);

        if (!isNaN(suffixNum)) {
            return `${targetBase}-${suffixNum + 1}`;
        }
    }

    // Default: If date changed OR format implies migration (e.g. 1.0.0) -> Clean build
    return targetBase;
}
