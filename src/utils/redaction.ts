/**
 * Redaction utilities for Berry.Pulp layer.
 *
 * These functions handle the actual redaction of sensitive data
 * in strings and nested objects.
 */

import { getAllRedactionPatterns, type SecurityPattern } from "../patterns";

/**
 * Result of a redaction operation.
 */
export interface RedactionResult<T = unknown> {
    /** The redacted content */
    content: T;
    /** Number of redactions made */
    redactionCount: number;
    /** Types of data that were redacted */
    redactedTypes: string[];
}

/**
 * Simple unescape for common encoded characters in tool outputs (like curl).
 */
function unescapeString(text: string): string {
    if (!text.includes("\\") && !text.includes("%")) return text;

    try {
        // Handle basic JSON-like escapes (\", \n, \t, etc)
        // We use a safe subset to avoid breaking the original string structure
        return text
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, "\\")
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "\r")
            .replace(/\\t/g, "\t")
            .replace(/\\u([0-9a-fA-F]{4})/g, (_, code: string) =>
                String.fromCharCode(parseInt(code, 16))
            );
    } catch {
        return text;
    }
}

/**
 * Applies redaction patterns to a string.
 *
 * @param text - The text to redact
 * @param patterns - Security patterns to apply
 * @returns Redaction result with stats
 */
export function redactString(
    text: string,
    patterns: SecurityPattern[]
): RedactionResult<string> {
    const unescaped = unescapeString(text);
    let redactionCount = 0;
    const redactedTypes: string[] = [];

    // We work on the unescaped version for maximum detection
    let currentResult = unescaped;

    for (const pattern of patterns) {
        pattern.pattern.lastIndex = 0;

        // Match on the current state of redacted text
        const matches = currentResult.match(pattern.pattern);
        if (matches && matches.length > 0) {
            currentResult = currentResult.replace(pattern.pattern, pattern.placeholder);
            redactionCount += matches.length;
            if (!redactedTypes.includes(pattern.name)) {
                redactedTypes.push(pattern.name);
            }
        }
    }

    // If we found secrets in the unescaped version, we return that version (redacted)
    // If not, we return the original text to preserve exact formatting/escapes if possible
    return {
        content: redactionCount > 0 ? currentResult : text,
        redactionCount,
        redactedTypes,
    };
}

import { SENSITIVE_KEY_EXACT, SENSITIVE_KEY_SUFFIXES } from "../constants.js";

function isSensitiveKey(key: string): boolean {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEY_EXACT.has(lower)) return true;
    return SENSITIVE_KEY_SUFFIXES.some(suffix => lower.endsWith(suffix));
}

/**
 * Recursively walks through an object and redacts sensitive data.
 * Optimized for performance and memory (Lazy Cloning).
 * 
 * @param obj - The object to walk and redact
 * @param patterns - Security patterns to apply
 * @param seen - Tracking for circular references
 * @returns Redaction result with stats
 */
export function walkAndRedact<T>(
    obj: T,
    patterns: SecurityPattern[],
    seen: WeakSet<object> = new WeakSet()
): RedactionResult<T> {
    // Return primitives unchanged
    if (obj === null || typeof obj !== "object" && typeof obj !== "string") {
        return { content: obj, redactionCount: 0, redactedTypes: [] };
    }

    // Handle strings
    if (typeof obj === "string") {
        const trimmed = obj.trim();
        const isJsonCandidate = (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
            (trimmed.startsWith("[") && trimmed.endsWith("]"));

        if (isJsonCandidate) {
            try {
                const parsed = JSON.parse(obj) as unknown;
                // Recursively redact the parsed object (circular refs handled there)
                const result = walkAndRedact(parsed, patterns, seen);

                if (result.redactionCount > 0) {
                    return {
                        content: JSON.stringify(result.content) as unknown as T,
                        redactionCount: result.redactionCount,
                        redactedTypes: result.redactedTypes,
                    };
                }
            } catch {
                // Not valid JSON, fall through to normal string redaction
            }
        }

        const redaction = redactString(obj, patterns);
        return redaction as unknown as RedactionResult<T>;
    }

    // Circular reference protection for Objects and Arrays
    if (seen.has(obj)) {
        return { content: obj, redactionCount: 0, redactedTypes: [] };
    }
    seen.add(obj);

    // Handle arrays
    if (Array.isArray(obj)) {
        let totalRedactions = 0;
        const allRedactedTypes: string[] = [];
        let hasChanges = false;

        const resultArray = obj.map(item => {
            const result = walkAndRedact(item, patterns, seen);
            if (result.redactionCount > 0) {
                totalRedactions += result.redactionCount;
                hasChanges = true;
                result.redactedTypes.forEach(t => {
                    if (!allRedactedTypes.includes(t)) allRedactedTypes.push(t);
                });
            }
            return result.content;
        });

        return {
            content: (hasChanges ? resultArray : obj) as unknown as T,
            redactionCount: totalRedactions,
            redactedTypes: allRedactedTypes,
        };
    }

    // Handle objects
    const record = obj as Record<string, unknown>;
    let totalRedactions = 0;
    const allRedactedTypes: string[] = [];
    let redactedObject: Record<string, unknown> | null = null;

    for (const [key, value] of Object.entries(record)) {
        let currentContent = value;
        let currentRedactions = 0;
        const currentTypes: string[] = [];

        // Key-Based Redaction
        if (isSensitiveKey(key) && value !== null && typeof value !== "object") {
            currentContent = `[${key.toUpperCase()}_REDACTED]`;
            currentRedactions = 1;
            currentTypes.push(`Key: ${key}`);
        } else {
            const result = walkAndRedact(value, patterns, seen);
            currentContent = result.content;
            currentRedactions = result.redactionCount;
            result.redactedTypes.forEach(t => currentTypes.push(t));
        }

        if (currentRedactions > 0 || currentContent !== value) {
            // Lazy initialization of the redacted object
            if (!redactedObject) {
                redactedObject = { ...record };
            }
            redactedObject[key] = currentContent;
            totalRedactions += currentRedactions;
            currentTypes.forEach(t => {
                if (!allRedactedTypes.includes(t)) allRedactedTypes.push(t);
            });
        }
    }

    return {
        content: (redactedObject ? redactedObject : obj) as T,
        redactionCount: totalRedactions,
        redactedTypes: allRedactedTypes,
    };
}

/**
 * Efficiently finds all security patterns that match the given text or object.
 * Does NOT modify the input.
 * 
 * @param obj - The object or string to check
 * @param patterns - Security patterns or raw RegExps to search for
 * @returns Array of unique pattern names that matched
 */
export function findMatches(
    obj: unknown,
    patterns: SecurityPattern[] | RegExp[],
    seen: WeakSet<object> = new WeakSet()
): string[] {
    const matchedNames = new Set<string>();

    const walk = (current: unknown) => {
        if (!current) return;

        if (typeof current === "string") {
            const unescaped = unescapeString(current);
            for (const p of patterns) {
                const regex = p instanceof RegExp ? p : p.pattern;
                const name = p instanceof RegExp ? "Sensitive Pattern" : p.name;

                regex.lastIndex = 0;
                if (regex.test(unescaped)) {
                    matchedNames.add(name);
                }
            }
            return;
        }

        if (typeof current === "object") {
            if (seen.has(current)) return;
            seen.add(current);

            if (Array.isArray(current)) {
                for (const item of current) {
                    walk(item);
                }
            } else {
                for (const value of Object.values(current as Record<string, unknown>)) {
                    walk(value);
                }
            }
        }
    };

    walk(obj);
    return Array.from(matchedNames);
}

/**
 * Redacts all sensitive data from an object using default patterns.
 *
 * @param obj - The object to redact
 * @returns Redaction result with stats
 */
export function redactSensitiveData<T>(obj: T): RedactionResult<T> {
    const patterns = getAllRedactionPatterns();
    return walkAndRedact(obj, patterns);
}
