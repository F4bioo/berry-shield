
import { describe, it, expect } from "vitest";
import { redactString } from "../src/utils/redaction";
import { getAllRedactionPatterns } from "../src/patterns";

describe("Redaction Engine - 10MB Stress Test", () => {
    const patterns = getAllRedactionPatterns();
    const PERFORMANCE_THRESHOLD_MS = process.env.BERRY_STRESS_STRICT === "1" ? 1500 : 5000;

    it("should process 10MB of mixed data efficiently", () => {
        // 1. Generate 10MB of data
        const secret = "AKIA1234567890123456"; 
        const pii = "Taxpayer identifier CPF: 123.456.789-01"; 
        const noise = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(150);
        const block = `${noise}\n${secret}\n${noise}\n${pii}\n`;
        
        // Repeat 1000 times to get ~10MB
        const largePayload = block.repeat(1000);
        const sizeMB = Buffer.byteLength(largePayload) / (1024 * 1024);
        
        console.log(`[StressTest] Payload Size: ${sizeMB.toFixed(2)} MB`);

        // 2. Run Redaction
        const start = Date.now();
        const result = redactString(largePayload, patterns);
        const duration = Date.now() - start;

        console.log(`[StressTest] Duration: ${duration}ms`);

        // 3. Assertions
        expect(result.redactionCount).toBe(2000);
        expect(result.content).toMatch(/\[BERRY:SECRET_AWS_ACCESS_KEY#[A-F0-9]{6}\]/);
        
        // Performance threshold is dual-mode:
        // - strict mode (BERRY_STRESS_STRICT=1): 1500ms for isolated benchmark runs
        // - default mode: 5000ms for full-suite concurrent execution stability
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    }, 8000);
});
