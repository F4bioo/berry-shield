import { describe, expect, it } from "vitest";
import { 
    SECRET_PATTERNS, 
    PII_PATTERNS, 
    INTERNAL_SENSITIVE_FILE_PATTERNS, 
    INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS 
} from "../src/patterns/index.js";
import { NAMESPACES, CATEGORIES } from "../src/patterns/constants.js";

describe("Pattern Governance Contract", () => {
    const allProviders = Object.values(NAMESPACES);

    describe("ID & Namespace Compliance", () => {
        it("every secret pattern ID follows the provider:category:id contract", () => {
            SECRET_PATTERNS.forEach((p) => {
                const parts = p.id.split(":");
                // Expect at least provider:category:name (3 parts) 
                // but could be berry:secret:extended:id (4 parts)
                expect(parts.length).toBeGreaterThanOrEqual(3);
                
                const [provider, category] = parts;
                expect(allProviders).toContain(provider);
                expect(category).toBe(CATEGORIES.SECRET);
            });
        });

        it("every PII pattern ID follows the provider:category:id contract", () => {
            PII_PATTERNS.forEach((p) => {
                const parts = p.id.split(":");
                expect(parts.length).toBeGreaterThanOrEqual(3);
                
                const [provider, category] = parts;
                expect(allProviders).toContain(provider);
                expect(category).toBe(CATEGORIES.PII);
            });
        });

        it("sensitive files and destructive commands have stable IDs", () => {
            INTERNAL_SENSITIVE_FILE_PATTERNS.forEach(p => {
                expect(p.id).toMatch(/^berry:file:[a-z0-9-]+$/);
            });
            INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS.forEach(p => {
                expect(p.id).toMatch(/^berry:command:[a-z0-9-]+$/);
            });
        });

        it("contains no ID collisions across all pattern sets", () => {
            const allIds = [
                ...SECRET_PATTERNS.map(p => p.id),
                ...PII_PATTERNS.map(p => p.id),
                ...INTERNAL_SENSITIVE_FILE_PATTERNS.map(p => p.id),
                ...INTERNAL_DESTRUCTIVE_COMMAND_PATTERNS.map(p => p.id),
            ];
            const uniqueIds = new Set(allIds);
            expect(uniqueIds.size).toBe(allIds.length);
        });
    });

    describe("Placeholder & Redaction Quality", () => {
        it("every redaction pattern MUST have a placeholder OR use the dynamic generator", () => {
            const redactionPatterns = [...SECRET_PATTERNS, ...PII_PATTERNS];
            redactionPatterns.forEach(p => {
                if (p.placeholder) {
                    // Check if it HAS the tag (e.g. [ANY_REDACTED]) anywhere in the string
                    expect(p.placeholder).toMatch(/\[[A-Z0-9_]+_REDACTED\]|\[BERRY:[A-Z0-9_]+\]/);
                } else {
                    // If no placeholder, it MUST have an ID and (optionally) includeHash
                    expect(p.id).toBeDefined();
                    expect(p.id).toMatch(/^(berry|gitleaks):/);
                }
            });
        });

        it("every pattern has the global flag (g) set for complete redaction", () => {
            const redactionPatterns = [...SECRET_PATTERNS, ...PII_PATTERNS];
            redactionPatterns.forEach(p => {
                expect(p.pattern.global).toBe(true);
            });
        });

        it("placeholders follow standard visual format (even with context)", () => {
            const redactionPatterns = [...SECRET_PATTERNS, ...PII_PATTERNS];
            redactionPatterns.forEach(p => {
                if (p.placeholder) {
                    // Should at least end with the closing bracket of the tag or a quote
                    expect(p.placeholder).toMatch(/[\]"]$/);
                }
            });
        });
    });

    describe("Mapper Composition logic", () => {
        it("combines internal berry patterns with community gitleaks patterns", () => {
            const hasBerry = SECRET_PATTERNS.some(p => p.id.startsWith("berry:"));
            const hasGitleaks = SECRET_PATTERNS.some(p => p.id.startsWith("gitleaks:"));
            
            expect(hasBerry).toBe(true);
            expect(hasGitleaks).toBe(true);
        });

        it("lower-cases all IDs regardless of source", () => {
             SECRET_PATTERNS.forEach(p => {
                 expect(p.id).toBe(p.id.toLowerCase());
             });
        });
    });
});
