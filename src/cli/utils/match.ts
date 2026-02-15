import vm from 'node:vm';

/**
 * Options for the match utility.
 */
interface MatchOptions {
    /** Maximum time in milliseconds allowed for the regex execution */
    timeoutMs?: number;
}

/**
 * Safely matches an input string against a regex pattern.
 * Replicates the normalization logic from the core security engine.
 * 
 * @param input The text to test
 * @param rawPattern The regex pattern string
 * @param options Configuration for safety limits
 * @returns boolean indicating if the pattern matches the input
 */
export function matchAgainstPattern(
    input: string,
    rawPattern: string,
    options: MatchOptions = {}
): boolean {
    const timeoutMs = options.timeoutMs ?? 100;

    let pattern = rawPattern;
    let flags = "gi";

    if (pattern.startsWith("(?i)")) {
        pattern = pattern.substring(4);
        flags = "gi";
    }

    try {
        const script = new vm.Script(`new RegExp(pattern, flags).test(input)`);
        const context = vm.createContext({ pattern, flags, input });

        return script.runInContext(context, { timeout: timeoutMs });
    } catch (error: any) {
        if (error && (error.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT' || error.message?.includes('timeout'))) {
            throw new Error(`Regex matching timed out after ${timeoutMs}ms (Potential ReDoS detected)`);
        }
        return false;
    }
}
