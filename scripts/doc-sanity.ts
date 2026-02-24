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
import { fileURLToPath } from "url";
import ts from "typescript";

// Configuration
const DOCS_DIR = process.env.DOCS_DIR ?? "docs/wiki";
const CODE_DIR = process.env.CODE_DIR ?? "src";
const EXTRA_DOC_FILES = ["SECURITY_AUDIT.md"];

const CONFIG = {
    hypeDensityThreshold: 2.0,      // Max hits per 1000 words
    emojiDensityThreshold: 5.0,     // Max emojis per 1000 words
    exclamationThreshold: 5,        // Max ! per file
    frontmatter: {
        title: { min: 3, max: 90 },
        summary: { min: 24, max: 220 },
        readWhen: {
            minItems: 2,
            maxItems: 8,
            itemMin: 8,
            itemMax: 180
        }
    }
};

type DensityRule = {
    pattern: RegExp;
    maxWords: number;
    label: string;
};

const DENSITY_RULES: DensityRule[] = [
    { pattern: /SECURITY_AUDIT\.md$/i, maxWords: 1200, label: "security-audit-root-doc" },
    { pattern: /^README\.md$/i, maxWords: 900, label: "wiki-root-readme" },
    { pattern: /^operation\/README\.md$/i, maxWords: 900, label: "operation-index" },
    { pattern: /^operation\/cli\/README\.md$/i, maxWords: 900, label: "cli-index" },
    { pattern: /^operation\/web\/README\.md$/i, maxWords: 900, label: "web-index" },
    { pattern: /^operation\/cli\/.+\.md$/i, maxWords: 1000, label: "cli-command" },
    { pattern: /^decision\/README\.md$/i, maxWords: 900, label: "decision-index" },
    { pattern: /^decision\/.+\.md$/i, maxWords: 1500, label: "decision-page" },
    { pattern: /^layers\/README\.md$/i, maxWords: 900, label: "layers-index" },
    { pattern: /^layers\/.+\.md$/i, maxWords: 1500, label: "layer-page" },
    { pattern: /^engine\/README\.md$/i, maxWords: 900, label: "engine-index" },
    { pattern: /^engine\/.+\.md$/i, maxWords: 1200, label: "engine-page" },
    { pattern: /^deploy\/README\.md$/i, maxWords: 900, label: "deploy-index" },
    { pattern: /^deploy\/.+\.md$/i, maxWords: 1200, label: "deploy-page" },
    { pattern: /^tutorials\/README\.md$/i, maxWords: 900, label: "tutorials-index" },
    { pattern: /^tutorials\/.+\.md$/i, maxWords: 1200, label: "tutorial-page" },
];

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
    WARN: "⚠️",
    MARKER: "↳",
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

type FrontmatterData = {
    raw: string;
    title?: string;
    summary?: string;
    readWhen: string[];
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
    "policy", "profile", "strict", "balanced", "minimal", "expected", "result", "outcome",
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

const MOJIBAKE_PATTERNS: RegExp[] = [
    /â€œ/g, /â€/g, /â€˜/g, /â€™/g,
    /â€“/g, /â€”/g, /â€¦/g,
    /Ã¢/g, /Ãƒ/g,
    /ðŸ/g
];

// Logic & Indexing
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

function getAuditTargets(): string[] {
    const docs = getFiles(DOCS_DIR, [".md"]);
    const extras = EXTRA_DOC_FILES
        .map((file) => resolve(process.cwd(), file))
        .filter((file) => existsSync(file));
    return [...docs, ...extras];
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

export function isLikelyApiSymbol(token: string): boolean {
    // Lower camelCase: walkAndRedact
    if (/^[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*$/.test(token)) return true;
    // PascalCase with more than one capitalized segment and mixed case: ConfigWrapper, ApiClient
    if (/^[A-Z][a-z0-9]+(?:[A-Z][A-Za-z0-9]*)+$/.test(token)) return true;
    return false;
}

function countWords(text: string): number {
    const m = text.match(/\b\w+\b/g);
    return m ? m.length : 0;
}

function countEmojis(text: string): number {
    const m = text.match(/\p{Extended_Pictographic}/gu);
    return m ? m.length : 0;
}

function lineAtIndex(text: string, index: number): number {
    return text.slice(0, index).split("\n").length;
}

function findPrevNonEmptyLine(lines: string[], startLine: number): { lineNo: number; text: string } | null {
    for (let i = startLine - 1; i >= 1; i--) {
        const text = lines[i - 1].trim();
        if (text.length > 0) return { lineNo: i, text };
    }
    return null;
}

function findNextNonEmptyLines(lines: string[], startLine: number, maxCount: number): Array<{ lineNo: number; text: string }> {
    const result: Array<{ lineNo: number; text: string }> = [];
    for (let i = startLine + 1; i <= lines.length && result.length < maxCount; i++) {
        const text = lines[i - 1].trim();
        if (text.length > 0) result.push({ lineNo: i, text });
    }
    return result;
}

function parseFrontmatter(content: string): FrontmatterData | null {
    const normalized = content.replace(/\uFEFF/g, "").replace(/\r\n/g, "\n");
    if (!normalized.startsWith("---\n")) return null;

    const endIdx = normalized.indexOf("\n---\n", 4);
    if (endIdx < 0) return null;

    const raw = normalized.slice(4, endIdx);
    const lines = raw.split("\n");
    const readWhen: string[] = [];

    let inReadWhen = false;
    for (const line of lines) {
        const trimmed = line.trim();

        if (/^read_when\s*:\s*$/.test(trimmed)) {
            inReadWhen = true;
            continue;
        }

        if (inReadWhen) {
            const item = line.match(/^\s*-\s+(.+?)\s*$/);
            if (item) {
                readWhen.push(item[1].trim());
                continue;
            }
            if (trimmed.length > 0) inReadWhen = false;
        }
    }

    const titleMatch = raw.match(/^\s*title\s*:\s*["']?(.+?)["']?\s*$/m);
    const summaryMatch = raw.match(/^\s*summary\s*:\s*["']?(.+?)["']?\s*$/m);

    return {
        raw,
        title: titleMatch?.[1]?.trim(),
        summary: summaryMatch?.[1]?.trim(),
        readWhen
    };
}

function normalizeDocRelPath(absPath: string): string {
    return relative(resolve(DOCS_DIR), resolve(absPath)).replace(/\\/g, "/");
}

function resolveDensityRule(absPath: string): DensityRule | null {
    const relDoc = normalizeDocRelPath(absPath);
    return DENSITY_RULES.find((rule) => rule.pattern.test(relDoc)) ?? null;
}

// Technical Sanity Auditor
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

        const docFiles = getAuditTargets();
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
        const isReference = filePath.includes("reference");
        const strictCliContract = /<!--\s*doc-sanity:cli-contract:strict\s*-->/i.test(content);
        const densityRule = resolveDensityRule(filePath);

        if (!densityRule) {
            this.errors.push(
                `${relPath}: Missing density target mapping for this path. Add a rule in DENSITY_RULES (scripts/doc-sanity.ts).`
            );
        }

        // -1. Frontmatter contract (except generated reference docs)
        if (!isReference) {
            const fm = parseFrontmatter(content);
            if (!fm) {
                this.errors.push(`${relPath}: Missing YAML frontmatter. Required fields: summary, read_when, title.`);
            } else {
                const { frontmatter } = CONFIG;

                if (!fm.title || fm.title.length < frontmatter.title.min || fm.title.length > frontmatter.title.max) {
                    this.errors.push(
                        `${relPath}: Invalid frontmatter.title length (${fm.title?.length ?? 0}). Expected ${frontmatter.title.min}-${frontmatter.title.max} characters.`
                    );
                }

                if (!fm.summary || fm.summary.length < frontmatter.summary.min || fm.summary.length > frontmatter.summary.max) {
                    this.errors.push(
                        `${relPath}: Invalid frontmatter.summary length (${fm.summary?.length ?? 0}). Expected ${frontmatter.summary.min}-${frontmatter.summary.max} characters.`
                    );
                }

                if (
                    fm.readWhen.length < frontmatter.readWhen.minItems ||
                    fm.readWhen.length > frontmatter.readWhen.maxItems
                ) {
                    this.errors.push(
                        `${relPath}: Invalid frontmatter.read_when item count (${fm.readWhen.length}). Expected ${frontmatter.readWhen.minItems}-${frontmatter.readWhen.maxItems} items.`
                    );
                }

                fm.readWhen.forEach((item, idx) => {
                    if (item.length < frontmatter.readWhen.itemMin || item.length > frontmatter.readWhen.itemMax) {
                        this.errors.push(
                            `${relPath}: Invalid frontmatter.read_when[${idx}] length (${item.length}). Expected ${frontmatter.readWhen.itemMin}-${frontmatter.readWhen.itemMax} characters.`
                        );
                    }
                });

                const firstH1 = lines.find(l => /^#\s+.+/.test(l.trim()));
                if (!firstH1) {
                    this.errors.push(`${relPath}: Missing H1 heading. A page title is required after frontmatter.`);
                } else if (!/^#\s+`.+`$/.test(firstH1.trim())) {
                    this.errors.push(`${relPath}: First H1 must use backticks. Expected format: # \`...\``);
                }
            }
        }

        let totalWords = 0;
        let totalEmoji = 0;
        let exclamationCount = 0;
        let sanityHits = 0;
        let ignoreBlock = false;

        // 0. Mojibake guardrail
        for (const pattern of MOJIBAKE_PATTERNS) {
            let m: RegExpExecArray | null;
            pattern.lastIndex = 0;
            while ((m = pattern.exec(content)) !== null) {
                const lineNo = lineAtIndex(content, m.index);
                this.errors.push(`${relPath}:${lineNo}: Mojibake detected ("${m[0]}"). Re-save file in UTF-8 and fix corrupted text.`);
                if (m.index === pattern.lastIndex) pattern.lastIndex++;
            }
        }

        // 0. Bash block policy for OpenClaw CLI docs
        const bashFenceRegex = /```bash\s*\n([\s\S]*?)```/g;
        let bashMatch: RegExpExecArray | null;
        while ((bashMatch = bashFenceRegex.exec(content)) !== null) {
            const bashBody = bashMatch[1];
            const lineNo = lineAtIndex(content, bashMatch.index);
            const cmdMatches = bashBody.match(/^\s*openclaw bshield\b/gm) ?? [];

            // Only enforce the strict contract when this bash block is clearly Berry CLI.
            if (cmdMatches.length > 0) {
                if (cmdMatches.length > 1) {
                    this.errors.push(
                        `${relPath}:${lineNo}: Bash block contains ${cmdMatches.length} 'openclaw bshield' commands. Use one command per \`\`\`bash block.`
                    );
                }

                // Require a heading above each CLI command block.
                let hasValidHeading = false;
                for (let i = lineNo - 1; i >= Math.max(1, lineNo - 6); i--) {
                    const candidate = lines[i - 1].trim();
                    if (candidate.length === 0) continue;
                    if (/^#{2,4}\s+.{8,}$/.test(candidate)) {
                        hasValidHeading = true;
                    }
                }
                if (!hasValidHeading) {
                    const msg = `${relPath}:${lineNo}: CLI bash block should have a heading above it (minimum 8 characters).`;
                    if (strictCliContract) this.errors.push(msg);
                    else this.warnings.push(msg);
                }

                // Require contextual sentence above command block.
                const prev = findPrevNonEmptyLine(lines, lineNo);
                if (!prev || /^#{1,6}\s+/.test(prev.text) || prev.text.length < 24) {
                    const msg = `${relPath}:${lineNo}: CLI bash block should include a contextual line above it (minimum 24 characters, not only a heading).`;
                    if (strictCliContract) this.errors.push(msg);
                    else this.warnings.push(msg);
                }

                // Require explicit expected/result line below command block.
                const blockEndLine = lineAtIndex(content, bashMatch.index + bashMatch[0].length);
                const nextLines = findNextNonEmptyLines(lines, blockEndLine, 4).map(x => x.text);
                const hasOutcome = nextLines.some(l => /^(Expected|Result|Usage Example):/i.test(l) || /^\*Usage Example:\*/i.test(l));
                if (!hasOutcome) {
                    const msg = `${relPath}:${lineNo}: CLI bash block should be followed by 'Expected:', 'Result:', or 'Usage Example:' line.`;
                    if (strictCliContract) this.errors.push(msg);
                    else this.warnings.push(msg);
                }
            }
        }

        // 1. AST-Doc Integrity Link (Symbol Check)
        if (!isReference) {
            const contentForSymbolCheck = content.replace(/^#\s+`[^`]+`\s*$/m, "");
            const symbolRegex = /`([a-zA-Z_]\w*)`/g;
            let match;
            while ((match = symbolRegex.exec(contentForSymbolCheck)) !== null) {
                const sym = match[1];
                if (!RESERVED_WORDS.has(sym.toLowerCase()) && !this.exportedSymbols.has(sym)) {
                    if (isLikelyApiSymbol(sym)) {
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
                    this.errors.push(`${relPath}:${lineNo}: [${rule.id}] ${rule.message}\n   ${SYMBOL.MARKER} Match: "${m[0]}"\n   ${SYMBOL.MARKER} Context: ${snippet}\n   ${SYMBOL.MARKER} Suggestion: ${rule.suggestion}`);
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

        if (densityRule && totalWords > densityRule.maxWords) {
            this.warnings.push(
                `${relPath}: High word density (${totalWords} words). Target: <${densityRule.maxWords} [${densityRule.label}].`
            );
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
            this.warnings.forEach(w => console.log(`   ${SYMBOL.MARKER} ${w}`));
        }

        if (this.errors.length > 0) {
            console.log(`\n${SYMBOL.FAIL} ${COLOR.RED} FAIL: Technical Sanity Violated!${COLOR.RESET}`);
            this.errors.forEach(e => console.log(`   ${SYMBOL.MARKER} ${e}`));
            process.exit(1);
        } else {
            console.log(`\n${SYMBOL.SUCCESS} ${COLOR.LOBSTER} Technical purity maintained. Fact-based documentation.${COLOR.RESET}`);
            console.log(`${COLOR.GRAY}${SYMBOL.ANCHOR} Honest, Technical, Humble.${COLOR.RESET}\n`);
        }
    }
}

function isDirectExecution(): boolean {
    const cliTarget = process.argv[1];
    if (!cliTarget) return false;
    return resolve(cliTarget) === resolve(fileURLToPath(import.meta.url));
}

// Execution Layer
if (isDirectExecution()) {
    const auditor = new SanityAuditor();
    const docs = getAuditTargets();
    docs.forEach(d => auditor.auditFile(d));
    auditor.report();
}
