/**
 * 🍓 Berry Shield: Doc Sanity (Technical Integrity & Editorial Refinement)
 * Philosophy: Honest, technical, humble. "Show, don't tell."
 * 
 * Heuristics:
 * 1. AST-Doc Sync: Prevents claims of non-existent API symbols.
 * 2. Evidence-Based Logic: Validates security claims against code footprints.
 * 3. Semantic Hedging: Blocks absolute promises (ensures, guarantees) without hedges.
 * 4. Editorial Density: Analyzes hype and emoji frequency per 1000 words.
 * 5. Sanity Ignores: Supports <!-- doc-sanity:ignore --> comments for edge cases.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, extname, relative, dirname, resolve, basename } from "path";
import ts from "typescript";

// 🍓 Configuration
const DOCS_DIR = process.env.DOCS_DIR ?? "docs/wiki";
const CODE_DIR = process.env.CODE_DIR ?? "src";

const CONFIG = {
    hypeDensityThreshold: 2.0,      // Max hits per 1000 words
    emojiDensityThreshold: 5.0,     // Max emojis per 1000 words
    exclamationThreshold: 5,        // Max ! per file
};

const COLOR = {
    LOBSTER: "\x1b[38;2;255;90;45m",
    GRAY: "\x1b[90m",
    RESET: "\x1b[0m",
    RED: "\x1b[31m",
    YELLOW: "\x1b[33m"
};

const SYMBOL = {
    BERRY: "🍓",
    SHIELD: "🛡️",
    ANCHOR: "⚓",
    SUCCESS: "✅",
    FAIL: "❌",
    WARN: "⚠️"
};

const IGNORE = {
    line: /<!--\s*doc-sanity:ignore-line\s*-->/i,
    start: /<!--\s*doc-sanity:ignore-start\s*-->/i,
    end: /<!--\s*doc-sanity:ignore-end\s*-->/i,
    literal: /<!--\s*doc-sanity:ignore\s+"([^"]+)"\s*-->/i,
};

function snippetAround(line: string, startIdx: number, matchLen: number): string {
    const left = Math.max(0, startIdx - 30);
    const right = Math.min(line.length, startIdx + matchLen + 30);
    const prefix = left > 0 ? "…" : "";
    const suffix = right < line.length ? "…" : "";
    return `${prefix}${line.slice(left, right)}${suffix}`;
}

type Rule = {
    id: string;
    pattern: RegExp;
    message: string;
    suggestion: string;
};

const SANITY_RULES: Rule[] = [
    {
        id: "marketing.superlatives",
        pattern: /\b(revolutionary|game[-\s]?changer|leading|world[-\s]?class|state[-\s]?of[-\s]?the[-\s]?art|cutting[-\s]?edge|amazing|awesome|incredible)\b/gi,
        message: "Marketing superlative detected.",
        suggestion: "Replace with factual descriptions or measured impact."
    },
    {
        id: "marketing.absolute",
        pattern: /\b(total security|100% secure|hack[-\s]?proof|impenetrable|unbreakable|bulletproof|perfect|flawless)\b/gi,
        message: "Absolute security claim.",
        suggestion: "Replace with scoped statements (e.g., 'mitigates X', 'threat model')."
    },
    {
        id: "marketing.buzzwords",
        pattern: /\b(enterprise[-\s]?grade|military[-\s]?grade|industry[-\s]?leading|next[-\s]?gen|future[-\s]?proof|disrupt|mastery)\b/gi,
        message: "Vague credibility buzzword.",
        suggestion: "State concrete properties (standards, audits, tests)."
    }
];

const ABSOLUTE_VERBS = ["ensures", "guarantees", "prevents", "eliminates", "secures", "stops", "blocks"];
const HEDGES = ["aims to", "intends to", "designed to", "attempts to", "typically", "generally", "designed with"];

const RESERVED_WORDS = new Set([
    "string", "number", "boolean", "object", "null", "undefined", "true", "false",
    "void", "unknown", "never", "any", "typescript", "npm", "git", "bash", "curl", "json", "const", "let", "var", "rm", "rf",
    "chmod", "patterns", "redaction", "audit", "enforce", "mode", "rules", "rule", "status", "list", "add", "remove", "walk", "obj", "arm", "bin", "logs", "password", "token", "secret", "text", "db", "openclawpluginapi", "openclawpluginclicontext", "openclawplugincontext",
    "api", "config", "context", "logger", "options", "init", "toggle", "monitor", "bshield", "openclaw", "vitest", "typedoc", "node", "esm", "ts-node", "esbuild", "npx",
    "set", "map", "weakset", "weakmap", "promise", "error", "regexp", "date", "console", "process", "module", "require",
    "systemprompt", "prependcontext", "before_agent_start", "before_tool_call", "message_sending", "tool_result_persist"
]);

const EVIDENCE_RULES = [
    {
        id: "integrity.redaction",
        docClaim: ["redact", "redaction", "sensitive data", "pii"],
        codeEvidence: ["redact", "pattern", "regex", "sensitive", "walkAndRedact"],
        message: "Redaction claims found in docs, but core mitigation logic is missing in code."
    }
];

// 🛡️ Logic & Indexing
function getFiles(dir: string, extFilter: string[]): string[] {
    if (!existsSync(dir)) return [];
    let results: string[] = [];
    const list = readdirSync(dir);
    for (const file of list) {
        const path = join(dir, file);
        const stat = statSync(path);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFiles(path, extFilter));
        } else if (extFilter.includes(extname(file).toLowerCase())) {
            results.push(path);
        }
    }
    return results;
}

function buildExportIndex(files: string[]): Set<string> {
    const exports = new Set<string>();
    for (const file of files) {
        try {
            const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
            sf.forEachChild(node => {
                if (hasExport(node)) {
                    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name) {
                        exports.add(node.name.text);
                    }
                    if (ts.isVariableStatement(node)) {
                        node.declarationList.declarations.forEach(d => {
                            if (ts.isIdentifier(d.name)) exports.add(d.name.text);
                        });
                    }
                }
            });
        } catch (e) { /* silent skip */ }
    }
    return exports;
}

function hasExport(node: ts.Node): boolean {
    return (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0;
}

function countWords(text: string): number {
    const m = text.match(/\b\w+\b/g);
    return m ? m.length : 0;
}

function countEmojis(text: string): number {
    const m = text.match(/\p{Extended_Pictographic}/gu);
    return m ? m.length : 0;
}

// 🛡️ Technical Sanity Auditor
class SanityAuditor {
    errors: string[] = [];
    warnings: string[] = [];
    exportedSymbols: Set<string>;
    codeContent: string;
    linkedFiles: Set<string> = new Set();
    allDocs: Set<string> = new Set();

    constructor() {
        const codeFiles = getFiles(CODE_DIR, [".ts", ".tsx"]);
        this.exportedSymbols = buildExportIndex(codeFiles);
        this.codeContent = codeFiles.map(f => readFileSync(f, "utf8").toLowerCase()).join("\n");

        const docFiles = getFiles(DOCS_DIR, [".md"]);
        docFiles.forEach(f => this.allDocs.add(resolve(f)));

        // Seed entry point
        const entryPoint = resolve(join(DOCS_DIR, "README.md"));
        if (existsSync(entryPoint)) this.linkedFiles.add(resolve(entryPoint));

        console.log(`\n${COLOR.LOBSTER}${SYMBOL.BERRY} Berry Shield: Doc Sanity Audit Initiated${COLOR.RESET}`);
        console.log(`${COLOR.GRAY}Philosophy: "Show, don't tell."${COLOR.RESET}\n`);
    }

    auditFile(filePath: string) {
        const content = readFileSync(filePath, "utf8");
        if (content.match(/\uFFFD/g) && content.match(/\uFFFD/g)!.length > 10) return; // Binary skip

        const lines = content.split("\n");
        const relPath = relative(process.cwd(), filePath);
        const isExplanation = filePath.includes("anatomy") || filePath.includes("engine");
        const isReference = filePath.includes("reference");

        let totalWords = 0;
        let totalEmoji = 0;
        let exclamationCount = 0;
        let sanityHits = 0;
        let ignoreBlock = false;

        // 1. AST-Doc Integrity Link (Symbol Check)
        if (!isReference) {
            const symbolRegex = /`([a-zA-Z_]\w*)`/g;
            let match;
            while ((match = symbolRegex.exec(content)) !== null) {
                const sym = match[1];
                if (!RESERVED_WORDS.has(sym.toLowerCase()) && !this.exportedSymbols.has(sym)) {
                    if (/^[a-z][a-zA-Z0-9]+$/.test(sym) || /^[A-Z][A-Z]?[a-z]/.test(sym)) {
                        this.errors.push(`${relPath}: Factual integrity risk. Symbol \`${sym}\` mentioned but not exported in code.`);
                    }
                }
            }
        }

        // 2. Line-by-line Analysis
        lines.forEach((line, i) => {
            const lower = line.toLowerCase();
            const lineNo = i + 1;

            if (IGNORE.start.test(line)) { ignoreBlock = true; return; }
            if (IGNORE.end.test(line)) { ignoreBlock = false; return; }
            if (ignoreBlock || IGNORE.line.test(line)) return;

            const literalIgnoreMatch = line.match(IGNORE.literal);
            const literalToIgnore = literalIgnoreMatch?.[1];
            const effectiveLine = literalToIgnore && literalToIgnore.length > 0
                ? line.replaceAll(literalToIgnore, " ".repeat(literalToIgnore.length))
                : line;

            totalWords += countWords(effectiveLine);
            totalEmoji += countEmojis(effectiveLine);
            exclamationCount += (effectiveLine.match(/!/g) || []).length;

            // Rules with suggestions
            SANITY_RULES.forEach(rule => {
                rule.pattern.lastIndex = 0;
                let m: RegExpExecArray | null;
                while ((m = rule.pattern.exec(effectiveLine)) !== null) {
                    sanityHits++;
                    const snippet = snippetAround(line, m.index, m[0].length);
                    this.errors.push(`${relPath}:${lineNo}: [${rule.id}] ${rule.message}\n   ↳ Match: "${m[0]}"\n   ↳ Context: ${snippet}\n   ↳ Suggestion: ${rule.suggestion}`);
                    if (m.index === rule.pattern.lastIndex) rule.pattern.lastIndex++;
                }
            });

            // Absolute Promises
            ABSOLUTE_VERBS.forEach(verb => {
                const verbRegex = new RegExp(`\\b${verb}\\b`, "i");
                if (verbRegex.test(line)) {
                    const hedged = HEDGES.some(h => lower.includes(h));
                    if (!hedged) {
                        this.warnings.push(`${relPath}:${lineNo}: Absolute claim detected ("${verb}"). Consider using a hedge.`);
                    }
                }
            });

            // 🛡️ Link Integrity (Broken Links & Placeholders & Syntax)
            // Enhanced regex to capture potential malformed links with extra characters
            const linkRegex = /(\[+.*?\]+)\s*(\((.*?)\))/g;
            let match;
            while ((match = linkRegex.exec(effectiveLine)) !== null) {
                const fullBracket = match[1];
                const fullParens = match[2];
                const link = match[3];

                // Check for invalid [[Text]](Path) or [Text]](Path) syntax
                if (fullBracket.startsWith("[[") || fullBracket.endsWith("]]")) {
                    this.errors.push(`${relPath}:${lineNo}: Invalid link syntax. Detected "${fullBracket}${fullParens}". Use standard [Text](Path) for repository compatibility.`);
                }

                if (link === "#") {
                    this.errors.push(`${relPath}:${lineNo}: Broken link detected (placeholder "#").`);
                    continue;
                }
                if (link.startsWith("http") || link.startsWith("mailto:") || link.startsWith("file:") || link.startsWith("#")) continue;

                // 1. Path Consistency & Resolution
                // Triple Check: Current Dir -> Project Root -> Index Resolution
                let targetPath = resolve(dirname(filePath), link.split("#")[0]);
                if (!existsSync(targetPath)) {
                    const rootRelative = resolve(process.cwd(), link.split("#")[0]);
                    if (existsSync(rootRelative)) targetPath = rootRelative;
                }

                // 2. Resolve Directories to README/index
                if (existsSync(targetPath) && statSync(targetPath).isDirectory()) {
                    const readme = join(targetPath, "README.md");
                    const index = join(targetPath, "index.md");
                    if (existsSync(readme)) targetPath = readme;
                    else if (existsSync(index)) targetPath = index;
                }

                // 3. Handle optional .md extensions in links
                if (!targetPath.endsWith(".md") && existsSync(targetPath + ".md")) {
                    targetPath += ".md";
                }

                // Final Validation
                if (!existsSync(targetPath)) {
                    this.errors.push(`${relPath}:${lineNo}: Broken link detected. Path "${link}" does not exist.`);
                } else {
                    // Check for Case Sensitivity (Critical for GitHub/Linux compatibility)
                    const baseName = basename(targetPath);
                    const dirEntries = readdirSync(dirname(targetPath));
                    if (!dirEntries.includes(baseName)) {
                        const actualCasing = dirEntries.find(e => e.toLowerCase() === baseName.toLowerCase());
                        this.errors.push(`${relPath}:${lineNo}: Case-sensitivity mismatch. Link uses "${baseName}" but file on disk is "${actualCasing || 'unknown'}". GitHub/Linux will return 404.`);
                    }

                    if (targetPath.endsWith(".md")) {
                        this.linkedFiles.add(resolve(targetPath));
                    }
                }
            }
        });

        // 3. Evidence-Based Integrity
        EVIDENCE_RULES.forEach(rule => {
            const docMentions = rule.docClaim.some(c => content.toLowerCase().includes(c));
            if (docMentions) {
                const evidence = rule.codeEvidence.some(e => this.codeContent.includes(e));
                if (!evidence) {
                    this.errors.push(`${relPath}: ${rule.message}`);
                }
            }
        });

        // 4. Evolutionary Metrics (Density Checks)
        const density = (sanityHits / Math.max(1, totalWords)) * 1000;
        const emojiDensity = (totalEmoji / Math.max(1, totalWords)) * 1000;

        if (density >= CONFIG.hypeDensityThreshold) {
            this.warnings.push(`${relPath}: High hype density (${density.toFixed(2)} hits/1000w). Rewrite for technical modesty.`);
        }
        if (emojiDensity >= CONFIG.emojiDensityThreshold) {
            this.warnings.push(`${relPath}: High emoji density (${emojiDensity.toFixed(2)}/1000w). Reduce visual clutter.`);
        }
        if (exclamationCount >= CONFIG.exclamationThreshold) {
            this.warnings.push(`${relPath}: Many exclamation marks (${exclamationCount}). Reads like marketing.`);
        }

        const wordLimit = isExplanation ? 1200 : 500;
        if (totalWords > wordLimit) {
            this.warnings.push(`${relPath}: High word density (${totalWords} words). Target: <${wordLimit}.`);
        }
    }

    report() {
        // Orphan Identification
        const orphans = [...this.allDocs].filter(d => !this.linkedFiles.has(d));
        orphans.forEach(o => {
            this.warnings.push(`${relative(process.cwd(), o)}: Orphan file detected. No other document links to this page.`);
        });

        if (this.warnings.length > 0) {
            console.log(`${SYMBOL.WARN} ${COLOR.YELLOW} Sanity Warnings (Density & Tone):${COLOR.RESET}`);
            this.warnings.forEach(w => console.log(`   ↳ ${w}`));
        }

        if (this.errors.length > 0) {
            console.log(`\n${SYMBOL.FAIL} ${COLOR.RED} FAIL: Technical Sanity Violated!${COLOR.RESET}`);
            this.errors.forEach(e => console.log(`   ↳ ${e}`));
            process.exit(1);
        } else {
            console.log(`\n${SYMBOL.SUCCESS} ${COLOR.LOBSTER} Technical purity maintained. Fact-based documentation.${COLOR.RESET}`);
            console.log(`${COLOR.GRAY}${SYMBOL.ANCHOR} Honest, Technical, Humble.${COLOR.RESET}\n`);
        }
    }
}

// 📦 Execution Layer
const auditor = new SanityAuditor();
const docs = getFiles(DOCS_DIR, [".md"]);
docs.forEach(d => auditor.auditFile(d));
auditor.report();
