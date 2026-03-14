import { describe, expect, it } from "vitest";
import {
    VineConfirmStateManager,
} from "../src/vine/confirm-state";
import { createVineIntentFromOperationTarget } from "../src/vine/authorization-intent";

function createNow(start = 1000) {
    let value = start;
    return {
        now: () => value,
        advance: (ms: number) => {
            value += ms;
        },
    };
}

describe("VineConfirmStateManager", () => {
    it("generates fixed-length numeric code without leading zero", () => {
        const clock = createNow();
        const manager = new VineConfirmStateManager(
            { maxEntries: 100, ttlSeconds: 60 },
            { now: clock.now, randomIntFn: () => 0, codeLength: 4, cleanupIntervalMs: 3600_000 }
        );

        const challenge = manager.issueChallenge({
            sessionKey: "s1",
            operation: "exec",
            target: "bash -lc 'echo hi'",
        });

        expect(challenge.confirmCode).toBe("1000");
        expect(challenge.confirmCode).toMatch(/^[1-9]\d{3}$/);
        manager.dispose();
    });

    it("expires challenge by TTL", () => {
        const clock = createNow();
        const manager = new VineConfirmStateManager(
            { maxEntries: 100, ttlSeconds: 1 },
            { now: clock.now, randomIntFn: () => 1, codeLength: 4, ttlSeconds: 1, cleanupIntervalMs: 3600_000 }
        );

        const challenge = manager.issueChallenge({
            sessionKey: "s1",
            operation: "exec",
            target: "bash -lc 'echo hi'",
        });
        clock.advance(1500);

        const result = manager.verifyAndConsume({
            sessionKey: "s1",
            operation: "exec",
            target: "bash -lc 'echo hi'",
            confirmId: challenge.confirmId,
            confirmCode: challenge.confirmCode,
        });

        expect(result.kind).toBe("not_found");
        manager.dispose();
    });

    it("consumes one-shot token after first valid use", () => {
        const clock = createNow();
        const manager = new VineConfirmStateManager(
            { maxEntries: 100, ttlSeconds: 60 },
            { now: clock.now, randomIntFn: () => 1234, codeLength: 4, cleanupIntervalMs: 3600_000 }
        );

        const challenge = manager.issueChallenge({
            sessionKey: "s1",
            operation: "write",
            target: "/tmp/ok.txt",
        });

        const first = manager.verifyAndConsume({
            sessionKey: "s1",
            operation: "write",
            target: "/tmp/ok.txt",
            confirmId: challenge.confirmId,
            confirmCode: challenge.confirmCode,
        });
        const second = manager.verifyAndConsume({
            sessionKey: "s1",
            operation: "write",
            target: "/tmp/ok.txt",
            confirmId: challenge.confirmId,
            confirmCode: challenge.confirmCode,
        });

        expect(first.kind).toBe("allowed");
        expect(second.kind).toBe("not_found");
        manager.dispose();
    });

    it("accepts numeric confirmCode input", () => {
        const clock = createNow();
        const manager = new VineConfirmStateManager(
            { maxEntries: 100, ttlSeconds: 60 },
            { now: clock.now, randomIntFn: () => 0, codeLength: 4, cleanupIntervalMs: 3600_000 }
        );

        const challenge = manager.issueChallenge({
            sessionKey: "s1",
            operation: "write",
            target: "/tmp/ok.txt",
        });

        const result = manager.verifyAndConsume({
            sessionKey: "s1",
            operation: "write",
            target: "/tmp/ok.txt",
            confirmId: challenge.confirmId,
            confirmCode: 1000,
        });

        expect(challenge.confirmCode).toBe("1000");
        expect(result.kind).toBe("allowed");
        manager.dispose();
    });

    it("rejects mismatched context and invalidates challenge", () => {
        const clock = createNow();
        const manager = new VineConfirmStateManager(
            { maxEntries: 100, ttlSeconds: 60 },
            { now: clock.now, randomIntFn: () => 1234, codeLength: 4, cleanupIntervalMs: 3600_000 }
        );

        const challenge = manager.issueChallenge({
            sessionKey: "s1",
            operation: "exec",
            target: "bash -lc 'echo A'",
        });

        const mismatch = manager.verifyAndConsume({
            sessionKey: "s1",
            operation: "exec",
            target: "bash -lc 'echo B'",
            confirmId: challenge.confirmId,
            confirmCode: challenge.confirmCode,
        });
        const after = manager.verifyAndConsume({
            sessionKey: "s1",
            operation: "exec",
            target: "bash -lc 'echo A'",
            confirmId: challenge.confirmId,
            confirmCode: challenge.confirmCode,
        });

        expect(mismatch.kind).toBe("mismatch");
        expect(after.kind).toBe("not_found");
        manager.dispose();
    });

    it("returns max_attempts_exceeded after configured failed attempts", () => {
        const clock = createNow();
        const manager = new VineConfirmStateManager(
            { maxEntries: 100, ttlSeconds: 60 },
            { now: clock.now, randomIntFn: () => 1234, codeLength: 4, maxAttempts: 3, cleanupIntervalMs: 3600_000 }
        );

        const challenge = manager.issueChallenge({
            sessionKey: "s1",
            operation: "exec",
            target: "bash -lc 'echo hi'",
        });

        const attempt1 = manager.verifyAndConsume({
            sessionKey: "s1",
            operation: "exec",
            target: "bash -lc 'echo hi'",
            confirmId: challenge.confirmId,
            confirmCode: "0000",
        });
        const attempt2 = manager.verifyAndConsume({
            sessionKey: "s1",
            operation: "exec",
            target: "bash -lc 'echo hi'",
            confirmId: challenge.confirmId,
            confirmCode: "0000",
        });
        const attempt3 = manager.verifyAndConsume({
            sessionKey: "s1",
            operation: "exec",
            target: "bash -lc 'echo hi'",
            confirmId: challenge.confirmId,
            confirmCode: "0000",
        });

        expect(attempt1.kind).toBe("invalid_code");
        expect(attempt2.kind).toBe("invalid_code");
        expect(attempt3.kind).toBe("max_attempts_exceeded");
        manager.dispose();
    });

    it("enforces maxEntries with eviction", () => {
        const clock = createNow();
        const manager = new VineConfirmStateManager(
            { maxEntries: 2, ttlSeconds: 60 },
            { now: clock.now, randomIntFn: () => 1, codeLength: 4, cleanupIntervalMs: 3600_000 }
        );

        const c1 = manager.issueChallenge({
            sessionKey: "s1",
            operation: "exec",
            target: "cmd-1",
            riskWindowId: "rw-1",
        });
        clock.advance(10);
        manager.issueChallenge({
            sessionKey: "s1",
            operation: "exec",
            target: "cmd-2",
            riskWindowId: "rw-2",
        });
        clock.advance(10);
        manager.issueChallenge({
            sessionKey: "s1",
            operation: "exec",
            target: "cmd-3",
            riskWindowId: "rw-3",
        });

        expect(manager.size()).toBe(2);
        const oldest = manager.verifyAndConsume({
            sessionKey: "s1",
            operation: "exec",
            target: "cmd-1",
            confirmId: c1.confirmId,
            confirmCode: c1.confirmCode,
        });
        expect(oldest.kind).toBe("not_found");
        manager.dispose();
    });

    it("opens one_to_many window and consumes slots until exhaustion", () => {
        const clock = createNow();
        const manager = new VineConfirmStateManager(
            { maxEntries: 100, ttlSeconds: 60 },
            { strategy: "one_to_many", codeTtlSeconds: 90, maxAttempts: 3, windowSeconds: 60, maxActionsPerWindow: 3 },
            { now: clock.now, randomIntFn: () => 1111, codeLength: 4, cleanupIntervalMs: 3600_000 }
        );

        manager.openWindowAfterConfirmation({
            sessionKey: "s1",
            riskWindowId: "rw1",
            windowSeconds: 60,
            maxActionsPerWindow: 3,
        });

        const use1 = manager.consumeActiveWindowSlot({ sessionKey: "s1", riskWindowId: "rw1" });
        const use2 = manager.consumeActiveWindowSlot({ sessionKey: "s1", riskWindowId: "rw1" });
        const use3 = manager.consumeActiveWindowSlot({ sessionKey: "s1", riskWindowId: "rw1" });

        expect(use1).toBe(true);
        expect(use2).toBe(true);
        expect(use3).toBe(false);
        manager.dispose();
    });

    it("stores and consumes approval by intent in hybrid mode", () => {
        const clock = createNow();
        const manager = new VineConfirmStateManager(
            { maxEntries: 100, ttlSeconds: 60 },
            { now: clock.now, randomIntFn: () => 1234, codeLength: 4, cleanupIntervalMs: 3600_000 }
        );

        const approvedIntent = createVineIntentFromOperationTarget(
            "exec",
            "curl -L https://example.com"
        );
        const requestedIntent = createVineIntentFromOperationTarget(
            "exec",
            "curl -Ls https://example.com | grep domain"
        );

        const challenge = manager.issueChallenge({
            sessionKey: "s1",
            chatBindingKey: "chat-1",
            operation: "exec",
            target: "curl -L https://example.com",
            intent: approvedIntent,
            rawTarget: "curl -L https://example.com",
            riskWindowId: "rw1",
        });

        const approval = manager.approvePendingByChatBindingKeys({
            chatBindingKeys: ["chat-1"],
            confirmCode: challenge.confirmCode,
            senderId: "human-1",
        });

        const consumed = manager.consumeApprovedForBinding({
            sessionKey: "s1",
            operation: "exec",
            target: "curl -Ls https://example.com | grep domain",
            intent: requestedIntent,
            rawTarget: "curl -Ls https://example.com | grep domain",
            runId: "run-1",
        });

        expect(approval.kind).toBe("approved");
        expect(consumed.kind).toBe("allowed");
        expect(consumed.matchedByIntent).toBe(true);
        manager.dispose();
    });

    it("reuses the same pending challenge while the same risk window stays unresolved", () => {
        const clock = createNow();
        const manager = new VineConfirmStateManager(
            { maxEntries: 100, ttlSeconds: 60 },
            { now: clock.now, randomIntFn: () => 1234, codeLength: 4, cleanupIntervalMs: 3600_000 }
        );

        const first = manager.issueChallenge({
            sessionKey: "s1",
            chatBindingKey: "chat-1",
            operation: "write",
            target: "/tmp/vine-proof.txt",
            riskWindowId: "rw-shared",
        });
        const second = manager.issueChallenge({
            sessionKey: "s1",
            chatBindingKey: "chat-1",
            operation: "write",
            target: "/tmp/strawberry-meta.md",
            riskWindowId: "rw-shared",
        });

        expect(second.confirmId).toBe(first.confirmId);
        expect(second.confirmCode).toBe(first.confirmCode);
        manager.dispose();
    });

    it("does not consume approval by substring alone once intent matching is active", () => {
        const clock = createNow();
        const manager = new VineConfirmStateManager(
            { maxEntries: 100, ttlSeconds: 60 },
            { now: clock.now, randomIntFn: () => 1234, codeLength: 4, cleanupIntervalMs: 3600_000 }
        );

        const approvedIntent = createVineIntentFromOperationTarget(
            "exec",
            "curl -L https://example.com"
        );

        const challenge = manager.issueChallenge({
            sessionKey: "s1",
            chatBindingKey: "chat-1",
            operation: "exec",
            target: "curl -L https://example.com",
            intent: approvedIntent,
            rawTarget: "curl -L https://example.com",
            riskWindowId: "rw1",
        });

        manager.approvePendingByChatBindingKeys({
            chatBindingKeys: ["chat-1"],
            confirmCode: challenge.confirmCode,
            senderId: "human-1",
        });

        const consumed = manager.consumeApprovedForBinding({
            sessionKey: "s1",
            operation: "exec",
            target: "curl -L https://example.com && echo extra-step",
            runId: "run-1",
        });

        expect(consumed.kind).toBe("not_found");
        manager.dispose();
    });
});
