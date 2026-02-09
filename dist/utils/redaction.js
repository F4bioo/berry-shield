/**
 * Redaction utilities for Berry.Pulp layer.
 *
 * These functions handle the actual redaction of sensitive data
 * in strings and nested objects.
 */
import { getAllRedactionPatterns } from "../patterns";
/**
 * Applies redaction patterns to a string.
 *
 * @param text - The text to redact
 * @param patterns - Security patterns to apply
 * @returns Redaction result with stats
 */
export function redactString(text, patterns) {
    let result = text;
    let redactionCount = 0;
    const redactedTypes = [];
    for (const pattern of patterns) {
        // Reset regex lastIndex for global patterns
        pattern.pattern.lastIndex = 0;
        const matches = text.match(pattern.pattern);
        if (matches && matches.length > 0) {
            result = result.replace(pattern.pattern, pattern.placeholder);
            redactionCount += matches.length;
            if (!redactedTypes.includes(pattern.name)) {
                redactedTypes.push(pattern.name);
            }
        }
    }
    return {
        content: result,
        redactionCount,
        redactedTypes,
    };
}
/**
 * Recursively walks through an object and redacts sensitive data.
 *
 * @param obj - The object to walk and redact
 * @param patterns - Security patterns to apply
 * @returns Redaction result with stats
 */
export function walkAndRedact(obj, patterns) {
    // Handle strings directly
    if (typeof obj === "string") {
        return redactString(obj, patterns);
    }
    // Handle arrays
    if (Array.isArray(obj)) {
        let totalRedactions = 0;
        const allRedactedTypes = [];
        const redactedArray = obj.map((item) => {
            const result = walkAndRedact(item, patterns);
            totalRedactions += result.redactionCount;
            for (const type of result.redactedTypes) {
                if (!allRedactedTypes.includes(type)) {
                    allRedactedTypes.push(type);
                }
            }
            return result.content;
        });
        return {
            content: redactedArray,
            redactionCount: totalRedactions,
            redactedTypes: allRedactedTypes,
        };
    }
    // Handle objects
    if (obj && typeof obj === "object") {
        let totalRedactions = 0;
        const allRedactedTypes = [];
        const redactedObject = {};
        for (const [key, value] of Object.entries(obj)) {
            const result = walkAndRedact(value, patterns);
            redactedObject[key] = result.content;
            totalRedactions += result.redactionCount;
            for (const type of result.redactedTypes) {
                if (!allRedactedTypes.includes(type)) {
                    allRedactedTypes.push(type);
                }
            }
        }
        return {
            content: redactedObject,
            redactionCount: totalRedactions,
            redactedTypes: allRedactedTypes,
        };
    }
    // Return primitives unchanged
    return {
        content: obj,
        redactionCount: 0,
        redactedTypes: [],
    };
}
/**
 * Redacts all sensitive data from an object using default patterns.
 *
 * @param obj - The object to redact
 * @returns Redaction result with stats
 */
export function redactSensitiveData(obj) {
    const patterns = getAllRedactionPatterns();
    return walkAndRedact(obj, patterns);
}
