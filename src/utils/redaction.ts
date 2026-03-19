/**
 * Redaction utilities for Berry.Pulp layer.
 *
 * These functions handle the actual redaction of sensitive data
 * in strings and nested objects.
 */

import { createHash, randomBytes } from "crypto";
import { getAllRedactionPatterns, type SecurityPattern } from "../patterns";

/**
 * Session-based salt to ensure hashes are consistent within a session
 * but rotate between runs for privacy.
 */
const SESSION_SALT = randomBytes(16).toString("hex");

/**
 * Generates a dynamic placeholder for a pattern, optionally including a session-salted hash.
 */
function generatePlaceholder(pattern: SecurityPattern, originalValue: string): string {
    // 1. Determine base name: use provided placeholder or generate from ID
    let baseName = pattern.placeholder;

    if (!baseName) {
        // [NAMESPACE:SUB_ID] -> berry:secret:aws-access-key -> [BERRY:SECRET_AWS_ACCESS_KEY]
        const idParts = pattern.id.split(":");
        const namespacePart = idParts[0].toUpperCase();
        // Join all remaining parts with underscore
        const namePart = idParts.slice(1).join("_").toUpperCase().replace(/[-]/g, "_");
        baseName = `[${namespacePart}:${namePart}]`;
    }

    // 2. Append hash if required
    if (pattern.includeHash) {
        const hash = createHash("sha256")
            .update(originalValue + SESSION_SALT)
            .digest("hex")
            .substring(0, 6)
            .toUpperCase();

        // Remove trailing bracket to insert hash
        if (baseName.endsWith("]")) {
            return `${baseName.slice(0, -1)}#${hash}]`;
        }
        return `${baseName}#${hash}`;
    }

    return baseName;
}

/**
 * Result of a redaction operation.
 */
export interface RedactionResult<T = unknown> {
    /** The redacted content */
    content: T;
    /** Number of redactions made */
    redactionCount: number;
    /** Types of data that were redacted */
    redactedTypes: string[];
}

/**
 * Simple unescape for common encoded characters in tool outputs (like curl).
 */
function unescapeString(text: string): string {
    if (!text.includes("\\") && !text.includes("%")) return text;

    try {
        // Handle basic JSON-like escapes (\", \n, \t, etc)
        // We use a safe subset to avoid breaking the original string structure
        return text
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, "\\")
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "\r")
            .replace(/\\t/g, "\t")
            .replace(/\\u([0-9a-fA-F]{4})/g, (_, code: string) =>
                String.fromCharCode(parseInt(code, 16))
            );
    } catch {
        return text;
    }
}

/**
 * Match candidate for redaction with position tracking.
 */
interface MatchCandidate {
    pattern: SecurityPattern;
    matchText: string;
    start: number;
    end: number;
}

/**
 * Internal pattern metadata used by the compiled redaction engine.
 */
interface EnginePatternEntry {
    pattern: SecurityPattern;
    originalIndex: number;
    compositeFlags: string;
    isPathLike: boolean;
    probeRegex: RegExp;
}

/**
 * Single composite regex bucket for patterns that share the same flags.
 */
interface CompositeBucket {
    regex: RegExp;
    entries: EnginePatternEntry[];
    outerGroupIndexes: number[];
    shouldProbeAllAlternatives: boolean;
}

/**
 * Compiled engine used to avoid rebuilding composite regexes on every call.
 */
interface CompiledRedactionEngine {
    generalBuckets: CompositeBucket[];
    pathBuckets: CompositeBucket[];
    fallbackGeneralEntries: EnginePatternEntry[];
    fallbackPathEntries: EnginePatternEntry[];
}

const MAX_COMPOSITE_SOURCE_LENGTH = 60_000;
const ENGINE_CACHE = new WeakMap<SecurityPattern[], CompiledRedactionEngine>();
const PATH_SCAN_HINT = /[\\/]|(?:\.[a-z_][a-z0-9_-]{0,15}\b)|\b(?:appdata|library|credentials|keychains?|known_hosts|id_rsa|id_ed25519|\.env|openclaw\.json)\b/i;

/**
 * Detects high-risk nested quantifier shapes that may trigger catastrophic
 * backtracking in JavaScript regex engines.
 */
function hasPotentialCatastrophicBacktracking(source: string): boolean {
    return /\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)[+*{]/.test(source);
}

/**
 * Validates pattern safety before compilation.
 *
 * We fail fast for clearly unsafe regex forms to prevent runtime stalls.
 */
function assertPatternSafety(pattern: SecurityPattern): void {
    if (typeof pattern.id !== "string") {
        return;
    }

    const isUserSuppliedOrTestPattern =
        pattern.id.startsWith("custom:")
        || pattern.id.startsWith("test:");

    if (!isUserSuppliedOrTestPattern) {
        return;
    }

    if (hasPotentialCatastrophicBacktracking(pattern.pattern.source)) {
        throw new Error(`unsafe_regex_pattern:${pattern.id}`);
    }
}

/**
 * Counts capturing groups in a regex source.
 *
 * This is required to map composite match groups back to their owner pattern
 * without being confused by inner capturing groups.
 */
function countCapturingGroups(source: string): number {
    let count = 0;
    let escaped = false;
    let inCharClass = false;

    for (let i = 0; i < source.length; i++) {
        const char = source[i];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === "\\") {
            escaped = true;
            continue;
        }

        if (char === "[" && !inCharClass) {
            inCharClass = true;
            continue;
        }

        if (char === "]" && inCharClass) {
            inCharClass = false;
            continue;
        }

        if (inCharClass || char !== "(") {
            continue;
        }

        const next = source[i + 1];
        if (next !== "?") {
            count++;
            continue;
        }

        const type = source[i + 2];
        const nextAfterType = source[i + 3];
        const isNonCapturing =
            type === ":" ||
            type === "=" ||
            type === "!" ||
            (type === "<" && (nextAfterType === "=" || nextAfterType === "!"));

        if (!isNonCapturing) {
            count++;
        }
    }

    return count;
}

/**
 * Normalizes flags for composite regex usage.
 *
 * We enforce global scanning and remove sticky mode, because sticky would
 * break full-text scanning semantics in redactString.
 */
function normalizeCompositeFlags(flags: string): string {
    const baseOrder = ["i", "m", "s", "u", "d", "v"];
    const seen = new Set<string>();

    for (const flag of flags) {
        if (flag === "g" || flag === "y") continue;
        seen.add(flag);
    }

    const normalized = baseOrder.filter(flag => seen.has(flag)).join("");
    return `${normalized}g`;
}

/**
 * Normalizes flags for sticky probe regexes.
 *
 * Probe regexes are used to detect other patterns that also match at the same
 * start index (hidden by regex alternation's first-match behavior).
 */
function normalizeProbeFlags(flags: string): string {
    const baseOrder = ["i", "m", "s", "u", "d", "v"];
    const seen = new Set<string>();

    for (const flag of flags) {
        if (flag === "g" || flag === "y") continue;
        seen.add(flag);
    }

    const normalized = baseOrder.filter(flag => seen.has(flag)).join("");
    return `${normalized}y`;
}

/**
 * Heuristic to classify path/file-oriented regexes.
 *
 * File patterns are path-like by definition. This allows us to skip path-only
 * scanning when the text clearly has no path/file indicators.
 */
function isLikelyPathPattern(pattern: SecurityPattern): boolean {
    if (pattern.category === "file") {
        return true;
    }

    const source = pattern.pattern.source.toLowerCase();
    return source.includes("[\\\\/]")
        || source.includes("\\/")
        || source.includes("/etc/")
        || source.includes("appdata")
        || source.includes("keychain")
        || source.includes("known_hosts")
        || source.includes("\\.env")
        || source.includes("openclaw\\.json");
}

/**
 * Compiles one bucket of patterns (same flags) into a composite regex.
 */
function compileCompositeBucket(entries: EnginePatternEntry[], flags: string): CompositeBucket {
    const shouldProbeAllAlternatives =
        entries.some(entry => entry.pattern.isContextRequired)
        || entries.length <= 24;

    // When probing is disabled for large buckets, regex alternation order becomes
    // the primary selector for same-start overlaps. We prefer longer sources first
    // in that specific mode to reduce generic-first shadowing before the overlap
    // resolver applies category/length/namespace tie-breaking on collected candidates.
    const orderedEntries = shouldProbeAllAlternatives
        ? entries
        : [...entries].sort((a, b) => {
            const bySourceLength = b.pattern.pattern.source.length - a.pattern.pattern.source.length;
            if (bySourceLength !== 0) {
                return bySourceLength;
            }
            return a.originalIndex - b.originalIndex;
        });

    const alternatives: string[] = [];
    const outerGroupIndexes: number[] = [];
    let groupCursor = 1;

    for (const entry of orderedEntries) {
        const source = entry.pattern.pattern.source;
        alternatives.push(`(${source})`);
        outerGroupIndexes.push(groupCursor);
        groupCursor += 1 + countCapturingGroups(source);
    }

    const compositeSource = alternatives.join("|");
    if (compositeSource.length > MAX_COMPOSITE_SOURCE_LENGTH) {
        throw new Error("composite_regex_too_large");
    }

    return {
        regex: new RegExp(compositeSource, flags),
        entries: orderedEntries,
        outerGroupIndexes,
        shouldProbeAllAlternatives,
    };
}

/**
 * Resolves the owning pattern for a composite regex match.
 */
function resolveBucketEntry(match: RegExpExecArray, bucket: CompositeBucket): EnginePatternEntry | null {
    for (let i = 0; i < bucket.outerGroupIndexes.length; i++) {
        const groupIndex = bucket.outerGroupIndexes[i];
        if (match[groupIndex] !== undefined) {
            return bucket.entries[i];
        }
    }
    return null;
}

/**
 * Collects candidates from one compiled composite bucket.
 */
function collectCandidatesFromBucket(text: string, bucket: CompositeBucket, candidates: MatchCandidate[]): void {
    bucket.regex.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = bucket.regex.exec(text)) !== null) {
        const entry = resolveBucketEntry(match, bucket);
        const start = match.index;
        if (entry) {
            candidates.push({
                pattern: entry.pattern,
                matchText: match[0],
                start,
                end: start + match[0].length,
            });
        }

        if (bucket.shouldProbeAllAlternatives) {
            // CRITICAL: Regex alternation reports only the first matching branch.
            // We probe sibling patterns only for small buckets or context-aware
            // buckets to preserve overlap semantics without O(matches*patterns)
            // cost in large generic buckets.
            for (const sibling of bucket.entries) {
                if (entry && sibling.pattern.id === entry.pattern.id) {
                    continue;
                }

                sibling.probeRegex.lastIndex = start;
                const siblingMatch = sibling.probeRegex.exec(text);
                if (!siblingMatch) {
                    continue;
                }

                candidates.push({
                    pattern: sibling.pattern,
                    matchText: siblingMatch[0],
                    start,
                    end: start + siblingMatch[0].length,
                });
            }
        }

        if (match.index === bucket.regex.lastIndex) {
            bucket.regex.lastIndex++;
        }
    }
}

/**
 * Collects candidates using fallback multi-pass execution.
 *
 * This path is used when a composite bucket cannot be compiled (for example,
 * regex source is too large or incompatible).
 */
function collectCandidatesFallback(
    text: string,
    entries: EnginePatternEntry[],
    candidates: MatchCandidate[]
): void {
    for (const entry of entries) {
        const pattern = entry.pattern;
        const regex = new RegExp(pattern.pattern.source, normalizeCompositeFlags(pattern.pattern.flags));

        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
            candidates.push({
                pattern,
                matchText: match[0],
                start: match.index,
                end: match.index + match[0].length,
            });

            if (match.index === regex.lastIndex) {
                regex.lastIndex++;
            }
        }
    }
}

/**
 * Compiles all redaction patterns into optimized runtime structures.
 */
function compileRedactionEngine(patterns: SecurityPattern[]): CompiledRedactionEngine {
    const entries: EnginePatternEntry[] = patterns.map((pattern, originalIndex) => {
        assertPatternSafety(pattern);

        return {
            pattern,
            originalIndex,
            compositeFlags: normalizeCompositeFlags(pattern.pattern.flags),
            isPathLike: isLikelyPathPattern(pattern),
            probeRegex: new RegExp(pattern.pattern.source, normalizeProbeFlags(pattern.pattern.flags)),
        };
    });

    const pathEntries = entries.filter(entry => entry.isPathLike);
    const generalEntries = entries.filter(entry => !entry.isPathLike);

    const compileBuckets = (bucketEntries: EnginePatternEntry[]): {
        buckets: CompositeBucket[];
        fallbackEntries: EnginePatternEntry[];
    } => {
        const byFlags = new Map<string, EnginePatternEntry[]>();

        for (const entry of bucketEntries) {
            const current = byFlags.get(entry.compositeFlags);
            if (current) {
                current.push(entry);
            } else {
                byFlags.set(entry.compositeFlags, [entry]);
            }
        }

        const buckets: CompositeBucket[] = [];
        const fallbackEntries: EnginePatternEntry[] = [];

        for (const [flags, group] of byFlags.entries()) {
            try {
                buckets.push(compileCompositeBucket(group, flags));
            } catch {
                // Fallback triggers:
                // - composite source exceeds MAX_COMPOSITE_SOURCE_LENGTH
                // - regex compilation throws for an incompatible grouped source
                fallbackEntries.push(...group);
            }
        }

        return { buckets, fallbackEntries };
    };

    const generalCompilation = compileBuckets(generalEntries);
    const pathCompilation = compileBuckets(pathEntries);

    return {
        generalBuckets: generalCompilation.buckets,
        pathBuckets: pathCompilation.buckets,
        fallbackGeneralEntries: generalCompilation.fallbackEntries,
        fallbackPathEntries: pathCompilation.fallbackEntries,
    };
}

/**
 * Gets a compiled engine from cache or compiles it on first use.
 */
function getOrCreateEngine(patterns: SecurityPattern[]): CompiledRedactionEngine {
    const cached = ENGINE_CACHE.get(patterns);
    if (cached) {
        return cached;
    }

    const compiled = compileRedactionEngine(patterns);
    ENGINE_CACHE.set(patterns, compiled);
    return compiled;
}

/**
 * Fast pre-check to decide if path-like buckets should be scanned.
 */
function shouldScanPathLikePatterns(text: string): boolean {
    return PATH_SCAN_HINT.test(text);
}

/**
 * Builds the final redacted string using a segment array.
 *
 * This avoids repeated full-string reconstruction and significantly reduces
 * memory churn for large payloads with many replacements.
 */
function applyResolvedRedactions(
    originalText: string,
    resolved: MatchCandidate[]
): { content: string; redactionCount: number; redactedTypes: string[] } {
    const parts: string[] = [];
    const redactedTypeSet = new Set<string>();
    let redactionCount = 0;
    let cursor = 0;

    for (const candidate of resolved) {
        const placeholder = generatePlaceholder(candidate.pattern, candidate.matchText);

        parts.push(originalText.slice(cursor, candidate.start));
        parts.push(placeholder);

        cursor = candidate.end;
        redactionCount++;
        redactedTypeSet.add(candidate.pattern.id);
    }

    parts.push(originalText.slice(cursor));

    return {
        content: parts.join(""),
        redactionCount,
        redactedTypes: Array.from(redactedTypeSet),
    };
}

/**
 * Validates if a match has sufficient context to be redacted.
 * Used for context-aware patterns to reduce false positives.
 * 
 * @param text - The full text being scanned
 * @param match - The match candidate with position
 * @param pattern - The security pattern being evaluated
 * @returns true if match should be redacted, false otherwise
 */
function evaluateContext(
    text: string,
    match: { start: number; end: number; value: string },
    pattern: SecurityPattern
): boolean {
    // Pattern doesn't require context validation
    if (!pattern.isContextRequired) {
        return true;
    }

    // Pattern is misconfigured (requires context but has no words)
    if (!pattern.contextWords || pattern.contextWords.length === 0) {
        return false;
    }

    // CRITICAL: Prevent index out-of-bounds when context window extends beyond text boundaries
    const window = pattern.contextWindow || { before: 30, after: 15 };
    const contextStart = Math.max(0, match.start - window.before);
    const contextEnd = Math.min(text.length, match.end + window.after);
    // Context lookup excludes the matched token itself to prevent self-validation.
    const beforeSlice = text.slice(contextStart, match.start).toLowerCase();
    const afterSlice = text.slice(match.end, contextEnd).toLowerCase();

    // Check if any context word appears around the match (before or after).
    return pattern.contextWords.some(word =>
        beforeSlice.includes(word.toLowerCase()) || afterSlice.includes(word.toLowerCase())
    );
}

/**
 * Selects the winner between two overlapping matches.
 * Priority: Category hierarchy > Length > Specificity (Berry > Gitleaks)
 * 
 * @param a - First candidate
 * @param b - Second candidate
 * @returns The winning candidate
 */
function selectWinner(a: MatchCandidate, b: MatchCandidate): MatchCandidate {
    // CRITICAL: Category hierarchy for overlap resolution
    // Secret (4) > Credential (3) > PII (2) > Network (1) > Other (0)
    // Higher priority patterns override lower priority ones when they overlap
    const categoryPriority: Record<string, number> = {
        command: 5,
        secret: 4,
        credential: 3,
        pii: 2,
        network: 1,
        other: 0,
    };

    const priorityA = categoryPriority[a.pattern.category] || 0;
    const priorityB = categoryPriority[b.pattern.category] || 0;

    // Different categories: higher priority wins
    if (priorityA !== priorityB) {
        return priorityA > priorityB ? a : b;
    }

    // Same category: longer match wins (more specific)
    const lengthA = a.end - a.start;
    const lengthB = b.end - b.start;

    if (lengthA !== lengthB) {
        return lengthA > lengthB ? a : b;
    }

    // Same length: Berry patterns win over Gitleaks (more specific)
    // Berry patterns use namespace "berry:" while Gitleaks use "gitleaks:"
    const isBerryA = a.pattern.id.startsWith("berry:");
    const isBerryB = b.pattern.id.startsWith("berry:");

    if (isBerryA && !isBerryB) return a;
    if (!isBerryA && isBerryB) return b;

    // CRITICAL: Both same priority/length/namespace: favor the PREVIOUSLY accepted match
    // This respects the natural order of the patterns array (CPF before Phone)
    return b;
}

/**
 * Resolves overlapping matches by priority (category hierarchy + length + namespace)
 * using a greedy left-to-right sweep.
 * 
 * @param candidates - Array of validated match candidates
 * @returns Non-overlapping matches sorted by position
 */
function resolveOverlaps(candidates: MatchCandidate[]): MatchCandidate[] {
    if (candidates.length === 0) return [];

    // Sort by position (start index ascending)
    candidates.sort((a, b) => a.start - b.start);

    const result: MatchCandidate[] = [];
    let lastEnd = -1;

    for (let i = 0; i < candidates.length; i++) {
        const current = candidates[i];

        // CRITICAL: Check if current match overlaps with last accepted match
        // An overlap occurs when current.start < lastEnd (current begins before last ended)
        if (current.start >= lastEnd) {
            // No overlap: safe to add current match
            result.push(current);
            lastEnd = current.end;
            continue;
        }

        // Overlap detected: decide winner by priority
        const last = result[result.length - 1];
        const winner = selectWinner(current, last);

        if (winner === current) {
            // Current wins: replace last with current
            result[result.length - 1] = current;
            lastEnd = current.end;
        }
        // If winner === last, maintain current list (do nothing)
    }

    return result;
}

/**
 * Applies redaction patterns to a string using a compiled engine pipeline.
 *
 * Pipeline stages:
 * 1. ANALYZE: collect candidates via compiled composite buckets
 * 2. CONTEXT: validate context-required candidates
 * 3. REDACT: resolve overlaps and apply segment-based replacement
 *
 * CRITICAL:
 * - Overlap resolution semantics are preserved through selectWinner/resolveOverlaps.
 * - If a composite bucket cannot be compiled, fallback multi-pass scanning is used.
 *
 * @param text - The text to redact
 * @param patterns - Security patterns to apply
 * @returns Redaction result with stats
 */
export function redactString(
    text: string,
    patterns: SecurityPattern[]
): RedactionResult<string> {
    const unescaped = unescapeString(text);
    const engine = getOrCreateEngine(patterns);

    // STAGE 1: ANALYZE - Collect candidates from compiled buckets
    const candidates: MatchCandidate[] = [];

    for (const bucket of engine.generalBuckets) {
        collectCandidatesFromBucket(unescaped, bucket, candidates);
    }

    collectCandidatesFallback(unescaped, engine.fallbackGeneralEntries, candidates);

    if (shouldScanPathLikePatterns(unescaped)) {
        for (const bucket of engine.pathBuckets) {
            collectCandidatesFromBucket(unescaped, bucket, candidates);
        }

        collectCandidatesFallback(unescaped, engine.fallbackPathEntries, candidates);
    }

    if (candidates.length === 0) {
        return { content: text, redactionCount: 0, redactedTypes: [] };
    }

    // STAGE 2: CONTEXT - Validate matches (only if context is required)
    const validated = candidates.filter(candidate => {
        if (!candidate.pattern.isContextRequired) return true;
        return evaluateContext(unescaped,
            { start: candidate.start, end: candidate.end, value: candidate.matchText },
            candidate.pattern
        );
    });

    if (validated.length === 0) {
        return { content: text, redactionCount: 0, redactedTypes: [] };
    }

    // STAGE 3: REDACT - Resolve overlaps and replace
    const resolved = resolveOverlaps(validated);

    return applyResolvedRedactions(unescaped, resolved);
}

import { SENSITIVE_KEY_EXACT, SENSITIVE_KEY_SUFFIXES } from "../constants.js";

function isSensitiveKey(key: string): boolean {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEY_EXACT.has(lower)) return true;
    return SENSITIVE_KEY_SUFFIXES.some(suffix => lower.endsWith(suffix));
}

/**
 * Recursively walks through an object and redacts sensitive data.
 * Optimized for performance and memory (Lazy Cloning).
 * 
 * @param obj - The object to walk and redact
 * @param patterns - Security patterns to apply
 * @param seen - Tracking for circular references
 * @returns Redaction result with stats
 */
export function walkAndRedact<T>(
    obj: T,
    patterns: SecurityPattern[],
    seen: WeakSet<object> = new WeakSet()
): RedactionResult<T> {
    // Return primitives unchanged
    if (obj === null || typeof obj !== "object" && typeof obj !== "string") {
        return { content: obj, redactionCount: 0, redactedTypes: [] };
    }

    // Handle strings
    if (typeof obj === "string") {
        const trimmed = obj.trim();
        const isJsonCandidate = (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
            (trimmed.startsWith("[") && trimmed.endsWith("]"));

        if (isJsonCandidate) {
            try {
                const parsed = JSON.parse(obj) as unknown;
                // Recursively redact the parsed object (circular refs handled there)
                const result = walkAndRedact(parsed, patterns, seen);

                if (result.redactionCount > 0) {
                    return {
                        content: JSON.stringify(result.content) as unknown as T,
                        redactionCount: result.redactionCount,
                        redactedTypes: result.redactedTypes,
                    };
                }
            } catch {
                // Not valid JSON, fall through to normal string redaction
            }
        }

        const redaction = redactString(obj, patterns);
        return redaction as unknown as RedactionResult<T>;
    }

    // Circular reference protection for Objects and Arrays
    if (seen.has(obj)) {
        return { content: obj, redactionCount: 0, redactedTypes: [] };
    }
    seen.add(obj);

    // Handle arrays
    if (Array.isArray(obj)) {
        let totalRedactions = 0;
        const allRedactedTypes: string[] = [];
        let hasChanges = false;

        const resultArray = obj.map(item => {
            const result = walkAndRedact(item, patterns, seen);
            if (result.redactionCount > 0) {
                totalRedactions += result.redactionCount;
                hasChanges = true;
                result.redactedTypes.forEach(t => {
                    if (!allRedactedTypes.includes(t)) allRedactedTypes.push(t);
                });
            }
            return result.content;
        });

        return {
            content: (hasChanges ? resultArray : obj) as unknown as T,
            redactionCount: totalRedactions,
            redactedTypes: allRedactedTypes,
        };
    }

    // Handle objects
    const record = obj as Record<string, unknown>;
    let totalRedactions = 0;
    const allRedactedTypes: string[] = [];
    let redactedObject: Record<string, unknown> | null = null;

    for (const [key, value] of Object.entries(record)) {
        let currentContent = value;
        let currentRedactions = 0;
        const currentTypes: string[] = [];

        // Key-Based Redaction
        if (isSensitiveKey(key) && value !== null && typeof value !== "object") {
            currentContent = `[${key.toUpperCase()}_REDACTED]`;
            currentRedactions = 1;
            currentTypes.push(`Key: ${key}`);
        } else {
            const result = walkAndRedact(value, patterns, seen);
            currentContent = result.content;
            currentRedactions = result.redactionCount;
            result.redactedTypes.forEach(t => currentTypes.push(t));
        }

        if (currentRedactions > 0 || currentContent !== value) {
            // Lazy initialization of the redacted object
            if (!redactedObject) {
                redactedObject = { ...record };
            }
            redactedObject[key] = currentContent;
            totalRedactions += currentRedactions;
            currentTypes.forEach(t => {
                if (!allRedactedTypes.includes(t)) allRedactedTypes.push(t);
            });
        }
    }

    return {
        content: (redactedObject ? redactedObject : obj) as T,
        redactionCount: totalRedactions,
        redactedTypes: allRedactedTypes,
    };
}

/**
 * Efficiently finds all security patterns that match the given text or object.
 * Does NOT modify the input.
 *
 * Complexity contract:
 * - `SecurityPattern[]` path uses compiled buckets with fallback scans.
 * - `RegExp[]` path intentionally remains O(patterns * text) for string payloads.
 * - Approved call-sites are short command/path intent checks where payloads are small.
 * - Avoid using this helper for large log bodies or transcript-sized content.
 *
 * Migration trigger:
 * - If this path starts scanning payloads larger than ~200 KB or appears in
 *   hot loops (dozens of calls per request), migrate it to the compiled
 *   redaction engine strategy used by `redactString`.
 * 
 * @param obj - The object or string to check
 * @param patterns - Security patterns or raw RegExps to search for
 * @returns Array of unique pattern names that matched
 */
export function findMatches(
    obj: unknown,
    patterns: SecurityPattern[] | RegExp[],
    seen: WeakSet<object> = new WeakSet()
): string[] {
    const matchedNames = new Set<string>();
    const securityPatterns = isSecurityPatternArray(patterns) ? patterns : null;
    const regexPatterns: RegExp[] | null = securityPatterns ? null : patterns as RegExp[];
    const engine = securityPatterns ? getOrCreateEngine(securityPatterns) : null;

    const collectCompiledMatchNames = (text: string, compiledEngine: CompiledRedactionEngine) => {
        const candidates: MatchCandidate[] = [];

        for (const bucket of compiledEngine.generalBuckets) {
            collectCandidatesFromBucket(text, bucket, candidates);
        }
        collectCandidatesFallback(text, compiledEngine.fallbackGeneralEntries, candidates);

        // findMatches is intentionally match-presence only. We scan both path and
        // general buckets unconditionally to preserve the previous semantics.
        for (const bucket of compiledEngine.pathBuckets) {
            collectCandidatesFromBucket(text, bucket, candidates);
        }
        collectCandidatesFallback(text, compiledEngine.fallbackPathEntries, candidates);

        for (const candidate of candidates) {
            matchedNames.add(candidate.pattern.name);
        }
    };

    const walk = (current: unknown) => {
        if (!current) return;

        if (typeof current === "string") {
            const unescaped = unescapeString(current);
            if (engine) {
                collectCompiledMatchNames(unescaped, engine);
            } else {
                for (const regex of regexPatterns ?? []) {
                    regex.lastIndex = 0;
                    if (regex.test(unescaped)) {
                        matchedNames.add("Sensitive Pattern");
                    }
                }
            }
            return;
        }

        if (typeof current === "object") {
            if (seen.has(current)) return;
            seen.add(current);

            if (Array.isArray(current)) {
                for (const item of current) {
                    walk(item);
                }
            } else {
                for (const value of Object.values(current as Record<string, unknown>)) {
                    walk(value);
                }
            }
        }
    };

    walk(obj);
    return Array.from(matchedNames);
}

function isSecurityPatternArray(patterns: SecurityPattern[] | RegExp[]): patterns is SecurityPattern[] {
    if (patterns.length === 0) {
        return false;
    }

    return !(patterns[0] instanceof RegExp);
}

/**
 * Redacts all sensitive data from an object using default patterns.
 *
 * @param obj - The object to redact
 * @returns Redaction result with stats
 */
export function redactSensitiveData<T>(obj: T): RedactionResult<T> {
    const patterns = getAllRedactionPatterns();
    return walkAndRedact(obj, patterns);
}
