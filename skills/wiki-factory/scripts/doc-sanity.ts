/**
 * 🍓 Berry Shield: Doc Sanity (Technical Integrity & Tone)
 * Philosophy: Honest, technical, humble. "Show, don't tell."
 * 
 * Heuristics:
 * 1. AST-Doc Sync: Prevents claims of non-existent API symbols.
 * 2. Evidence-Based Logic: Validates security claims against code footprints.
 * 3. Semantic Hedging: Blocks absolute promises (ensures, guarantees) without hedges.
 * 4. Contextual Homeostasis: Awareness of Diátaxis zones (Explanation vs Reference).
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, extname, relative, sep } from "path";
import ts from "typescript";

// 🍓 Configuration

const DOCS_DIR = process.env.DOCS_DIR ?? "docs/wiki";
const CODE_DIR = process.env.CODE_DIR ?? "src";

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

const FORBIDDEN_WORDS = [
    "mastery", "revolutionary", "professional", "perfect", "amazing",
    "unbreakable", "total security", "game changer", "proprietary", "industry-standard"
];

const ABSOLUTE_VERBS = ["ensures", "guarantees", "prevents", "eliminates", "secures", "stops", "blocks"];

const HEDGES = ["aims to", "intends to", "designed to", "attempts to", "typically", "generally", "designed with"];

// Words that triggered false positives in the AST check
const RESERVED_WORDS = new Set([
    "string", "number", "boolean", "object", "null", "undefined", "true", "false",
    "void", "unknown", "never", "any", "typescript", "npm", "git", "bash", "curl", "json", "const", "let", "var", "rm", "rf",
    "chmod", "patterns", "redaction", "audit", "enforce", "mode", "rules", "rule", "status", "list", "add", "remove", "walk", "obj", "arm", "bin", "logs", "password", "token", "secret", "text", "db", "openclawpluginapi", "openclawpluginclicontext", "openclawplugincontext",
    "api", "config", "context", "logger", "options",
    "set", "map", "weakset", "weakmap", "promise", "error", "regexp", "date", "console", "process", "module", "require"
]);

const CLAIM_EVIDENCE_MAP = [
    {
        id: "security.redaction",
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

// 🛡️ Technical Sanity Auditor
class SanityAuditor {
    errors: string[] = [];
    warnings: string[] = [];
    exportedSymbols: Set<string>;
    codeContent: string;

    constructor() {
        const codeFiles = getFiles(CODE_DIR, [".ts", ".tsx"]);
        this.exportedSymbols = buildExportIndex(codeFiles);
        this.codeContent = codeFiles.map(f => readFileSync(f, "utf8").toLowerCase()).join("\n");

        console.log(`\n${COLOR.LOBSTER}${SYMBOL.BERRY} Berry Shield: Doc Sanity Audit Initiated${COLOR.RESET}`);
        console.log(`${COLOR.GRAY}Philosophy: "Show, don't tell."${COLOR.RESET}\n`);
    }

    auditFile(filePath: string) {
        const content = readFileSync(filePath, "utf8");
        const lines = content.split("\n");
        const relPath = relative(process.cwd(), filePath);
        const isExplanation = filePath.includes("anatomy") || filePath.includes("engine");
        const isReference = filePath.includes("reference");

        // 1. AST-Doc Integrity Link (Symbol Check)
        // Only run for manual documentation, as reference is auto-generated and inherently synced.
        if (!isReference) {
            const symbolRegex = /`([a-zA-Z_]\w*)`/g;
            let match;
            while ((match = symbolRegex.exec(content)) !== null) {
                const sym = match[1];
                if (!RESERVED_WORDS.has(sym.toLowerCase()) && !this.exportedSymbols.has(sym)) {
                    // Heuristic: only fail if it looks like a camelCase function or PascalCase Class
                    if (/^[a-z][a-zA-Z0-9]+$/.test(sym) || /^[A-Z][A-Z]?[a-z]/.test(sym)) {
                        this.errors.push(`${relPath}: Factual integrity risk. Symbol \`${sym}\` mentioned but not exported in code.`);
                    }
                }
            }
        }

        // 2. Line-by-line Tone Analysis
        lines.forEach((line, i) => {
            const lower = line.toLowerCase();
            const lineNo = i + 1;

            // Forbidden Marketing
            FORBIDDEN_WORDS.forEach(word => {
                if (lower.includes(word)) {
                    this.errors.push(`${relPath}:${lineNo}: Prohibited marketing term: "${word}"`);
                }
            });

            // Absolute Promises without Hedges
            ABSOLUTE_VERBS.forEach(verb => {
                if (lower.includes(verb)) {
                    const hedged = HEDGES.some(h => lower.includes(h));
                    if (!hedged) {
                        this.warnings.push(`${relPath}:${lineNo}: Absolute claim detected ("${verb}"). Consider using a hedge.`);
                    }
                }
            });
        });

        // 3. Evidence-Based Integrity
        CLAIM_EVIDENCE_MAP.forEach(rule => {
            const docMentions = rule.docClaim.some(c => content.toLowerCase().includes(c));
            if (docMentions) {
                const evidence = rule.codeEvidence.some(e => this.codeContent.includes(e));
                if (!evidence) {
                    this.errors.push(`${relPath}: ${rule.message}`);
                }
            }
        });

        // 4. Contextual Homeostasis (Weight Check)
        const wordCount = content.split(/\s+/).length;
        const limit = isExplanation ? 1200 : 500;
        if (wordCount > limit) {
            this.warnings.push(`${relPath}: High word density (${wordCount} words). Potential "fluff" detected.`);
        }
    }

    report() {
        if (this.warnings.length > 0) {
            console.log(`${SYMBOL.WARN} ${COLOR.YELLOW}Tone Warnings (Hype Density):${COLOR.RESET}`);
            this.warnings.forEach(w => console.log(`   ↳ ${w}`));
        }

        if (this.errors.length > 0) {
            console.log(`\n${SYMBOL.FAIL} ${COLOR.RED}FAIL: Technical Modesty Violated!${COLOR.RESET}`);
            this.errors.forEach(e => console.log(`   ↳ ${e}`));
            process.exit(1);
        } else {
            console.log(`\n${SYMBOL.SUCCESS} ${COLOR.LOBSTER}Technical purity maintained. Fact-based documentation.${COLOR.RESET}`);
            console.log(`${COLOR.GRAY}${SYMBOL.ANCHOR} Honest, Technical, Humble.${COLOR.RESET}\n`);
        }
    }
}

// 📦 Execution Layer

const auditor = new SanityAuditor();
const docs = getFiles(DOCS_DIR, [".md"]);

docs.forEach(d => auditor.auditFile(d));
auditor.report();
