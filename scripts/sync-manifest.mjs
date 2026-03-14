import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const PLUGIN_MANIFEST_PATH = path.resolve(process.cwd(), "openclaw.plugin.json");
const SCHEMA_ENTRYPOINT = path.resolve(process.cwd(), "src/config/schema.ts");
const COLOR = {
    LOBSTER: "\x1b[38;2;255;90;45m",
    GRAY: "\x1b[90m",
    GREEN: "\x1b[32m",
    YELLOW: "\x1b[33m",
    RED: "\x1b[31m",
    RESET: "\x1b[0m",
};

const SYMBOL = {
    BERRY: "🍓",
    SUCCESS: "✅",
    WARN: "⚠️",
    FAIL: "❌",
    MARKER: "↳",
};

function printHeader() {
    console.log(`${COLOR.LOBSTER}${SYMBOL.BERRY} Berry Shield: Manifest Sync${COLOR.RESET}`);
    console.log(`${COLOR.GRAY}Philosophy: one schema, one manifest, no manual drift.${COLOR.RESET}`);
    console.log("");
}

function printDetail(message) {
    console.log(`${SYMBOL.MARKER} ${message}`);
}

function printSuccess(message) {
    console.log(`${COLOR.GREEN}${SYMBOL.SUCCESS} ${message}${COLOR.RESET}`);
}

function printWarning(message) {
    console.log(`${COLOR.YELLOW}${SYMBOL.WARN} ${message}${COLOR.RESET}`);
}

function printFailure(message) {
    console.error(`${COLOR.RED}${SYMBOL.FAIL} ${message}${COLOR.RESET}`);
}

function readPluginManifest(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Plugin manifest not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, "utf8");
    const manifest = JSON.parse(content);

    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
        throw new Error("Plugin manifest must be a JSON object.");
    }

    if (
        typeof manifest.id !== "string"
        || typeof manifest.name !== "string"
        || typeof manifest.description !== "string"
        || typeof manifest.version !== "string"
    ) {
        throw new Error("Plugin manifest is missing required stable metadata.");
    }

    return manifest;
}

function writePluginManifestIfChanged(filePath, content) {
    const current = fs.readFileSync(filePath, "utf8");
    if (current === content) {
        return false;
    }

    fs.writeFileSync(filePath, content, "utf8");
    return true;
}

async function loadSchemaModule() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "berry-shield-manifest-"));
    const bundledModulePath = path.join(tempDir, "schema.mjs");

    try {
        await build({
            entryPoints: [SCHEMA_ENTRYPOINT],
            outfile: bundledModulePath,
            bundle: true,
            platform: "node",
            format: "esm",
            target: "node20",
            logLevel: "silent",
        });

        return await import(pathToFileURL(bundledModulePath).href);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

async function main() {
    printHeader();
    const manifest = readPluginManifest(PLUGIN_MANIFEST_PATH);
    printDetail(`Loaded manifest: ${path.basename(PLUGIN_MANIFEST_PATH)}`);
    const schemaModule = await loadSchemaModule();
    printDetail(`Loaded schema entrypoint: ${path.relative(process.cwd(), SCHEMA_ENTRYPOINT)}`);

    if (typeof schemaModule.serializeBerryShieldPluginManifest !== "function") {
        throw new Error("Schema module does not export serializeBerryShieldPluginManifest.");
    }

    const nextContent = schemaModule.serializeBerryShieldPluginManifest(manifest);
    const changed = writePluginManifestIfChanged(PLUGIN_MANIFEST_PATH, nextContent);

    if (changed) {
        printSuccess("Manifest synchronized from TypeScript schema.");
        printDetail("Updated openclaw.plugin.json");
        return;
    }

    printWarning("Manifest already in sync.");
    printDetail("No file changes were required");
}

try {
    await main();
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    printFailure(`Failed to synchronize plugin manifest: ${message}`);
    process.exitCode = 1;
}
