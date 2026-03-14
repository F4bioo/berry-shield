import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createBerryShieldDefaultConfig } from "../src/config/catalog";
import { DEFAULT_CONFIG } from "../src/config/defaults";
import {
    berryShieldConfigSchema,
    berryShieldUiHints,
    createBerryShieldPluginManifest,
    listBerryShieldConfigPaths,
    serializeBerryShieldPluginManifest,
    type BerryShieldJsonSchemaNode,
    type BerryShieldPluginManifestShape,
} from "../src/config/schema";

function readPublishedManifest(): BerryShieldPluginManifestShape {
    const manifestPath = resolve(process.cwd(), "openclaw.plugin.json");
    return JSON.parse(readFileSync(manifestPath, "utf8")) as BerryShieldPluginManifestShape;
}

function listSchemaLeafPaths(node: BerryShieldJsonSchemaNode, prefix = "", sink: string[] = []): string[] {
    if (node.type === "object" && node.properties) {
        for (const [key, value] of Object.entries(node.properties)) {
            const nextPath = prefix ? `${prefix}.${key}` : key;
            listSchemaLeafPaths(value, nextPath, sink);
        }
        return sink;
    }

    if (prefix) {
        sink.push(prefix);
    }

    return sink;
}

function schemaPathExists(node: BerryShieldJsonSchemaNode, path: string): boolean {
    const parts = path.split(".");
    let current: BerryShieldJsonSchemaNode | undefined = node;

    for (const part of parts) {
        const isArraySegment = part.endsWith("[]");
        const key = isArraySegment ? part.slice(0, -2) : part;

        if (!current?.properties) {
            return false;
        }

        current = current.properties[key];
        if (!current) {
            return false;
        }

        if (isArraySegment) {
            if (current.type !== "array" || !current.items) {
                return false;
            }
            current = current.items;
        }
    }

    return Boolean(current);
}

const EXPECTED_PUBLISHED_PATHS = [
    "mode",
    "layers.root",
    "layers.pulp",
    "layers.thorn",
    "layers.leaf",
    "layers.stem",
    "layers.vine",
    "policy.profile",
    "policy.adaptive.staleAfterMinutes",
    "policy.adaptive.escalationTurns",
    "policy.adaptive.heartbeatEveryTurns",
    "policy.adaptive.allowGlobalEscalation",
    "policy.retention.maxEntries",
    "policy.retention.ttlSeconds",
    "vine.mode",
    "vine.retention.maxEntries",
    "vine.retention.ttlSeconds",
    "vine.thresholds.externalSignalsToEscalate",
    "vine.thresholds.forcedGuardTurns",
    "vine.toolAllowlist",
    "vine.confirmation.strategy",
    "vine.confirmation.codeTtlSeconds",
    "vine.confirmation.maxAttempts",
    "vine.confirmation.windowSeconds",
    "vine.confirmation.maxActionsPerWindow",
    "customRules.secrets",
    "customRules.sensitiveFiles",
    "customRules.destructiveCommands",
].sort();

const EXPECTED_UI_HINT_PATHS = [
    "customRules.secrets[].name",
    "customRules.secrets[].pattern",
    "customRules.secrets[].placeholder",
    "customRules.secrets[].enabled",
].sort();

describe("plugin manifest schema contract", () => {
    it("derives runtime defaults from the central config catalog", () => {
        expect(DEFAULT_CONFIG).toEqual(createBerryShieldDefaultConfig());
    });

    it("keeps published schema paths aligned with the catalog", () => {
        expect(listBerryShieldConfigPaths().sort()).toEqual(EXPECTED_PUBLISHED_PATHS);
        expect(listSchemaLeafPaths(berryShieldConfigSchema).sort()).toEqual(EXPECTED_PUBLISHED_PATHS);
    });

    it("keeps uiHints pointing only to published schema nodes", () => {
        expect(Object.keys(berryShieldUiHints).sort()).toEqual(EXPECTED_UI_HINT_PATHS);
        for (const path of Object.keys(berryShieldUiHints)) {
            expect(schemaPathExists(berryShieldConfigSchema, path)).toBe(true);
        }
    });

    it("publishes the same configSchema exported by TypeScript", () => {
        const manifest = readPublishedManifest();

        expect(manifest.configSchema).toEqual(berryShieldConfigSchema);
    });

    it("publishes the same uiHints exported by TypeScript", () => {
        const manifest = readPublishedManifest();

        expect(manifest.uiHints).toEqual(berryShieldUiHints);
    });

    it("replaces stale generated sections while preserving stable metadata", () => {
        const manifest = readPublishedManifest();
        const staleManifest: BerryShieldPluginManifestShape = {
            ...manifest,
            configSchema: { type: "object" },
            uiHints: {},
        };

        const syncedManifest = createBerryShieldPluginManifest(staleManifest);

        expect(syncedManifest.id).toBe(manifest.id);
        expect(syncedManifest.name).toBe(manifest.name);
        expect(syncedManifest.description).toBe(manifest.description);
        expect(syncedManifest.version).toBe(manifest.version);
        expect(syncedManifest.configSchema).toEqual(berryShieldConfigSchema);
        expect(syncedManifest.uiHints).toEqual(berryShieldUiHints);
    });

    it("serializes manifest sync idempotently", () => {
        const manifest = readPublishedManifest();

        const firstPass = serializeBerryShieldPluginManifest(manifest);
        const secondPass = serializeBerryShieldPluginManifest(
            JSON.parse(firstPass) as BerryShieldPluginManifestShape
        );

        expect(secondPass).toBe(firstPass);
    });

    it("keeps Vine confirmation defaults aligned between runtime and published schema", () => {
        const vineSchema = berryShieldConfigSchema.properties?.vine;
        const confirmationSchema = vineSchema?.properties?.confirmation;
        const confirmationProperties = confirmationSchema?.properties;

        expect(confirmationProperties?.strategy?.default).toBe(DEFAULT_CONFIG.vine.confirmation.strategy);
        expect(confirmationProperties?.codeTtlSeconds?.default).toBe(DEFAULT_CONFIG.vine.confirmation.codeTtlSeconds);
        expect(confirmationProperties?.maxAttempts?.default).toBe(DEFAULT_CONFIG.vine.confirmation.maxAttempts);
        expect(confirmationProperties?.windowSeconds?.default).toBe(DEFAULT_CONFIG.vine.confirmation.windowSeconds);
        expect(confirmationProperties?.maxActionsPerWindow?.default).toBe(DEFAULT_CONFIG.vine.confirmation.maxActionsPerWindow);
    });
});
