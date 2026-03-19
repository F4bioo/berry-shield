import { describe, it, expect } from "vitest";
import { walkAndRedact } from "../src/utils/redaction.js";
import { getAllRedactionPatterns } from "../src/patterns/index.js";

describe("Pattern Collision Shield 🛡️⚔️", () => {
    const patterns = getAllRedactionPatterns();

    const testRedaction = (input: string, expectedPlaceholder: string, description: string) => {
        it(`should prioritize ${expectedPlaceholder} for: ${description}`, () => {
            const { content } = walkAndRedact(input, patterns);
            expect(content).toContain(expectedPlaceholder);
            // Ensure no generic placeholder "stole" the match
            if (expectedPlaceholder !== "[API_KEY_REDACTED]") {
                expect(content).not.toContain("[API_KEY_REDACTED]");
            }
            if (expectedPlaceholder !== "[GENERIC_SECRET_REDACTED]") {
                expect(content).not.toContain("[GENERIC_SECRET_REDACTED]");
            }
        });
    };

    describe("AI Secrets vs Generics", () => {
        testRedaction(
            'const config = { mistral_api_key: "mistral-12345678901234567890123456789012" };',
            "BERRY:SECRET_MISTRAL_API_KEY",
            "Mistral API Key"
        );
        testRedaction(
            'const groq = "gsk_v1_123456789012345678901234567890123456789012345678";',
            "BERRY:SECRET_GROQ_API_KEY",
            "Groq API Key"
        );
        testRedaction(
            'export const OPENAI_API_KEY = "sk-12345678901234567890123456789012";',
            "BERRY:SECRET_OPENAI_KEY",
            "OpenAI Key"
        );
    });

    describe("Crypto vs Generics", () => {
        testRedaction(
            'const wallet = "0x1234567890123456789012345678901234567890123456789012345678901234";',
            "BERRY:SECRET_ETH_PRIVATE_KEY",
            "ETH Private Key"
        );
        testRedaction(
            '{"mnemonic": "apple banana cherry dog elephant fish goat house ice jump kite lamp"}',
            "_REDACTED]",
            "BIP39 Seed (12 words)"
        );
        testRedaction(
            '{"seed": "apple banana cherry dog elephant fish goat house ice jump kite lamp apple banana cherry dog elephant fish goat house ice jump kite lamp"}',
            "_REDACTED]",
            "BIP39 Seed (24 words)"
        );
    });

    describe("Trading vs Generics", () => {
        testRedaction(
            'binance_secret: "1234567890123456789012345678901234567890123456789012345678901234"',
            "BERRY:SECRET_BINANCE_API_KEY",
            "Binance Secret"
        );
        testRedaction(
            'coinbase_api_key = "12345678901234567890"',
            "BERRY:SECRET_COINBASE_API_KEY",
            "Coinbase API Key"
        );
    });

    describe("Cloud/Infra vs Generics", () => {
        testRedaction(
            'Authorization: Bearer my-secret-token-1234567890',
            "BERRY:SECRET_BEARER_TOKEN",
            "Bearer Token"
        );
        testRedaction(
            'VERCEL_TOKEN="vercel_123456789012345678901234"',
            "BERRY:SECRET_VERCEL_TOKEN",
            "Vercel Token"
        );
        testRedaction(
            'DATABASE_URL="postgresql://user:password@localhost:5432/db"',
            "BERRY:SECRET_DATABASE_URL",
            "Database URL"
        );
    });
});
