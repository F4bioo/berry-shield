import { describe, it, expect } from "vitest";
import { redactString, walkAndRedact } from "../src/utils/redaction";
import { getAllRedactionPatterns } from "../src/patterns";

describe("PII Context-Aware Redaction (Brazilian)", () => {
    const patterns = getAllRedactionPatterns();

    describe("CPF Pattern", () => {
        it("should redact CPF when context keyword is present", () => {
            const text = "O CPF do cliente é 123.456.789-09 e foi confirmado.";
            const result = redactString(text, patterns);

            expect(result.content).toMatch(/\[BERRY:PII_CPF_BR#[A-F0-9]{6}\]/);
            expect(result.redactionCount).toBeGreaterThan(0);
            expect(result.redactedTypes).toContain("berry:pii:cpf-br");
        });

        it("should redact CPF with 'documento' keyword", () => {
            const text = "Documento: 12345678909 foi enviado para análise.";
            const result = redactString(text, patterns);

            expect(result.content).toMatch(/\[BERRY:PII_CPF_BR#[A-F0-9]{6}\]/);
            expect(result.redactionCount).toBeGreaterThan(0);
        });

        it("should NOT redact 11-digit number without CPF context", () => {
            const text = "O telefone de contato é 11987654321 para emergências.";
            const result = redactString(text, patterns);

            // Should NOT be redacted because 'telefone' is not a CPF context word
            expect(result.content).toBe(text);
            expect(result.redactionCount).toBe(0);
        });

        it("should handle multiple CPF candidates where both have valid context", () => {
            const text = "Nota fiscal 12345678909. CPF do cliente: 98765432100";
            const result = redactString(text, patterns);

            // Both numbers are redacted: "fiscal" and "CPF" are valid context words
            expect(result.content).toMatch(/\[BERRY:PII_CPF_BR#[A-F0-9]{6}\]/);
            expect(result.content).not.toContain("12345678909");
            expect(result.content).not.toContain("98765432100");
            expect(result.redactionCount).toBe(2);
        });

        it("should respect context window boundaries", () => {
            // CPF context window: 30 chars before, 15 chars after
            const filler = "x".repeat(35);
            const text = `CPF${filler}12345678909`; // "CPF" is >30 chars before

            const result = redactString(text, patterns);

            // Should NOT redact because "CPF" is outside the context window
            expect(result.content).toBe(text);
            expect(result.redactionCount).toBe(0);
        });
    });

    describe("RG Pattern", () => {
        it("should redact RG with 'rg' keyword", () => {
            const text = "RG: 12.345.678-9 emitido em SP.";
            const result = redactString(text, patterns);

            expect(result.content).toMatch(/\[BERRY:PII_RG_BR#[A-F0-9]{6}\]/);
            expect(result.redactionCount).toBeGreaterThan(0);
            expect(result.redactedTypes).toContain("berry:pii:rg-br");
        });

        it("should redact RG with 'identidade' keyword", () => {
            const text = "Carteira de identidade número 123456789";
            const result = redactString(text, patterns);

            expect(result.content).toMatch(/\[BERRY:PII_RG_BR#[A-F0-9]{6}\]/);
            expect(result.redactionCount).toBeGreaterThan(0);
        });

        it("should NOT redact generic 9-digit numbers without RG context", () => {
            const text = "CEP: 01310-100 no bairro central.";
            const result = redactString(text, patterns);

            // Should NOT be redacted (no RG context keywords)
            expect(result.content).toBe(text);
            expect(result.redactionCount).toBe(0);
        });
    });

    describe("Context Window Edge Cases", () => {
        it("should validate context within default window (30 before, 15 after)", () => {
            // Keyword exactly 30 chars before (edge of window)
            const before = "x".repeat(25);
            const text = `CPF ${before} 12345678909`;

            const result = redactString(text, patterns);

            // Should redact (keyword is within window)
            expect(result.content).toMatch(/\[BERRY:PII_CPF_BR#[A-F0-9]{6}\]/);
        });

        it("should validate context keyword AFTER the match", () => {
            const text = "Número 12345678909 é o CPF do cliente.";
            const result = redactString(text, patterns);

            // Should redact (keyword appears after, within 15 char window)
            expect(result.content).toMatch(/\[BERRY:PII_CPF_BR#[A-F0-9]{6}\]/);
        });

        it("should ignore context keyword beyond window boundaries", () => {
            const after = "x".repeat(20);
            const text = `12345678909${after}CPF`; // "CPF" is >15 chars after

            const result = redactString(text, patterns);

            // Should NOT redact (keyword beyond window)
            expect(result.content).toBe(text);
            expect(result.redactionCount).toBe(0);
        });
    });

    describe("Nested Object Redaction", () => {
        it("should apply context-aware redaction when string has context", () => {
            const input = {
                cliente: {
                    nome: "João Silva",
                    dadosFiscais: "CPF: 12345678909",  // Context in the string itself
                    telefone: "11987654321"
                }
            };

            const result = walkAndRedact(input, patterns);

            // CPF should be redacted (has "CPF:" keyword in the string)
            expect(result.content.cliente.dadosFiscais).toMatch(/\[BERRY:PII_CPF_BR#[A-F0-9]{6}\]/);
            
            // Phone should remain (no CPF context)
            expect(result.content.cliente.telefone).toBe("11987654321");
            
            expect(result.redactionCount).toBe(1);
        });

        it("should handle JSON-in-string with context-aware patterns", () => {
            const jsonString = '{"cpf": "12345678909", "telefone": "11987654321"}';
            const result = redactString(jsonString, patterns);

            // Should redact the CPF inside the JSON string
            expect(result.content).toMatch(/\[BERRY:PII_CPF_BR#[A-F0-9]{6}\]/);
            expect(result.content).toContain("11987654321"); // phone kept
        });
    });

    describe("Pattern Overlap Resolution", () => {
        it("should prioritize Berry patterns over Gitleaks for same-length overlaps", () => {
            // "AKIAIOSFODNN7EXAMPLE" matches both:
            // - berry:secret:aws-access-key (AKIA[0-9A-Z]{16})
            // - gitleaks:aws-access-token (AKIA|ASIA|...[A-Z2-7]{16})
            const text = "Key: AKIAIOSFODNN7EXAMPLE";
            const result = redactString(text, patterns);

            // Should use Berry placeholder (more specific)
            expect(result.content).toMatch(/\[BERRY:SECRET_AWS_ACCESS_KEY#[A-F0-9]{6}\]/);
            expect(result.redactedTypes).toContain("berry:secret:aws-access-key");
        });

        it("should handle triple overlap with mathematical selectWinner algorithm", () => {
            // Create 3 context-aware patterns that all match "12345678901"
            const testPatterns: any[] = [
                {
                    id: "test:pii:short",
                    name: "PII Short",
                    category: "pii",
                    pattern: /\b\d{11}\b/g,
                    placeholder: "[PII_SHORT]",
                    isContextRequired: true,
                    contextWords: ["data", "number"],
                    contextWindow: { before: 20, after: 10 },
                },
                {
                    id: "test:secret:medium",
                    name: "Secret Medium",
                    category: "secret",
                    pattern: /\b\d{11}\b/g,
                    placeholder: "[SECRET_MEDIUM]",
                    isContextRequired: true,
                    contextWords: ["data", "number"],
                    contextWindow: { before: 20, after: 10 },
                },
                {
                    id: "test:credential:long",
                    name: "Credential Long",
                    category: "credential",
                    pattern: /\b\d{11}\b/g,
                    placeholder: "[CRED_LONG]",
                    isContextRequired: true,
                    contextWords: ["data", "number"],
                    contextWindow: { before: 20, after: 10 },
                },
            ];

            const text = "data number: 12345678901";
            const result = redactString(text, testPatterns);

            // Secret (category 4) should win over Credential (3) and PII (2)
            expect(result.content).toBe("data number: [SECRET_MEDIUM]");
            expect(result.redactionCount).toBe(1);
        });

        it("should process simple patterns in order (first match processes all occurrences)", () => {
            // Simple patterns (no isContextRequired) process sequentially
            // Each pattern's regex global flag will match ALL occurrences
            const text = "secret-key-1234567890";
            
            const testPatterns = [
                {
                    id: "test:short",
                    name: "Short",
                    category: "secret" as const,
                    pattern: /secret-\w+/g, // Matches "secret-key" only
                    placeholder: "[SHORT]",
                },
                {
                    id: "test:long",
                    name: "Long",
                    category: "secret" as const,
                    pattern: /secret-key-\d+/g, // Matches "secret-key-1234567890"
                    placeholder: "[LONG]",
                }
            ];

            const result = redactString(text, testPatterns);

            // In the unified motor, both patterns compete in the same pool.
            // "secret-key" (10c) vs "secret-key-1234567890" (21c).
            // LONGER MATCH WINS (more specific).
            expect(result.content).toBe("[LONG]");
        });

        it("should prioritize higher category over length", () => {
            const testPatterns = [
                {
                    id: "test:secret",
                    name: "Secret",
                    category: "secret" as const,
                    pattern: /key-\d{4}/g,
                    placeholder: "[SEC]",
                },
                {
                    id: "test:pii",
                    name: "PII",
                    category: "pii" as const,
                    pattern: /key-\d{4}-pii-\d{4}/g, // longer but lower category
                    placeholder: "[PII]",
                }
            ];

            const text = "value: key-1234-pii-5678";
            const result = redactString(text, testPatterns);

            // Secret category (4) > PII (2), so shorter secret pattern should win
            expect(result.content).toBe("value: [SEC]-pii-5678");
        });
    });

    describe("Chinese ID Pattern", () => {
        it("should redact valid Chinese ID number", () => {
            // Valid format: 18 digits with embedded date (YYYYMMDD) and check digit
            const text = "Citizen ID: 11010519491231002X registered in system.";
            const result = redactString(text, patterns);

            expect(result.content).toMatch(/\[BERRY:PII_ID_CN#[A-F0-9]{6}\]/);
            expect(result.redactionCount).toBe(1);
            expect(result.redactedTypes).toContain("berry:pii:id-cn");
        });

        it("should NOT redact invalid Chinese ID formats", () => {
            // Invalid: wrong length, invalid date, etc.
            const text = "Random number 12345678901234567 is not a valid ID.";
            const result = redactString(text, patterns);

            // Should NOT be redacted (doesn't match strict 18-digit format with date validation)
            expect(result.content).toBe(text);
            expect(result.redactionCount).toBe(0);
        });
    });

    describe("Chinese Phone Pattern", () => {
        it("should redact Chinese phone with context keyword", () => {
            const text = "Mobile phone: 13912345678 for contact.";
            const result = redactString(text, patterns);

            expect(result.content).toMatch(/\[BERRY:PII_CN_PHONE#[A-F0-9]{6}\]/);
            expect(result.redactionCount).toBe(1);
            expect(result.redactedTypes).toContain("berry:pii:cn-phone");
        });

        it("should NOT redact 11-digit number without Chinese phone context", () => {
            // Brazilian DDD 11 phone looks like CN phone but has different context
            const text = "Telefone brasileiro: 11987654321 para contato.";
            const result = redactString(text, patterns);

            // Should NOT be redacted as CN phone (no Chinese context)
            // Note: May still be redacted as BR phone depending on pattern order
            expect(result.content).not.toMatch(/\[BERRY:PII_CN_PHONE#[A-F0-9]{6}\]/);
        });
    });

    describe("Passport Pattern", () => {
        it("should redact passport number with 'passport' keyword", () => {
            const text = "Passport number: ABC123456 issued in 2020.";
            const result = redactString(text, patterns);

            expect(result.content).toMatch(/\[BERRY:PII_PASSPORT#[A-F0-9]{6}\]/);
            expect(result.redactionCount).toBe(1);
            expect(result.redactedTypes).toContain("berry:pii:passport");
        });

        it("should redact passport with Chinese keyword (mixed text)", () => {
            // Using "passport" in English with Chinese characters for broader compatibility
            const text = "护照 passport number: G12345678 issued in China.";
            const result = redactString(text, patterns);

            expect(result.content).toMatch(/\[BERRY:PII_PASSPORT#[A-F0-9]{6}\]/);
            expect(result.redactionCount).toBe(1);
        });
    });

    describe("Performance Validation", () => {
        it("should handle 1MB log with context patterns efficiently (stress test)", () => {
            // Generate a 1MB text (~10k lines) with 100 CPFs embedded in valid context
            // This validates GC behavior and latency under realistic production load
            const lines = Array.from({ length: 10_000 }, (_, i) => {
                // Every 100th line contains a CPF with context
                if (i % 100 === 50) {
                    return `2026-03-17T22:10:24Z [INFO] Documento CPF: 12345678909 validado com sucesso`;
                }
                // Other lines are generic log noise
                return `2026-03-17T22:10:24Z [INFO] Generic log entry ${i} processing data and events`;
            });

            const megabyteLog = lines.join("\n"); // ~1MB
            
            // Verify we actually generated ~1MB
            const sizeInMB = new Blob([megabyteLog]).size / (1024 * 1024);
            expect(sizeInMB).toBeGreaterThan(0.7); // At least 700KB (realistic for 10k lines)
            expect(sizeInMB).toBeLessThan(1.5); // At most 1.5MB
            
            const start = Date.now();
            const result = redactString(megabyteLog, patterns);
            const duration = Date.now() - start;

            expect(result.redactionCount).toBe(100); // 100 CPFs embedded
            expect(result.content).toMatch(/\[BERRY:PII_CPF_BR#[A-F0-9]{6}\]/);
            expect(duration).toBeLessThan(500); // 1MB should process in <500ms
        });
    });
});
