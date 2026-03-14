import {
    PLUGIN_MODE,
    POLICY_PROFILE,
    VINE_CONFIRMATION_STRATEGY,
    VINE_MODE,
} from "../constants.js";
import type {
    BerryShieldCustomCommandRule,
    BerryShieldCustomFileRule,
    BerryShieldCustomRulesConfig,
    BerryShieldCustomSecretRule,
    BerryShieldLayersConfig,
    BerryShieldPluginConfig,
    BerryShieldPolicyAdaptiveConfig,
    BerryShieldPolicyConfig,
    BerryShieldPolicyRetentionConfig,
    BerryShieldVineConfig,
    BerryShieldVineConfirmationConfig,
    BerryShieldVineRetentionConfig,
    BerryShieldVineThresholdsConfig,
} from "../types/config.js";

type JsonSchemaType = "array" | "boolean" | "integer" | "object" | "string";

export interface BerryShieldJsonSchemaNode {
    type: JsonSchemaType;
    additionalProperties?: boolean;
    properties?: Record<string, BerryShieldJsonSchemaNode>;
    items?: BerryShieldJsonSchemaNode;
    enum?: readonly string[];
    default?: unknown;
    description?: string;
    minimum?: number;
    required?: readonly string[];
}

export interface BerryShieldUiHint {
    label?: string;
    placeholder?: string;
    sensitive?: boolean;
    help?: string;
    advanced?: boolean;
}

export type BerryShieldUiHints = Record<string, BerryShieldUiHint>;

export interface BerryShieldPluginManifestShape extends Record<string, unknown> {
    id: string;
    name: string;
    description: string;
    version: string;
    configSchema?: unknown;
    uiHints?: unknown;
}

type RelativeUiHints = Record<string, BerryShieldUiHint>;

interface CatalogNodeBase {
    description?: string;
    published?: boolean;
}

interface CatalogBooleanField extends CatalogNodeBase {
    kind: "boolean";
    default: boolean;
}

interface CatalogIntegerField extends CatalogNodeBase {
    kind: "integer";
    default: number;
    minimum?: number;
}

interface CatalogEnumField<T extends string> extends CatalogNodeBase {
    kind: "enum";
    values: readonly T[];
    default: T;
}

interface CatalogStringArrayField extends CatalogNodeBase {
    kind: "string-array";
    default: string[];
}

interface CatalogObjectArrayField<TItem extends object> extends CatalogNodeBase {
    kind: "object-array";
    default: TItem[];
    itemSchema: BerryShieldJsonSchemaNode;
    uiHints?: RelativeUiHints;
}

interface CatalogGroupNode<TChildren extends object> extends CatalogNodeBase {
    kind: "group";
    children: { [K in keyof TChildren]: CatalogNode<TChildren[K]> };
    schemaDefault?: "derived";
}

type CatalogNode<T> =
    [T] extends [boolean] ? CatalogBooleanField
    : [T] extends [number] ? CatalogIntegerField
    : [T] extends [string[]] ? CatalogStringArrayField
    : [T] extends [Array<infer TItem>] ? CatalogObjectArrayField<Extract<TItem, object>>
    : [T] extends [string] ? CatalogEnumField<Extract<T, string>>
    : [T] extends [object] ? CatalogGroupNode<Extract<T, object>>
    : never;

type CatalogRuntimeNode =
    | CatalogBooleanField
    | CatalogIntegerField
    | CatalogEnumField<string>
    | CatalogStringArrayField
    | CatalogObjectArrayField<object>
    | CatalogGroupNode<object>;

function defineBooleanField(config: Omit<CatalogBooleanField, "kind">): CatalogBooleanField {
    return { kind: "boolean", ...config };
}

function defineIntegerField(config: Omit<CatalogIntegerField, "kind">): CatalogIntegerField {
    return { kind: "integer", ...config };
}

function defineEnumField<T extends string>(config: Omit<CatalogEnumField<T>, "kind">): CatalogEnumField<T> {
    return { kind: "enum", ...config };
}

function defineStringArrayField(config: Omit<CatalogStringArrayField, "kind">): CatalogStringArrayField {
    return { kind: "string-array", ...config };
}

function defineObjectArrayField<TItem extends object>(
    config: Omit<CatalogObjectArrayField<TItem>, "kind">
): CatalogObjectArrayField<TItem> {
    return { kind: "object-array", ...config };
}

function defineGroup<TChildren extends object>(
    config: Omit<CatalogGroupNode<TChildren>, "kind">
): CatalogGroupNode<TChildren> {
    return { kind: "group", ...config };
}

function typedKeys<T extends object>(value: T): Array<keyof T> {
    return Object.keys(value) as Array<keyof T>;
}

function cloneDefault<T>(value: T): T {
    return structuredClone(value);
}

function createStringSchema(description?: string): BerryShieldJsonSchemaNode {
    return description
        ? { type: "string", description }
        : { type: "string" };
}

function createNamedPatternItemSchema(includePlaceholder: boolean): BerryShieldJsonSchemaNode {
    const properties: Record<string, BerryShieldJsonSchemaNode> = {
        name: createStringSchema(),
        pattern: createStringSchema(),
    };

    if (includePlaceholder) {
        properties.placeholder = createStringSchema();
    }

    properties.enabled = {
        type: "boolean",
        default: true,
    };

    const required = includePlaceholder
        ? ["name", "pattern", "placeholder", "enabled"]
        : ["name", "pattern", "enabled"];

    return {
        type: "object",
        additionalProperties: false,
        properties,
        required,
    };
}

export const berryShieldConfigCatalog = defineGroup<BerryShieldPluginConfig>({
    children: {
        mode: defineEnumField({
            values: enumValues(PLUGIN_MODE),
            default: "enforce",
            description: "Enforce blocks/redacts, audit only logs",
        }),
        layers: defineGroup<BerryShieldLayersConfig>({
            children: {
                root: defineBooleanField({
                    default: true,
                    description: "Enable Berry.Root (prompt guard)",
                }),
                pulp: defineBooleanField({
                    default: true,
                    description: "Enable Berry.Pulp (output scanner)",
                }),
                thorn: defineBooleanField({
                    default: true,
                    description: "Enable Berry.Thorn (tool blocker)",
                }),
                leaf: defineBooleanField({
                    default: true,
                    description: "Enable Berry.Leaf (input audit)",
                }),
                stem: defineBooleanField({
                    default: true,
                    description: "Enable Berry.Stem (security gate)",
                }),
                vine: defineBooleanField({
                    default: true,
                    description: "Enable Berry.Vine (external content guard)",
                }),
            },
        }),
        policy: defineGroup<BerryShieldPolicyConfig>({
            description: "Root policy injection behavior and adaptive tuning",
            children: {
                profile: defineEnumField({
                    values: enumValues(POLICY_PROFILE),
                    default: "balanced",
                    description: "Injection profile: strict=always full, balanced=full then adaptive, minimal=silent unless triggered",
                }),
                adaptive: defineGroup<BerryShieldPolicyAdaptiveConfig>({
                    children: {
                        staleAfterMinutes: defineIntegerField({
                            default: 30,
                            description: "Session inactivity window (minutes) to treat a conversation as stale",
                        }),
                        escalationTurns: defineIntegerField({
                            default: 3,
                            description: "Number of turns to force full policy after a denied security event",
                        }),
                        heartbeatEveryTurns: defineIntegerField({
                            default: 0,
                            minimum: 0,
                            description: "Inject short reminder every N turns (0 disables heartbeat)",
                        }),
                        allowGlobalEscalation: defineBooleanField({
                            default: false,
                            description: "Allow escalation without session identity (not recommended for multi-session environments)",
                        }),
                    },
                }),
                retention: defineGroup<BerryShieldPolicyRetentionConfig>({
                    children: {
                        maxEntries: defineIntegerField({
                            default: 10000,
                            description: "Maximum adaptive session entries kept in memory",
                        }),
                        ttlSeconds: defineIntegerField({
                            default: 86400,
                            description: "Adaptive session state TTL in seconds",
                        }),
                    },
                }),
            },
        }),
        vine: defineGroup<BerryShieldVineConfig>({
            description: "External-content guardrail tuning for Berry.Vine",
            children: {
                mode: defineEnumField({
                    values: enumValues(VINE_MODE),
                    default: "balanced",
                    description: "balanced = conservative on unknown, strict = block sensitive actions on unknown/external risk",
                }),
                retention: defineGroup<BerryShieldVineRetentionConfig>({
                    children: {
                        maxEntries: defineIntegerField({
                            default: 10000,
                            description: "Maximum Vine session entries kept in memory",
                        }),
                        ttlSeconds: defineIntegerField({
                            default: 86400,
                            description: "Vine runtime state TTL in seconds",
                        }),
                    },
                }),
                thresholds: defineGroup<BerryShieldVineThresholdsConfig>({
                    children: {
                        externalSignalsToEscalate: defineIntegerField({
                            default: 1,
                            description: "Number of external signals required to mark session risk",
                        }),
                        forcedGuardTurns: defineIntegerField({
                            default: 3,
                            description: "Number of guarded turns after escalation",
                        }),
                    },
                }),
                toolAllowlist: defineStringArrayField({
                    default: [],
                    description: "Tool names exempt from Vine escalation",
                }),
                confirmation: defineGroup<BerryShieldVineConfirmationConfig>({
                    description: "Confirmation flow tuning for sensitive actions under Vine risk",
                    children: {
                        strategy: defineEnumField({
                            values: enumValues(VINE_CONFIRMATION_STRATEGY),
                            default: "one_to_many",
                            description: "Confirmation strategy: 1:1 = one code per action, 1:N = one code for multiple actions within a short window",
                        }),
                        codeTtlSeconds: defineIntegerField({
                            default: 180,
                            description: "Confirmation code time-to-live in seconds",
                        }),
                        maxAttempts: defineIntegerField({
                            default: 3,
                            description: "Maximum invalid code attempts per challenge",
                        }),
                        windowSeconds: defineIntegerField({
                            default: 120,
                            description: "Window lifetime in seconds when strategy is 1:N",
                        }),
                        maxActionsPerWindow: defineIntegerField({
                            default: 3,
                            description: "Maximum sensitive actions allowed during 1:N confirmation window",
                        }),
                    },
                }),
            },
        }),
        customRules: defineGroup<BerryShieldCustomRulesConfig>({
            description: "Custom rules synchronized across CLI and Web settings",
            schemaDefault: "derived",
            children: {
                secrets: defineObjectArrayField<BerryShieldCustomSecretRule>({
                    default: [],
                    description: "Custom secret redaction entries",
                    itemSchema: createNamedPatternItemSchema(true),
                    uiHints: {
                        "[].name": {
                            label: "Name",
                            sensitive: false,
                        },
                        "[].pattern": {
                            label: "Pattern",
                            sensitive: true,
                        },
                        "[].placeholder": {
                            label: "Placeholder",
                            sensitive: false,
                        },
                        "[].enabled": {
                            label: "Enabled",
                            sensitive: false,
                        },
                    },
                }),
                sensitiveFiles: defineObjectArrayField<BerryShieldCustomFileRule>({
                    default: [],
                    description: "Additional sensitive file path regex entries",
                    itemSchema: createNamedPatternItemSchema(false),
                }),
                destructiveCommands: defineObjectArrayField<BerryShieldCustomCommandRule>({
                    default: [],
                    description: "Additional destructive command regex entries",
                    itemSchema: createNamedPatternItemSchema(false),
                }),
            },
        }),
        sensitiveFilePaths: defineStringArrayField({
            default: [],
            description: "Additional file path patterns to treat as sensitive (regex strings)",
            published: false,
        }),
        destructiveCommands: defineStringArrayField({
            default: [],
            description: "Additional command patterns to treat as destructive (regex strings)",
            published: false,
        }),
    },
});

function buildDefaultValue(node: CatalogRuntimeNode): unknown {
    switch (node.kind) {
        case "boolean":
        case "integer":
        case "enum":
            return node.default;
        case "string-array":
        case "object-array":
            return cloneDefault(node.default);
        case "group": {
            const result: Record<string, unknown> = {};
            for (const key of typedKeys(node.children)) {
                const child = node.children[key];
                result[String(key)] = buildDefaultValue(child as CatalogRuntimeNode);
            }
            return result;
        }
    }
}

export function buildConfigDefaults<T>(node: CatalogNode<T>): T {
    return buildDefaultValue(node as CatalogRuntimeNode) as T;
}

function buildSchemaNode(node: CatalogRuntimeNode): BerryShieldJsonSchemaNode | null {
    if (node.published === false) {
        return null;
    }

    switch (node.kind) {
        case "boolean": {
            const schema: BerryShieldJsonSchemaNode = {
                type: "boolean",
                default: node.default,
            };
            if (node.description) {
                schema.description = node.description;
            }
            return schema;
        }
        case "integer":
            return {
                type: "integer",
                minimum: node.minimum ?? 1,
                default: node.default,
                description: node.description,
            };
        case "enum":
            return {
                type: "string",
                enum: node.values,
                default: node.default,
                description: node.description,
            };
        case "string-array":
            return node.description
                ? {
                    type: "array",
                    items: { type: "string" },
                    default: cloneDefault(node.default),
                    description: node.description,
                }
                : {
                    type: "array",
                    items: { type: "string" },
                    default: cloneDefault(node.default),
                };
        case "object-array":
            return node.description
                ? {
                    type: "array",
                    description: node.description,
                    items: node.itemSchema,
                    default: cloneDefault(node.default),
                }
                : {
                    type: "array",
                    items: node.itemSchema,
                    default: cloneDefault(node.default),
                };
        case "group": {
            const properties: Record<string, BerryShieldJsonSchemaNode> = {};
            for (const key of typedKeys(node.children)) {
                const child = node.children[key];
                const childSchema = buildSchemaNode(child as CatalogRuntimeNode);
                if (childSchema) {
                    properties[String(key)] = childSchema;
                }
            }

            const schema: BerryShieldJsonSchemaNode = node.description
                ? {
                    type: "object",
                    additionalProperties: false,
                    description: node.description,
                    properties,
                }
                : {
                    type: "object",
                    additionalProperties: false,
                    properties,
                };

            if (node.schemaDefault === "derived") {
                schema.default = buildConfigDefaults(node);
            }

            return schema;
        }
    }
}

function collectUiHints(node: CatalogRuntimeNode, path = "", sink: BerryShieldUiHints = {}): BerryShieldUiHints {
    if (node.published === false) {
        return sink;
    }

    switch (node.kind) {
        case "group":
            for (const key of typedKeys(node.children)) {
                const child = node.children[key];
                const nextPath = path ? `${path}.${String(key)}` : String(key);
                collectUiHints(child as CatalogRuntimeNode, nextPath, sink);
            }
            return sink;
        case "object-array":
            if (!node.uiHints) {
                return sink;
            }
            for (const relativePath of typedKeys(node.uiHints)) {
                const hint = node.uiHints[relativePath];
                sink[`${path}${relativePath}`] = hint;
            }
            return sink;
        default:
            return sink;
    }
}

function collectPublishedLeafPaths(node: CatalogRuntimeNode, path = "", sink: string[] = []): string[] {
    if (node.published === false) {
        return sink;
    }

    switch (node.kind) {
        case "group":
            for (const key of typedKeys(node.children)) {
                const child = node.children[key];
                const nextPath = path ? `${path}.${String(key)}` : String(key);
                collectPublishedLeafPaths(child as CatalogRuntimeNode, nextPath, sink);
            }
            return sink;
        default:
            if (path) {
                sink.push(path);
            }
            return sink;
    }
}

export function createBerryShieldDefaultConfig(): BerryShieldPluginConfig {
    return buildConfigDefaults(berryShieldConfigCatalog);
}

function buildRootSchema(node: CatalogGroupNode<object>): BerryShieldJsonSchemaNode {
    const schema = buildSchemaNode(node);
    if (!schema) {
        throw new Error("Config catalog root must always publish a schema.");
    }
    return schema;
}

export const berryShieldConfigSchema = buildRootSchema(berryShieldConfigCatalog);
export const berryShieldUiHints = collectUiHints(berryShieldConfigCatalog);

export function listBerryShieldConfigPaths(): string[] {
    return collectPublishedLeafPaths(berryShieldConfigCatalog);
}

export function createBerryShieldPluginManifest(
    manifest: BerryShieldPluginManifestShape
): BerryShieldPluginManifestShape {
    const { configSchema: _configSchema, uiHints: _uiHints, ...stableFields } = manifest;

    return {
        ...stableFields,
        configSchema: berryShieldConfigSchema,
        uiHints: berryShieldUiHints,
    };
}

export function serializeBerryShieldPluginManifest(
    manifest: BerryShieldPluginManifestShape
): string {
    return `${JSON.stringify(createBerryShieldPluginManifest(manifest), null, 4)}\n`;
}

export function enumValues<T extends Record<string, string>>(value: T): readonly T[keyof T][] {
    // Object.values preserves the runtime string literals, but TS widens the return type to string[] here.
    return Object.values(value) as unknown as readonly T[keyof T][];
}
