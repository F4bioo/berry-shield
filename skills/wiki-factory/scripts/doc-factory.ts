import { execSync } from "child_process";
import { join } from "path";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";

/**
 * Berry Shield Doc Factory
 * 
 * Uses a UNIFIED pass to preserve internal links and 
 * runs the Hype-Slayer linter for technical purity.
 */
async function main() {
    const baseOutputDir = "docs/wiki/reference";
    const cwd = process.cwd();

    // Clean start
    if (existsSync(baseOutputDir)) {
        rmSync(baseOutputDir, { recursive: true, force: true });
    }
    mkdirSync(baseOutputDir, { recursive: true });

    console.log("🚀 Starting Unified Technical Documentation Factory...");

    try {
        // We use a single pass targeting src/ for the full type graph
        const command = [
            "npx typedoc",
            "--entryPoints src/index.ts src/layers/*.ts src/utils/*.ts",
            `--out ${baseOutputDir}`,
            "--plugin typedoc-plugin-markdown",
            "--theme markdown",
            "--fileExtension .md",
            "--hideBreadcrumbs true",
            "--cleanOutputDir true",
            "--readme none",
            "--githubPages false"
        ].join(" ");

        execSync(command, { stdio: "inherit" });
        console.log("\n✅ Base technical documentation generated.");

        // Run Technical Integrity Audit
        console.log("\n⚖️  Running Technical Integrity Audit...");
        execSync("npx ts-node --esm skills/wiki-factory/scripts/doc-sanity.ts", { stdio: "inherit" });

        // Generate Orion Map (Agent Index)
        console.log("\n🛰️  Generating Orion Map for AI Agents...");
        const mapPath = join(baseOutputDir, "ORION_MAP.md");

        // Robust file listing on Windows
        const rawFiles = execSync(`dir "${baseOutputDir}" /s /b /a-d`).toString();
        const allFiles = rawFiles.split("\n")
            .map(f => f.trim())
            .filter(f => f.endsWith(".md") && !f.includes("ORION_MAP.md"))
            .map(f => {
                const relative = f.replace(cwd, "").replace(/\\/g, "/").replace(/^\//, "");
                const name = f.split("\\").pop() || relative;
                return `- [${name}](${relative})`;
            })
            .join("\n");

        const mapContent = `# 🛰️ Orion Map: Wiki Reference Index\n\nUse this index to quickly locate technical reference files.\n\n## Reference Files\n\n${allFiles}\n`;
        writeFileSync(mapPath, mapContent);
        console.log("✅ Orion Map generated.");

        console.log(`\n📚 Total documentation factory process complete.`);
        console.log(`Output: ${baseOutputDir}/`);
    } catch (error) {
        console.error("❌ Documentation Factory Failed:", error);
        process.exit(1);
    }
}

main().catch(console.error);
