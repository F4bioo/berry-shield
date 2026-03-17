import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

function run(bin, args = [], options = {}) {
  return execFileSync(bin, args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  }).trim();
}

function runAllowFail(bin, args = [], options = {}) {
  try {
    return { ok: true, out: run(bin, args, options) };
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

function parseJson(raw, label) {
  try {
    return JSON.parse(raw || "");
  } catch (error) {
    console.error(`release-drafter: invalid JSON while parsing ${label}`);
    console.error(String(error?.message || error));
    process.exit(1);
  }
}

function gh(args, options = {}) {
  return run("gh", args, options);
}

function ghAllowFail(args, options = {}) {
  return runAllowFail("gh", args, options);
}

function git(args, options = {}) {
  return run("git", args, options);
}

function gitAllowFail(args, options = {}) {
  return runAllowFail("git", args, options);
}

function npm(args, options = {}) {
  return run("npm", args, options);
}

function tarAllowFail(args, options = {}) {
  return runAllowFail("tar", args, options);
}

function encodePathSegment(value) {
  return encodeURIComponent(String(value || "").trim());
}

function writeSha256File(filename, outputFile) {
  const content = readFileSync(filename);
  const hash = createHash("sha256").update(content).digest("hex");
  writeFileSync(outputFile, `${hash}  ${filename}\n`, "utf8");
}

function extractConventionalType(title) {
  const match = String(title || "").match(/^([a-z]+)(?:\([^)]*\))?:/i);
  return match ? String(match[1]).toLowerCase() : null;
}

async function fetchPulls(owner, name, sinceDate) {
  const query = `repo:${owner}/${name}+is:pr+is:merged+base:master+merged:>=${sinceDate}`;
  const pullsRaw = ghAllowFail([
    "api",
    "--paginate",
    `search/issues?q=${query}&per_page=100`,
    "--jq",
    ".items[] | {number, title, merged_at: .pull_request.merged_at, user: {login: .user.login}}",
  ]);

  if (!pullsRaw.ok) {
    throw new Error(`release-drafter: unable to load pull requests: ${pullsRaw.err || pullsRaw.out}`);
  }

  const lines = String(pullsRaw.out || "").split("\n").filter(Boolean);
  const pulls = [];

  for (const line of lines) {
    try {
      pulls.push(JSON.parse(line));
    } catch {
      // Lifeboat Strategy
      const numMatch = line.match(/"number":\s*(\d+)/);
      if (numMatch) {
        const prNumber = numMatch[1];
        console.warn(`release-drafter: malformed JSON for PR #${prNumber}, attempting rescue...`);

        const rescue = ghAllowFail([
          "pr",
          "view",
          prNumber,
          "-R",
          `${owner}/${name}`,
          "--json",
          "number,title,mergedAt,author",
        ]);

        if (rescue.ok) {
          try {
            const data = JSON.parse(rescue.out || "{}");
            pulls.push({
              number: data.number,
              title: data.title,
              merged_at: data.mergedAt,
              user: { login: data?.author?.login || null },
            });
            console.log(`release-drafter: successfully rescued PR #${prNumber}`);
          } catch (rescueError) {
            console.error(`release-drafter: rescue payload parse failed for PR #${prNumber}`);
            console.error(String(rescueError?.message || rescueError));
          }
        } else {
          console.error(`release-drafter: rescue failed for PR #${prNumber}`);
        }
      } else {
        console.warn(`release-drafter: skipping unidentifiable malformed line: ${line.slice(0, 50)}...`);
      }
    }
  }

  return pulls;
}

function generateNotes(pulls, since, publicTypes, internalReleaseNotes, firstReleaseNotes, hasPreviousRelease) {
  if (!hasPreviousRelease) return firstReleaseNotes;
  if (pulls.length === 0) return internalReleaseNotes;

  const merged = pulls
    .filter((pr) => !!pr?.merged_at)
    .filter((pr) => new Date(pr.merged_at).getTime() > since);

  const nonBot = merged.filter((pr) => {
    const login = String(pr?.user?.login || "").toLowerCase();
    return !login.endsWith("[bot]");
  });

  const selected = nonBot.filter((pr) => {
    const type = extractConventionalType(pr?.title);
    return !!type && publicTypes.includes(type);
  });

  if (selected.length === 0) return internalReleaseNotes;

  return selected
    .map((pr) => {
      const login = pr?.user?.login;
      const isCreator = login && login.toLowerCase() === "f4bioo";
      const thanksSuffix = login && !isCreator ? ` thanks @${login}.` : ".";
      return `- ${pr.title} (#${pr.number})${thanksSuffix}`;
    })
    .join("\n");
}

function getReleaseByTag(owner, name, tag) {
  const result = ghAllowFail([
    "api",
    "-X",
    "GET",
    `repos/${owner}/${name}/releases/tags/${encodePathSegment(tag)}`,
  ]);

  if (!result.ok) {
    if (isNotFoundSignal(result)) return null;
    console.error(`release-drafter: unable to determine release state for ${tag} (fail-closed)`);
    console.error(result.err || result.out || "unknown gh error");
    process.exit(1);
  }

  return parseJson(result.out, `release by tag ${tag}`);
}

function getLatestPublishedReleaseBefore(owner, name, excludedTag, nowMs) {
  const releases = [];
  const perPage = 100;
  const maxPages = 10;

  for (let page = 1; page <= maxPages; page += 1) {
    const raw = ghAllowFail([
      "api",
      "-X",
      "GET",
      `repos/${owner}/${name}/releases?per_page=${perPage}&page=${page}`,
    ]);

    if (!raw.ok) {
      console.error("release-drafter: unable to load releases for release window (fail-closed)");
      console.error(raw.err || raw.out || "unknown gh error");
      process.exit(1);
    }

    const pageItems = parseJson(raw.out, `releases page ${page}`);
    if (!Array.isArray(pageItems)) {
      console.error("release-drafter: invalid releases payload");
      process.exit(1);
    }

    releases.push(...pageItems);

    if (pageItems.length < perPage) {
      break;
    }
  }

  const eligible = releases
    .filter((release) => release && release.draft !== true)
    .filter((release) => String(release.tag_name || "") !== excludedTag)
    .filter((release) => !!release.published_at)
    .filter((release) => {
      const publishedAt = new Date(release.published_at).getTime();
      return Number.isFinite(publishedAt) && publishedAt <= nowMs;
    })
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

  return eligible[0] || null;
}

async function main() {
  const version = String(process.argv[2] || "").trim();
  if (!version) {
    console.error("release-drafter: version argument is required");
    process.exit(1);
  }

  const repo = String(process.env.GITHUB_REPOSITORY || "").trim();
  if (!repo || !repo.includes("/")) {
    console.error("release-drafter: GITHUB_REPOSITORY is required");
    process.exit(1);
  }

  const [owner, name] = repo.split("/", 2);
  const tag = `v${version}`;
  const nowMs = Date.now();

  const existingRelease = getReleaseByTag(owner, name, tag);
  if (existingRelease) {
    if (existingRelease.draft === true) {
      console.log(`DRAFT_ALREADY_EXISTS_FOR_VERSION ${tag}`);
      process.exit(0);
    }

    console.error(`RELEASE_ALREADY_PUBLISHED_FOR_VERSION ${tag}`);
    process.exit(1);
  }

  const contract = parseJson(readFileSync(".github/common-contract.json", "utf8"), "common contract");
  const firstReleaseNotes = String(contract?.firstReleaseNotes || "").trim();
  const internalReleaseNotes = String(contract?.internalReleaseNotes || "").trim();
  const publicTypes = Array.isArray(contract?.releaseNotes?.public)
    ? contract.releaseNotes.public.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
    : [];

  const previousPublishedRelease = getLatestPublishedReleaseBefore(owner, name, tag, nowMs);

  let notes = "";

  if (previousPublishedRelease?.published_at) {
    const prevReleaseDate = String(previousPublishedRelease.published_at).trim();
    const sinceDate = prevReleaseDate.slice(0, 10);
    const since = new Date(prevReleaseDate).getTime();

    if (!Number.isFinite(since)) {
      console.error("release-drafter: invalid published_at on previous release");
      process.exit(1);
    }

    const pulls = await fetchPulls(owner, name, sinceDate);
    notes = generateNotes(pulls, since, publicTypes, internalReleaseNotes, firstReleaseNotes, true);
  } else {
    notes = firstReleaseNotes;
  }

  if (process.env.GITHUB_ACTIONS === "true") {
    git(["config", "--local", "user.email", "action@github.com"]);
    git(["config", "--local", "user.name", "GitHub Action"]);
  }

  const localTagExists = gitAllowFail(["rev-parse", "--verify", `refs/tags/${tag}`]).ok;
  if (!localTagExists) {
    git(["tag", "-a", tag, "-m", tag]);
  }

  const remoteTagLookup = gitAllowFail(["ls-remote", "--tags", "origin", `refs/tags/${tag}`]);
  const remoteTagExists = remoteTagLookup.ok && remoteTagLookup.out.trim().length > 0;
  if (!remoteTagExists) {
    git(["push", "origin", tag]);
  }

  const packJson = npm(["pack", "--json"]);
  const pack = parseJson(packJson, "npm pack output");
  const tgz = String(pack?.[0]?.filename || "");

  if (!tgz || !existsSync(tgz)) {
    console.error("release-drafter: failed to generate npm pack artifact");
    process.exit(1);
  }

  const tarList = tarAllowFail(["-tzf", tgz]);
  if (!tarList.ok) {
    console.error("release-drafter: unable to inspect npm pack artifact contents");
    console.error(tarList.err || tarList.out || "unknown tar error");
    process.exit(1);
  }

  const tarEntries = String(tarList.out || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!tarEntries.includes("package/dist/index.js")) {
    console.error("release-drafter: npm pack artifact is missing package/dist/index.js");
    process.exit(1);
  }

  writeSha256File(tgz, "SHA256SUMS");

  const releaseNotesFile = `${process.env.RUNNER_TEMP || "/tmp"}/release-notes.md`;
  writeFileSync(releaseNotesFile, notes.endsWith("\n") ? notes : `${notes}\n`, "utf8");

  gh([
    "release",
    "create",
    tag,
    tgz,
    "SHA256SUMS",
    "--title",
    tag,
    "--notes-file",
    releaseNotesFile,
    "--draft",
  ]);

  console.log(`DRAFT_CREATED ${tag}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
