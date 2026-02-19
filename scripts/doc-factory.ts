/**
 * 🍓 Berry Shield: Doc Factory (Generated Reference Builder)
 * Philosophy: deterministic output, low-noise generation, cross-platform links.
 *
 * Pipeline:
 * 1. Wipe and regenerate TypeDoc reference.
 * 2. Build a curated root index for quick lookup.
 * 3. Add lightweight generated banners to submodule READMEs.
 * 4. Run doc sanity validation.
 */
import { execSync } from "child_process";
import { basename, dirname, join, relative } from "path";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "fs";

type GroupKey = "Classes" | "Interfaces" | "Functions" | "Type Aliases" | "Variables" | "Other";

type RefFile = {
    absPath: string;
    relFromRoot: string;
    name: string;
};

const BASE_OUTPUT_DIR = join("docs", "wiki", "reference");
const ROOT_README = join(BASE_OUTPUT_DIR, "README.md");

const COLOR = {
    LOBSTER: "\x1b[38;2;255;90;45m",
    GRAY: "\x1b[90m",
    RESET: "\x1b[0m",
    RED: "\x1b[31m"
};

const SYMBOL = {
    BERRY: "🍓",
    SATELLITE: "🛰️",
    SUCCESS: "✅",
    FAIL: "❌"
};

function toPosix(pathValue: string): string {
    // Keep generated links portable across Windows/Linux and GitHub rendering.
    return pathValue.replace(/\\/g, "/");
}

function relativeLink(fromFileAbs: string, toFileAbs: string): string {
    // All links in generated reference docs are relative to the file that renders them.
    const rel = toPosix(relative(dirname(fromFileAbs), toFileAbs));
    return rel.startsWith(".") ? rel : `./${rel}`;
}

function listFilesRecursive(dir: string, ext: string): string[] {
    if (!existsSync(dir)) return [];

    // Explicit sort guarantees stable output across environments and CI runners.
    const entries = readdirSync(dir).sort((a, b) => a.localeCompare(b));
    const result: string[] = [];

    for (const entry of entries) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
            result.push(...listFilesRecursive(full, ext));
            continue;
        }

        if (entry.endsWith(ext)) {
            result.push(full);
        }
    }

    // Final sort keeps recursion order deterministic even if traversal changes.
    return result.sort((a, b) => a.localeCompare(b));
}

function buildSymbolGroups(files: RefFile[]): Record<GroupKey, RefFile[]> {
    const groups: Record<GroupKey, RefFile[]> = {
        "Classes": [],
        "Interfaces": [],
        "Functions": [],
        "Type Aliases": [],
        "Variables": [],
        "Other": []
    };

    for (const file of files) {
        const rel = file.relFromRoot;
        if (rel.includes("/classes/")) groups["Classes"].push(file);
        else if (rel.includes("/interfaces/")) groups["Interfaces"].push(file);
        else if (rel.includes("/functions/")) groups["Functions"].push(file);
        else if (rel.includes("/type-aliases/")) groups["Type Aliases"].push(file);
        else if (rel.includes("/variables/")) groups["Variables"].push(file);
        else groups["Other"].push(file);
    }

    for (const key of Object.keys(groups) as GroupKey[]) {
        groups[key] = groups[key].sort((a, b) => a.relFromRoot.localeCompare(b.relFromRoot));
    }

    return groups;
}

function toRefFile(absPath: string): RefFile {
    return {
        absPath,
        relFromRoot: toPosix(relative(BASE_OUTPUT_DIR, absPath)),
        name: basename(absPath)
    };
}

function renderRootReadme(moduleReadmes: RefFile[], groups: Record<GroupKey, RefFile[]>): string {
    const lines: string[] = [];

    lines.push("# `reference`");
    lines.push("");
    lines.push("> [!NOTE]");
    lines.push("> Auto-generated technical reference from source code.");
    lines.push("> Do not edit this directory manually.");
    lines.push("> Regenerate with `npm run wiki:gen`.");
    lines.push("");

    lines.push("## `Quick Navigation`");
    lines.push("");
    if (moduleReadmes.length === 0) {
        lines.push("- No module README files were generated.");
    } else {
        for (const item of moduleReadmes) {
            const moduleName = item.relFromRoot.replace(/\/README\.md$/i, "");
            const link = relativeLink(ROOT_README, item.absPath);
            lines.push(`- [\`${moduleName}\`](${link})`);
        }
    }
    lines.push("");

    lines.push("## `Code Map (Grouped Index)`");
    lines.push("");
    lines.push("Use this map to locate symbols quickly by generated category.");
    lines.push("");

    for (const [groupName, items] of Object.entries(groups) as Array<[GroupKey, RefFile[]]>) {
        if (items.length === 0) continue;
        lines.push(`### \`${groupName}\``);
        lines.push("");
        for (const item of items) {
            const link = relativeLink(ROOT_README, item.absPath);
            const display = item.relFromRoot.replace(/\.md$/i, "");
            lines.push(`- [\`${display}\`](${link})`);
        }
        lines.push("");
    }

    return `${lines.join("\n")}\n`;
}

function decorateSubmoduleReadmes(readmeFiles: RefFile[]): void {
    for (const item of readmeFiles) {
        if (item.absPath === ROOT_README) continue;

        const content = readFileSync(item.absPath, "utf8").replace(/\uFEFF/g, "");
        const backToRoot = relativeLink(item.absPath, ROOT_README);

        // Lightweight prepend-only decoration avoids brittle markdown parsing of TypeDoc sections.
        const bannerLines = [
            "> [!NOTE]",
            "> Auto-generated technical reference. Do not edit manually.",
            "> Regenerate with `npm run wiki:gen`.",
            `> [Back to reference index](${backToRoot})`,
            ""
        ];

        writeFileSync(item.absPath, `${bannerLines.join("\n")}\n${content.trimStart()}\n`, "utf8");
    }
}

async function main() {
    // Wipe-and-rebuild keeps generated output simple and avoids stale artifacts.
    if (existsSync(BASE_OUTPUT_DIR)) {
        rmSync(BASE_OUTPUT_DIR, { recursive: true, force: true });
    }
    mkdirSync(BASE_OUTPUT_DIR, { recursive: true });

    console.log(`\n${COLOR.LOBSTER}${SYMBOL.BERRY} Berry Shield: Reference Factory${COLOR.RESET}`);
    console.log(`${COLOR.GRAY}Pipeline: TypeDoc -> index shaping -> sanity audit.${COLOR.RESET}\n`);

    try {
        const command = [
            "npx typedoc",
            "--entryPoints src/index.ts src/layers/*.ts src/utils/*.ts src/policy/*.ts",
            `--out ${toPosix(BASE_OUTPUT_DIR)}`,
            "--plugin typedoc-plugin-markdown",
            "--theme markdown",
            "--fileExtension .md",
            "--hideBreadcrumbs true",
            "--cleanOutputDir true",
            "--readme none",
            "--githubPages false"
        ].join(" ");

        execSync(command, { stdio: "inherit" });
        console.log(`${SYMBOL.SUCCESS} Base TypeDoc output generated.`);

        const allMarkdown = listFilesRecursive(BASE_OUTPUT_DIR, ".md").map(toRefFile);
        const readmes = allMarkdown
            .filter(f => f.name.toLowerCase() === "readme.md")
            .sort((a, b) => a.relFromRoot.localeCompare(b.relFromRoot));

        const symbolFiles = allMarkdown
            .filter(f => f.name.toLowerCase() !== "readme.md")
            .sort((a, b) => a.relFromRoot.localeCompare(b.relFromRoot));

        const groups = buildSymbolGroups(symbolFiles);
        const rootContent = renderRootReadme(readmes.filter(f => f.absPath !== ROOT_README), groups);
        writeFileSync(ROOT_README, rootContent, "utf8");

        decorateSubmoduleReadmes(readmes);
        console.log(`${SYMBOL.SATELLITE} Reference README files post-processed.`);

        console.log(`${SYMBOL.SATELLITE} Running documentation sanity audit...`);
        execSync("npx ts-node --esm scripts/doc-sanity.ts", { stdio: "inherit" });

        console.log(`${SYMBOL.SUCCESS} Reference documentation complete: ${toPosix(BASE_OUTPUT_DIR)}/`);
    } catch (error) {
        console.error(`${COLOR.RED}${SYMBOL.FAIL} Documentation factory failed:${COLOR.RESET}`, error);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error(`${COLOR.RED}${SYMBOL.FAIL} Unhandled documentation factory error:${COLOR.RESET}`, error);
    process.exit(1);
});
