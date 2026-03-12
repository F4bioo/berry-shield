import type { BerryShieldVineRetentionConfig } from "../types/config.js";

export interface VineSessionResolutionInput {
    sessionKey?: string;
    sessionId?: string;
    conversationId?: string;
}

export interface VineChatBinding {
    chatBindingKey: string;
    sessionKey?: string;
    channelId?: string;
    accountId?: string;
    conversationId?: string;
    messageThreadId?: string;
    from?: string;
    to?: string;
}

export interface VineChatResolutionInput {
    channelId?: string;
    accountId?: string;
    conversationId?: string;
    messageThreadId?: string | number;
    from?: string;
    to?: string;
}

interface VineSessionBindingState extends VineChatBinding {
    sessionKey: string;
    sessionId?: string;
    lastSeenAt: number;
}

const SESSION_PROMOTION_TTL_MS = 30_000;

function normalizeOptionalString(value: string | undefined): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeOptionalThreadId(value: string | number | undefined): string | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
        return String(Math.trunc(value));
    }
    if (typeof value === "string") {
        return normalizeOptionalString(value);
    }
    return undefined;
}

export function buildChatBindingKey(input: {
    channelId?: string;
    accountId?: string;
    conversationId?: string;
    messageThreadId?: string | number;
    from?: string;
    to?: string;
}): string {
    const channelId = normalizeOptionalString(input.channelId) ?? "unknown";
    const accountId = normalizeOptionalString(input.accountId) ?? "_";
    const conversationId = normalizeOptionalString(input.conversationId);
    const messageThreadId = normalizeOptionalThreadId(input.messageThreadId) ?? "_";

    if (conversationId) {
        return `channel:${channelId}|account:${accountId}|conversation:${conversationId}|thread:${messageThreadId}`;
    }

    const from = normalizeOptionalString(input.from) ?? "_";
    const to = normalizeOptionalString(input.to) ?? "_";
    return `channel:${channelId}|account:${accountId}|from:${from}|to:${to}|thread:${messageThreadId}`;
}

export class VineSessionBindingManager {
    private readonly sessionIdToSessionKey = new Map<string, string>();
    private readonly conversationIdToSessionKey = new Map<string, string>();
    private readonly bindings = new Map<string, VineSessionBindingState>();
    private readonly maxEntries: number;
    private readonly ttlMs: number;
    private readonly now: () => number;

    constructor(retention: BerryShieldVineRetentionConfig, now: () => number = Date.now) {
        this.maxEntries = Math.max(1, Math.floor(retention.maxEntries));
        this.ttlMs = Math.max(1, Math.floor(retention.ttlSeconds * 1000));
        this.now = now;
    }

    public resolveSessionKey(input: VineSessionResolutionInput): string {
        if (input.sessionKey) {
            return input.sessionKey;
        }
        if (input.sessionId) {
            const resolved = this.sessionIdToSessionKey.get(input.sessionId);
            if (resolved) {
                return resolved;
            }
        }
        if (input.conversationId) {
            const resolved = this.conversationIdToSessionKey.get(input.conversationId);
            if (resolved) {
                return resolved;
            }
            return input.conversationId;
        }
        return "global_session";
    }

    public resolveSessionKeyByChatBinding(input: VineChatResolutionInput): string | null {
        this.prune();
        const conversationId = normalizeOptionalString(input.conversationId);
        if (conversationId) {
            return this.conversationIdToSessionKey.get(conversationId) ?? null;
        }

        const channelId = normalizeOptionalString(input.channelId);
        if (!channelId) {
            return null;
        }

        const accountId = normalizeOptionalString(input.accountId);
        const messageThreadId = normalizeOptionalThreadId(input.messageThreadId);
        const from = normalizeOptionalString(input.from);
        const to = normalizeOptionalString(input.to);
        const candidates = [...this.bindings.values()].filter((binding) => {
            if (binding.channelId !== channelId) {
                return false;
            }
            if (accountId && binding.accountId && binding.accountId !== accountId) {
                return false;
            }
            if (messageThreadId && binding.messageThreadId && binding.messageThreadId !== messageThreadId) {
                return false;
            }
            if (from && binding.from && binding.from !== from) {
                return false;
            }
            if (to && binding.to && binding.to !== to) {
                return false;
            }
            return true;
        });

        if (candidates.length !== 1) {
            return null;
        }

        candidates[0].lastSeenAt = this.now();
        return candidates[0].sessionKey;
    }

    public bindKnownSession(
        input: VineSessionResolutionInput & {
            channelId?: string;
            accountId?: string;
            messageThreadId?: string | number;
            from?: string;
            to?: string;
        },
        sessionKey: string
    ): VineSessionBindingState | null {
        this.prune();
        if (!sessionKey || sessionKey === "global_session") {
            return null;
        }

        const nowTs = this.now();
        const promotedBinding = this.findPromotableBinding(input, sessionKey, nowTs);
        if (input.sessionId) {
            this.sessionIdToSessionKey.set(input.sessionId, sessionKey);
        }
        if (input.conversationId) {
            this.conversationIdToSessionKey.set(input.conversationId, sessionKey);
        } else if (promotedBinding?.conversationId) {
            this.conversationIdToSessionKey.set(promotedBinding.conversationId, sessionKey);
        }

        const previous = this.bindings.get(sessionKey);
        const next: VineSessionBindingState = {
            sessionKey,
            sessionId: input.sessionId ?? previous?.sessionId,
            channelId: normalizeOptionalString(input.channelId) ?? previous?.channelId ?? promotedBinding?.channelId,
            accountId: normalizeOptionalString(input.accountId) ?? previous?.accountId ?? promotedBinding?.accountId,
            conversationId: normalizeOptionalString(input.conversationId) ?? previous?.conversationId ?? promotedBinding?.conversationId,
            messageThreadId: normalizeOptionalThreadId(input.messageThreadId) ?? previous?.messageThreadId ?? promotedBinding?.messageThreadId,
            from: normalizeOptionalString(input.from) ?? previous?.from ?? promotedBinding?.from,
            to: normalizeOptionalString(input.to) ?? previous?.to ?? promotedBinding?.to,
            chatBindingKey: "",
            lastSeenAt: nowTs,
        };

        next.chatBindingKey = buildChatBindingKey(next);
        this.bindings.set(sessionKey, next);
        return next;
    }

    public getBindingForSession(sessionKey: string): VineSessionBindingState | null {
        this.prune();
        const binding = this.bindings.get(sessionKey);
        if (!binding) {
            return null;
        }
        binding.lastSeenAt = this.now();
        return { ...binding };
    }

    public cleanupSession(sessionId: string, resolvedSessionKey?: string): void {
        this.sessionIdToSessionKey.delete(sessionId);
        const targetSessionKey = resolvedSessionKey ?? sessionId;
        this.bindings.delete(targetSessionKey);

        for (const [conversationId, mappedSessionKey] of this.conversationIdToSessionKey.entries()) {
            if (mappedSessionKey === targetSessionKey) {
                this.conversationIdToSessionKey.delete(conversationId);
            }
        }
    }

    public prune(): void {
        const nowTs = this.now();
        for (const [sessionKey, binding] of this.bindings.entries()) {
            if ((nowTs - binding.lastSeenAt) > this.ttlMs) {
                this.bindings.delete(sessionKey);
            }
        }

        for (const [sessionId, sessionKey] of this.sessionIdToSessionKey.entries()) {
            if (!this.bindings.has(sessionKey)) {
                this.sessionIdToSessionKey.delete(sessionId);
            }
        }

        for (const [conversationId, sessionKey] of this.conversationIdToSessionKey.entries()) {
            if (!this.bindings.has(sessionKey)) {
                this.conversationIdToSessionKey.delete(conversationId);
            }
        }

        if (this.bindings.size <= this.maxEntries) {
            return;
        }

        const overflow = this.bindings.size - this.maxEntries;
        const oldest = [...this.bindings.entries()]
            .sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt)
            .slice(0, overflow);
        for (const [sessionKey] of oldest) {
            this.bindings.delete(sessionKey);
        }

        for (const [sessionId, sessionKey] of this.sessionIdToSessionKey.entries()) {
            if (!this.bindings.has(sessionKey)) {
                this.sessionIdToSessionKey.delete(sessionId);
            }
        }

        for (const [conversationId, sessionKey] of this.conversationIdToSessionKey.entries()) {
            if (!this.bindings.has(sessionKey)) {
                this.conversationIdToSessionKey.delete(conversationId);
            }
        }
    }

    private findPromotableBinding(
        input: VineSessionResolutionInput & {
            channelId?: string;
            accountId?: string;
            messageThreadId?: string | number;
            from?: string;
            to?: string;
        },
        sessionKey: string,
        nowTs: number
    ): VineSessionBindingState | null {
        const explicitConversationId = normalizeOptionalString(input.conversationId);
        if (explicitConversationId) {
            return null;
        }

        const currentBinding = this.bindings.get(sessionKey);
        if (currentBinding?.conversationId) {
            return null;
        }

        const channelId = normalizeOptionalString(input.channelId);
        const accountId = normalizeOptionalString(input.accountId);
        const messageThreadId = normalizeOptionalThreadId(input.messageThreadId);
        const from = normalizeOptionalString(input.from);
        const to = normalizeOptionalString(input.to);

        const candidates = [...this.bindings.values()].filter((binding) => {
            if (binding.sessionKey === sessionKey) {
                return false;
            }
            if (!binding.conversationId) {
                return false;
            }
            if ((nowTs - binding.lastSeenAt) > SESSION_PROMOTION_TTL_MS) {
                return false;
            }
            if (channelId && binding.channelId && binding.channelId !== channelId) {
                return false;
            }
            if (accountId && binding.accountId && binding.accountId !== accountId) {
                return false;
            }
            if (messageThreadId && binding.messageThreadId && binding.messageThreadId !== messageThreadId) {
                return false;
            }
            if (from && binding.from && binding.from !== from) {
                return false;
            }
            if (to && binding.to && binding.to !== to) {
                return false;
            }
            return true;
        });

        if (candidates.length !== 1) {
            return null;
        }

        return candidates[0];
    }
}

let sharedVineSessionBindingManager: VineSessionBindingManager | null = null;
let sharedBindingSignature = "";

export function getSharedVineSessionBindingManager(retention: BerryShieldVineRetentionConfig): VineSessionBindingManager {
    const signature = `${retention.maxEntries}:${retention.ttlSeconds}`;
    if (!sharedVineSessionBindingManager || sharedBindingSignature !== signature) {
        sharedVineSessionBindingManager = new VineSessionBindingManager(retention);
        sharedBindingSignature = signature;
    }
    return sharedVineSessionBindingManager;
}

export function resetSharedVineSessionBindingManagerForTests(): void {
    sharedVineSessionBindingManager = null;
    sharedBindingSignature = "";
}
