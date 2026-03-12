import { describe, expect, it } from "vitest";
import { VineSessionBindingManager, buildChatBindingKey } from "../src/vine/session-binding";

describe("VineSessionBindingManager", () => {
    it("builds a stable direct-chat binding key when no conversation id is available", () => {
        const manager = new VineSessionBindingManager({ maxEntries: 100, ttlSeconds: 60 });

        const binding = manager.bindKnownSession({
            sessionKey: "s1",
            channelId: "webchat",
            accountId: "default",
            from: "u1",
            to: "bot",
        }, "s1");

        expect(binding?.chatBindingKey).toBe(buildChatBindingKey({
            channelId: "webchat",
            accountId: "default",
            from: "u1",
            to: "bot",
        }));
    });

    it("resolves a unique session from sparse chat metadata when conversationId is unavailable", () => {
        const manager = new VineSessionBindingManager({ maxEntries: 100, ttlSeconds: 60 });

        manager.bindKnownSession({
            sessionKey: "agent:main:main",
            channelId: "webchat",
            accountId: "default",
        }, "agent:main:main");

        expect(manager.resolveSessionKeyByChatBinding({
            channelId: "webchat",
        })).toBe("agent:main:main");
    });

    it("keeps sparse chat resolution ambiguous when more than one session could match", () => {
        const manager = new VineSessionBindingManager({ maxEntries: 100, ttlSeconds: 60 });

        manager.bindKnownSession({
            sessionKey: "agent:main:main",
            channelId: "webchat",
            accountId: "default",
        }, "agent:main:main");
        manager.bindKnownSession({
            sessionKey: "agent:other:main",
            channelId: "webchat",
            accountId: "secondary",
        }, "agent:other:main");

        expect(manager.resolveSessionKeyByChatBinding({
            channelId: "webchat",
        })).toBeNull();
    });
});
