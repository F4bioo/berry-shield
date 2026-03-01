import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { calculateNextVersion } from './version-utils.ts';

const PACKAGE_JSON_PATH = path.resolve(process.cwd(), 'package.json');
const CONSTANTS_PATH = path.resolve(process.cwd(), 'src/constants.ts');

function main() {
    console.log("🍓 [Berry Shield] CalVer Release Process Initiated");

    // 1. Read current version
    if (!fs.existsSync(PACKAGE_JSON_PATH)) {
        console.error("❌ package.json not found");
        process.exit(1);
    }
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
    const currentVersion = packageJson.version;

    // 2. Calculate next version
    const nextVersion = calculateNextVersion(currentVersion);
    console.log(`📅 Current Version: ${currentVersion}`);
    console.log(`🚀 Target Version:  ${nextVersion}`);

    if (currentVersion === nextVersion) {
        console.log("ℹ️  Version already up to date. Skipping update.");
        return;
    }

    // 3. Update package.json and package-lock.json via npm version
    try {
        // --no-git-tag-version: Don't create git tag/commit
        // --allow-same-version: Prevent error if versions match (handled above, but safety net)
        execSync(`npm version ${nextVersion} --no-git-tag-version --allow-same-version`, { stdio: 'inherit' });
    } catch (e) {
        console.error("❌ Failed to run npm version:", e);
        process.exit(1);
    }

    // 4. Update src/constants.ts
    if (fs.existsSync(CONSTANTS_PATH)) {
        let constantsContent = fs.readFileSync(CONSTANTS_PATH, 'utf-8');
        // Regex to find 'export const VERSION = "..."' or 'VERSION = '...''
        const versionRegex = /(VERSION\s*=\s*)(['"])(.*?)\2/;

        if (!versionRegex.test(constantsContent)) {
            console.warn("⚠️  Could not find 'VERSION' property in src/constants.ts. Manual update may be required.");
        } else {
            constantsContent = constantsContent.replace(versionRegex, `$1$2${nextVersion}$2`);
            fs.writeFileSync(CONSTANTS_PATH, constantsContent, 'utf-8');
            console.log(`✅ Updated src/constants.ts`);
        }
    } else {
        console.warn("⚠️  src/constants.ts not found. Skipping code version update.");
    }

    // 5. Update openclaw.plugin.json
    const PLUGIN_JSON_PATH = path.resolve(process.cwd(), 'openclaw.plugin.json');
    if (fs.existsSync(PLUGIN_JSON_PATH)) {
        try {
            const pluginJson = JSON.parse(fs.readFileSync(PLUGIN_JSON_PATH, 'utf-8'));
            pluginJson.version = nextVersion;
            fs.writeFileSync(PLUGIN_JSON_PATH, JSON.stringify(pluginJson, null, 4), 'utf-8');
            console.log(`✅ Updated openclaw.plugin.json`);
        } catch (e) {
            console.warn("⚠️  Failed to update openclaw.plugin.json:", e);
        }
    } else {
        console.warn("ℹ️  openclaw.plugin.json not found. Skipping.");
    }

    console.log("✨ Version update complete!");
}

main();
