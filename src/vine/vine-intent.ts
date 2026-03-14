import { createHash } from "node:crypto";

export type VineIntentCapability =
    | "external_read"
    | "local_transform"
    | "local_write"
    | "sensitive_write"
    | "external_send"
    | "destructive_exec";

export type VineIntentParserConfidence = "high" | "low" | "unknown";
export type VineIntentTargetSensitivity = "none" | "sensitive" | "unknown";

export interface VineIntentExternalSource {
    scheme?: string;
    host?: string;
    port?: string;
    normalizedUrl?: string;
    parserConfidence: VineIntentParserConfidence;
}

export interface VineIntentLocalEffect {
    writesLocal: boolean;
    targetPath?: string;
    targetSensitivity: VineIntentTargetSensitivity;
}

export interface VineIntent {
    kind: string;
    externalSource?: VineIntentExternalSource;
    capabilities: VineIntentCapability[];
    localEffect: VineIntentLocalEffect;
    rawTarget: string;
}

type VineIntentSignatureShape = {
    kind: string;
    externalSource?: VineIntentExternalSource;
    capabilities: VineIntentCapability[];
    localEffect: VineIntentLocalEffect;
};

function sortCapabilities(capabilities: VineIntentCapability[]): VineIntentCapability[] {
    return [...new Set(capabilities)].sort();
}

function normalizeExternalSource(
    source: VineIntentExternalSource | undefined
): VineIntentExternalSource | undefined {
    if (!source) {
        return undefined;
    }

    return {
        scheme: source.scheme,
        host: source.host,
        port: source.port,
        normalizedUrl: source.normalizedUrl,
        parserConfidence: source.parserConfidence,
    };
}

function normalizeLocalEffect(localEffect: VineIntentLocalEffect): VineIntentLocalEffect {
    const shouldKeepTargetPath = localEffect.targetSensitivity !== "none";
    return {
        writesLocal: localEffect.writesLocal,
        targetPath: shouldKeepTargetPath ? localEffect.targetPath : undefined,
        targetSensitivity: localEffect.targetSensitivity,
    };
}

function toSignatureShape(intent: VineIntent): VineIntentSignatureShape {
    return {
        kind: intent.kind,
        externalSource: normalizeExternalSource(intent.externalSource),
        capabilities: sortCapabilities(intent.capabilities),
        localEffect: normalizeLocalEffect(intent.localEffect),
    };
}

function hasCapability(intent: VineIntent, capability: VineIntentCapability): boolean {
    return intent.capabilities.includes(capability);
}

function isSameExternalSource(approved: VineIntent, requested: VineIntent): boolean {
    const approvedSource = approved.externalSource;
    const requestedSource = requested.externalSource;
    if (!approvedSource || !requestedSource) {
        return false;
    }
    if (approvedSource.parserConfidence !== "high" || requestedSource.parserConfidence !== "high") {
        return false;
    }
    return approvedSource.normalizedUrl === requestedSource.normalizedUrl;
}

function introducesMaterialCapability(approved: VineIntent, requested: VineIntent): boolean {
    const materialCapabilities: VineIntentCapability[] = [
        "external_send",
        "destructive_exec",
        "sensitive_write",
    ];

    return materialCapabilities.some((capability) => (
        hasCapability(requested, capability) && !hasCapability(approved, capability)
    ));
}

export function createIntentKind(capabilities: VineIntentCapability[]): string {
    const normalizedCapabilities = sortCapabilities(capabilities);
    if (normalizedCapabilities.length === 0) {
        return "local_noop";
    }
    return normalizedCapabilities.join("+");
}

export function createIntentSignature(intent: VineIntent): string {
    return createHash("sha256")
        .update(JSON.stringify(toSignatureShape(intent)))
        .digest("hex");
}

export function isEquivalentApprovedIntent(approved: VineIntent, requested: VineIntent): boolean {
    if (createIntentSignature(approved) === createIntentSignature(requested)) {
        return true;
    }

    if (!hasCapability(approved, "external_read") || !hasCapability(requested, "external_read")) {
        return false;
    }
    if (!isSameExternalSource(approved, requested)) {
        return false;
    }
    if (introducesMaterialCapability(approved, requested)) {
        return false;
    }

    if (requested.localEffect.targetSensitivity !== "none") {
        return approved.localEffect.targetSensitivity === requested.localEffect.targetSensitivity
            && approved.localEffect.targetPath === requested.localEffect.targetPath;
    }

    return approved.localEffect.targetSensitivity !== "sensitive";
}
