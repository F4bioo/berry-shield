/**
 * 🍓 Tone Guard Linter
 * Philosophy: Honest, technical, humble.
 * "Show, don't tell."
 * 
 * Scans Markdown docs for hype/marketing language and overconfident claims.
 * Designed for modest, factual GitHub documentation.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, extname } from "path";

type Severity = "BAN" | "WARN";

type Rule = {
    id: string;
    severity: Severity;
    pattern: RegExp;
    message: string;
    suggestion?: string;
};

type Hit = {
    file: string;
    line: number;
    col: number;
    severity: Severity;
    ruleId: string;
    match: string;
    message: string;
    suggestion?: string;
    snippet: string;
};

const CONFIG = {
    targetDir: "docs/wiki",
    scanExtensions: new Set([".md", ".mdx"]),
    warningsAsErrors: false,
    hypeDensityWarnThreshold: 2.0,
    emojiPer1000WarnThreshold: 6,
    exclamationWarnThreshold: 8,
};

const IGNORE = {
    ignoreNextLine: /<!--\s*hype-slayer:ignore-next-line\s*-->/i,
    ignoreStart: /<!--\s*hype-slayer:ignore-start\s*-->/i,
    ignoreEnd: /<!--\s*hype-slayer:ignore-end\s*-->/i,
    ignoreLiteral: /<!--\s*hype-slayer:ignore\s+"([^"]+)"\s*-->/i,
};

// 🍓 Banned Rules (Marketing Superlatives)
const BAN_RULES: Rule[] = [
    {
        id: "ban.absolute-security",
        severity: "BAN",
        pattern: /\b(total security|100% secure|hack[-\s]?proof|impenetrable|unbreakable|bulletproof)\b/gi,
        message: "Absolute security claim.",
        suggestion: "Replace with a scoped statement (threat model, mitigations, limitations).",
    },
    {
        id: "ban.superlatives",
        severity: "BAN",
        pattern: /\b(revolutionary|game[-\s]?changer|best|leading|world[-\s]?class|state[-\s]?of[-\s]?the[-\s]?art|cutting[-\s]?edge)\b/gi,
        message: "Marketing superlative.",
        suggestion: "Replace with a factual description (what changed, what it does, measured impact).",
    },
    {
        id: "ban.perfection",
        severity: "BAN",
        pattern: /\b(perfect|flawless|ultimate|guaranteed)\b/gi,
        message: "Overpromising language.",
        suggestion: "Use 'recommended', 'intended', 'aims to', or document failure modes.",
    },
    {
        id: "ban.enterprise-grade",
        severity: "BAN",
        pattern: /\b(enterprise[-\s]?grade|military[-\s]?grade|industry[-\s]?leading)\b/gi,
        message: "Vague credibility marketing.",
        suggestion: "State concrete properties (standards, audits, tests, compatibility).",
    },
];

// 🍓 Warning Rules (Buzzwords & Vibes)
const WARN_RULES: Rule[] = [
    {
        id: "warn.vibes",
        severity: "WARN",
        pattern: /\b(amazing|awesome|incredible|insane|mind[-\s]?blowing|legendary|rockstar)\b/gi,
        message: "Vibe-y adjective in technical docs.",
        suggestion: "Prefer neutral wording, or keep for informal sections only.",
    },
    {
        id: "warn.future-sell",
        severity: "WARN",
        pattern: /\b(next[-\s]?gen|future[-\s]?proof|redefine|disrupt|synergy)\b/gi,
        message: "Buzzword / marketing phrasing.",
        suggestion: "Replace with concrete behavior or roadmap items.",
    },
    {
        id: "warn.no-downtime",
        severity: "WARN",
        pattern: /\b(zero downtime|never fails|always works)\b/gi,
        message: "Absolute reliability claim.",
        suggestion: "Describe SLOs/expectations, or say 'designed to minimize downtime'.",
    },
];

// 🍓 Claim Detection Architecture
const CLAIM_STRONG_VERBS = /\b(guarantees?|ensures?|prevents?|eliminates?|solves?|fixes?|protects?|secures?|stops?|blocks?)\b/i;
const CLAIM_HEDGES = /\b(may|might|can|could|typically|generally|often|aims? to|tries? to|designed to|intended to|helps? (to )?)\b/i;

function claimRuleForLine(line: string): boolean {
    return CLAIM_STRONG_VERBS.test(line) && !CLAIM_HEDGES.test(line);
}

// 🛡️ Technical Helpers
function isBinaryLike(content: string): boolean {
    const repl = (content.match(/\uFFFD/g) || []).length;
    return repl > 10;
}

function countWords(text: string): number {
    const m = text.match(/\b[\p{L}\p{N}][\p{L}\p{N}'-]*\b/gu);
    return m ? m.length : 0;
}

function countEmojis(text: string): number {
    const m = text.match(/\p{Extended_Pictographic}/gu);
    return m ? m.length : 0;
}

function snippetAround(line: string, startIdx: number, matchLen: number): string {
    const left = Math.max(0, startIdx - 30);
    const right = Math.min(line.length, startIdx + matchLen + 30);
    const prefix = left > 0 ? "…" : "";
    const suffix = right < line.length ? "…" : "";
    return `${prefix}${line.slice(left, right)}${suffix}`;
}

// 🛰️ Scanning Core
function scanDirectory(dir: string, hits: Hit[], fileStats: { filesScanned: number }) {
    const files = readdirSync(dir);

    for (const file of files) {
        const path = join(dir, file);
        const st = statSync(path);

        if (st.isDirectory()) {
            scanDirectory(path, hits, fileStats);
            continue;
        }

        const ext = extname(path).toLowerCase();
        if (!CONFIG.scanExtensions.has(ext)) continue;

        fileStats.filesScanned += 1;
        const raw = readFileSync(path, "utf-8");
        if (isBinaryLike(raw)) continue;

        scanMarkdownFile(path, raw, hits);
    }
}

function scanMarkdownFile(absPath: string, content: string, hits: Hit[]) {
    const relPath = relative(process.cwd(), absPath);
    const lines = content.split(/\r?\n/);

    let ignoreBlock = false;
    let ignoreNext = false;

    let totalWords = 0;
    let totalEmoji = 0;
    let exclamations = 0;
    let perFileHits = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNo = i + 1;

        totalWords += countWords(line);
        totalEmoji += countEmojis(line);
        exclamations += (line.match(/!/g) || []).length;

        if (IGNORE.ignoreStart.test(line)) {
            ignoreBlock = true;
            continue;
        }
        if (IGNORE.ignoreEnd.test(line)) {
            ignoreBlock = false;
            continue;
        }

        if (ignoreNext) {
            ignoreNext = false;
            continue;
        }
        if (IGNORE.ignoreNextLine.test(line)) {
            ignoreNext = true;
            continue;
        }

        if (ignoreBlock) continue;

        const literalIgnoreMatch = line.match(IGNORE.ignoreLiteral);
        const literalToIgnore = literalIgnoreMatch?.[1];

        const effectiveLine =
            literalToIgnore && literalToIgnore.length > 0
                ? line.replaceAll(literalToIgnore, " ".repeat(literalToIgnore.length))
                : line;

        // Apply BAN & WARN Rules
        const allRules = [...BAN_RULES, ...WARN_RULES];
        for (const rule of allRules) {
            rule.pattern.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = rule.pattern.exec(effectiveLine)) !== null) {
                perFileHits += 1;
                hits.push({
                    file: relPath,
                    line: lineNo,
                    col: m.index + 1,
                    severity: rule.severity,
                    ruleId: rule.id,
                    match: m[0],
                    message: rule.message,
                    suggestion: rule.suggestion,
                    snippet: snippetAround(line, m.index, m[0].length),
                });
                if (m.index === rule.pattern.lastIndex) rule.pattern.lastIndex++;
            }
        }

        // Claim detection
        if (claimRuleForLine(effectiveLine.toLowerCase())) {
            perFileHits += 1;
            const idx = effectiveLine.toLowerCase().search(CLAIM_STRONG_VERBS);
            hits.push({
                file: relPath,
                line: lineNo,
                col: idx >= 0 ? idx + 1 : 1,
                severity: "WARN",
                ruleId: "warn.promise-verb",
                match: idx >= 0 ? effectiveLine.slice(idx, idx + 40).trim() : "promise-like claim",
                message: "Promise-y claim without hedge (may/can/typically/designed to…).",
                suggestion: "Add scope or hedge; describe limits, assumptions, or validation steps.",
                snippet: idx >= 0 ? snippetAround(line, idx, Math.min(20, line.length - idx)) : line.slice(0, 80),
            });
        }
    }

    // Soft metrics verification
    const words = Math.max(1, totalWords);
    const hypeDensity = (perFileHits / words) * 1000;
    const emojiPer1000 = (totalEmoji / words) * 1000;

    if (hypeDensity >= CONFIG.hypeDensityWarnThreshold) {
        hits.push({
            file: relPath, line: 1, col: 1, severity: "WARN", ruleId: "warn.hype-density",
            match: `${hypeDensity.toFixed(2)} hits/1000w`,
            message: `High hype density (${hypeDensity.toFixed(2)} hits per 1000 words).`,
            suggestion: "Consider rewriting sections to be more neutral and evidence-based.",
            snippet: "",
        });
    }

    if (emojiPer1000 >= CONFIG.emojiPer1000WarnThreshold) {
        hits.push({
            file: relPath, line: 1, col: 1, severity: "WARN", ruleId: "warn.emoji-density",
            match: `${emojiPer1000.toFixed(2)} emoji/1000w`,
            message: `High emoji density (${emojiPer1000.toFixed(2)} emoji per 1000 words).`,
            suggestion: "Reduce celebratory emojis in technical sections.",
            snippet: "",
        });
    }

    if (exclamations >= CONFIG.exclamationWarnThreshold) {
        hits.push({
            file: relPath, line: 1, col: 1, severity: "WARN", ruleId: "warn.exclamations",
            match: `${exclamations} !`,
            message: `Many exclamation marks (${exclamations}).`,
            suggestion: "Exclamation-heavy tone often reads like marketing; consider toning down.",
            snippet: "",
        });
    }
}

// 📦 Output & Main
function formatHit(h: Hit): string {
    const loc = `${h.file}:${h.line}:${h.col}`;
    const sev = h.severity === "BAN" ? "❌ BAN" : "⚠️  WARN";
    const sug = h.suggestion ? `\n   ↳ Suggestion: ${h.suggestion}` : "";
    const snip = h.snippet ? `\n   ↳ Context: ${h.snippet}` : "";
    return `${sev} ${loc} [${h.ruleId}] ${h.message}\n   ↳ Match: "${h.match}"${snip}${sug}`;
}

function main() {
    const targetDir = CONFIG.targetDir;
    const hits: Hit[] = [];
    const fileStats = { filesScanned: 0 };

    console.log(`🛡️  Running Tone-Guard Linter on "${targetDir}"...`);
    scanDirectory(targetDir, hits, fileStats);

    const banHits = hits.filter((h) => h.severity === "BAN");
    const warnHits = hits.filter((h) => h.severity === "WARN");

    const byFile = new Map<string, Hit[]>();
    for (const h of hits) {
        const arr = byFile.get(h.file) ?? [];
        arr.push(h);
        byFile.set(h.file, arr);
    }

    if (hits.length > 0) {
        console.log("");
        for (const [file, fileHits] of [...byFile.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
            console.log(`— ${file}`);
            for (const h of fileHits.sort((a, b) => a.line - b.line || a.col - b.col)) {
                console.log(formatHit(h));
            }
            console.log("");
        }
    }

    console.log(`Scanned ${fileStats.filesScanned} file(s). Found ${banHits.length} BAN, ${warnHits.length} WARN.`);

    const shouldFail = banHits.length > 0 || (CONFIG.warningsAsErrors && warnHits.length > 0);

    if (shouldFail) {
        console.error("\nFAIL: No-Hype Directive violated.");
        process.exit(1);
    } else if (warnHits.length > 0) {
        console.log("\n✅ No banned hype. (Warnings present — consider cleanup.)");
        process.exit(0);
    } else {
        console.log("\n✅ Zero hype detected. Documentation stays factual and modest.");
        process.exit(0);
    }
}

main();
