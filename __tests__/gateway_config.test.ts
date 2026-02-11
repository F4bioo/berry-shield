
import { describe, it, expect } from "vitest";
import { walkAndRedact } from "../src/utils/redaction";
import { SECRET_PATTERNS } from "../src/patterns";

// Partial mock of the user's gateway config that was leaking
const GATEWAY_CONFIG = {
    "ok": true,
    "result": {
        "raw": "{\"tools\":{\"web\":{\"search\":{\"apiKey\":\"BSAjK9xL2mN4pQ5rS8tU1vW3xY7zAFAKE\"}}},\"gateway\":{\"auth\":{\"token\":\"c3d4d3c2b1e4f5a6d7c8e9f0a1b2c3d4e5f6a9c0dn6FAKE\"}},\"channels\":{\"telegram\":{\"botToken\":\"123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11\"}}}",
        "parsed": {
            "tools": {
                "web": {
                    "search": {
                        "apiKey": "BSAjK9xL2mN4pQ5rS8tU1vW3xY7zAFAKE"
                    }
                }
            },
            "gateway": {
                "auth": {
                    "token": "c3d4d3c2b1e4f5a6d7c8e9f0a1b2c3d4e5f6a9c0dn6FAKE"
                }
            },
            "channels": {
                "telegram": {
                    "botToken": "1234567890:VVPZolspxva_OIA_MQAOmaysnsHUomAFAKE"
                }
            }
        }
    }
};

describe("Gateway Config Redaction", () => {

    it("should redact ALL sensitive tokens in the gateway config", () => {
        const { content } = walkAndRedact(GATEWAY_CONFIG, SECRET_PATTERNS);
        const result = content as any;
        const rawString = result.result.raw;
        const parsed = result.result.parsed;

        // 1. Telegram Token (Redacted by Key-Based logic now because it ends in 'Token')
        // Was "[TELEGRAM_TOKEN_REDACTED]", now "[BOTTOKEN_REDACTED]"
        expect(parsed.channels.telegram.botToken).toContain("BOTTOKEN_REDACTED");
        expect(rawString).toContain("BOTTOKEN_REDACTED");

        // 2. Gateway Auth Token (Was LEAKING)
        // Key-Based Redaction: "token" -> "[TOKEN_REDACTED]"
        expect(parsed.gateway.auth.token).not.toContain("dn6FAKE");
        expect(parsed.gateway.auth.token).toContain("TOKEN_REDACTED");

        expect(rawString).not.toContain("dn6FAKE");
        expect(rawString).toContain("TOKEN_REDACTED");

        // 3. Web Search API Key (Was LEAKING)
        // Key-Based Redaction: "apiKey" -> "[APIKEY_REDACTED]"
        expect(parsed.tools.web.search.apiKey).not.toContain("7zAFAKE");
        expect(parsed.tools.web.search.apiKey).toContain("APIKEY_REDACTED");

        expect(rawString).not.toContain("7zAFAKE");
        expect(rawString).toContain("APIKEY_REDACTED");
    });

});
