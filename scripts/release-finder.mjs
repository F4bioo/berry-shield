import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const version = String(process.argv[2] || "").trim();
const rawLimit = Number.parseInt(String(process.argv[3] || "1000"), 10);
const scanLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 1000;

if (!version) {
  console.log("marker_count=0");
  console.log("marker_hash=");
  process.exit(0);
}

const contract = JSON.parse(readFileSync(".github/common-contract.json", "utf8"));
const releaseTitlePatternRaw = String(contract.releaseTitlePattern || "").trim();
const releaseTitlePattern = new RegExp(releaseTitlePatternRaw);
const expectedTitle = `chore(release): v${version}`;

const rows = execSync(`git log master -n ${scanLimit} --format=%H%x09%s`, { encoding: "utf8" })
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const matches = [];
for (const row of rows) {
  const [hash, ...rest] = row.split("\t");
  const rawSubject = rest.join("\t");
  const normalizedSubject = rawSubject.replace(/\s+\(#\d+\)\s*$/, "").trim();
  if (normalizedSubject === expectedTitle && releaseTitlePattern.test(normalizedSubject)) {
    matches.push(hash);
  }
}

console.log(`marker_count=${matches.length}`);
console.log(`marker_hash=${matches[0] || ""}`);
