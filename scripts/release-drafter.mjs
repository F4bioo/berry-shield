import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

function run(cmd, options = {}) {
  return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...options }).trim();
}

function runAllowFail(cmd, options = {}) {
  try {
    return { ok: true, out: run(cmd, options) };
  } catch (error) {
    return {
      ok: false,
      out: String(error?.stdout || ""),
      err: String(error?.stderr || ""),
    };
  }
}

function isNotFoundSignal(result) {
  const raw = `${result?.out || ""}\n${result?.err || ""}`.toLowerCase();
  return raw.includes("not found") || raw.includes("404");
}

const version = String(process.argv[2] || "").trim();
if (!version) {
  console.error("release-drafter: version argument is required");
  process.exit(1);
}

if (!process.env.GH_TOKEN) {
  console.error("release-drafter: GH_TOKEN is required");
  process.exit(1);
}

const repo = String(process.env.GITHUB_REPOSITORY || "").trim();
if (!repo || !repo.includes("/")) {
  console.error("release-drafter: GITHUB_REPOSITORY is required");
  process.exit(1);
}
const [owner, name] = repo.split("/", 2);

const tag = `v${version}`;
const releaseView = runAllowFail(`gh release view "${tag}" --json isDraft`);
if (!releaseView.ok && !isNotFoundSignal(releaseView)) {
  console.error(`release-drafter: unable to determine release state for ${tag} (fail-closed)`);
  console.error(releaseView.err || releaseView.out || "unknown gh error");
  process.exit(1);
}

if (releaseView.ok) {
  const payload = JSON.parse(releaseView.out || "{}");
  if (payload.isDraft === true) {
    console.log(`DRAFT_ALREADY_EXISTS_FOR_VERSION ${tag}`);
    process.exit(0);
  }
  console.error(`RELEASE_ALREADY_PUBLISHED_FOR_VERSION ${tag}`);
  process.exit(1);
}

run(`git config --local user.email "action@github.com"`);
run(`git config --local user.name "GitHub Action"`);

const localTagExists = runAllowFail(`git rev-parse "refs/tags/${tag}"`).ok;
if (!localTagExists) {
  run(`git tag -a "${tag}" -m "${tag}"`);
}

const remoteTagExists = runAllowFail(`git ls-remote --tags origin "refs/tags/${tag}"`).out.trim().length > 0;
if (!remoteTagExists) {
  run(`git push origin "${tag}"`);
}

const packJson = run(`npm pack --json`);
const pack = JSON.parse(packJson);
const tgz = String(pack?.[0]?.filename || "");
if (!tgz || !existsSync(tgz)) {
  console.error("release-drafter: failed to generate npm pack artifact");
  process.exit(1);
}
run(`sha256sum "${tgz}" > SHA256SUMS`);

const contract = JSON.parse(readFileSync(".github/common-contract.json", "utf8"));
const firstReleaseNotes = String(contract.firstReleaseNotes || "").trim();
const internalReleaseNotes = String(contract.internalReleaseNotes || "").trim();
const publicTypes = Array.isArray(contract?.releaseNotes?.public)
  ? contract.releaseNotes.public.map((x) => String(x).trim().toLowerCase()).filter(Boolean)
  : [];

const tags = runAllowFail("git tag --sort=version:refname");
const tagList = tags.ok ? tags.out.split("\n").map((t) => t.trim()).filter(Boolean) : [];
const previousTag = tagList.filter((t) => t !== tag).slice(-1)[0] || null;

let notes = previousTag ? internalReleaseNotes : firstReleaseNotes;
if (previousTag) {
  const prevTagDate = run(`git log -1 --format=%cI ${previousTag}`);
  const since = new Date(prevTagDate).getTime();
  const pulls = [];
  const perPage = 100;
  const maxPages = 20;
  for (let page = 1; page <= maxPages; page += 1) {
    const pullsRaw = runAllowFail(
      `gh api -X GET "repos/${owner}/${name}/pulls" -f state=closed -f base=master -f per_page=${perPage} -f page=${page}`,
    );
    if (!pullsRaw.ok) {
      console.error("release-drafter: unable to load pull requests for release notes (fail-closed)");
      console.error(pullsRaw.err || pullsRaw.out || "unknown gh error");
      process.exit(1);
    }
    const pageItems = JSON.parse(pullsRaw.out || "[]");
    pulls.push(...pageItems);
    if (!Array.isArray(pageItems) || pageItems.length < perPage) {
      break;
    }
  }

  if (pulls.length > 0) {
    const merged = pulls
      .filter((pr) => !!pr.merged_at)
      .filter((pr) => new Date(pr.merged_at).getTime() > since);

    const nonBot = merged.filter((pr) => {
      const login = String(pr?.user?.login || "").toLowerCase();
      return !login.endsWith("[bot]");
    });

    const selected = nonBot.filter((pr) => {
      const m = String(pr.title || "").match(/^([a-z]+)(?:\([^)]*\))?:/i);
      if (!m) return false;
      return publicTypes.includes(String(m[1]).toLowerCase());
    });

    const lines = selected.map((pr) => `- ${pr.title} (#${pr.number}) thanks @${pr?.user?.login}.`);
    if (lines.length > 0) notes = lines.join("\n");
  }
}

writeFileSync("/tmp/release-notes.md", notes.endsWith("\n") ? notes : `${notes}\n`, "utf8");
run(`gh release create "${tag}" "${tgz}" "SHA256SUMS" --title "${tag}" --notes-file /tmp/release-notes.md --draft`);
console.log(`DRAFT_CREATED ${tag}`);
