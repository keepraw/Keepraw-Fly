import { readFileSync } from "node:fs";
const prohibited = /^(zzvw|forgottenpedestrian@gmail\.com)$/i;
const trailer =
  /^\s*(?:co-authored-by|signed-off-by|authored-by|committed-by|reviewed-by|acked-by|tested-by):\s*(.*?)\s*<([^<>]+)>\s*$/i;

export function inspectCommit(commit) {
  if (
    !commit?.sha ||
    !commit?.commit?.author?.email ||
    !commit?.commit?.committer?.email ||
    typeof commit.commit.message !== "string"
  ) {
    throw new Error("Incomplete commit attribution returned by GitHub");
  }
  const errors = [];
  for (const role of ["author", "committer"]) {
    for (const value of [commit[role]?.login, commit.commit[role].email]) {
      if (typeof value === "string" && prohibited.test(value.trim()))
        errors.push(`${role}: ${value}`);
    }
  }
  for (const line of commit.commit.message.split(/\r?\n/)) {
    const match = trailer.exec(line);
    if (match && [match[1], match[2]].some((v) => prohibited.test(v.trim()))) {
      errors.push(`attribution trailer: ${line.trim()}`);
    }
  }
  return errors;
}

export async function checkEvent(event, env, request = fetch) {
  const repo = env.GITHUB_REPOSITORY;
  const token = env.GITHUB_TOKEN;
  if (!/^[-\w.]+\/[-\w.]+$/.test(repo || "") || !token)
    throw new Error("Missing GitHub repository or token");
  const api = async (path) => {
    const response = await request(
      `https://api.github.com/repos/${repo}/${path}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      },
    );
    if (!response.ok)
      throw new Error(`GitHub API HTTP ${response.status}: ${path}`);
    return response.json();
  };
  let commits = [];
  if (["pull_request", "pull_request_target"].includes(env.GITHUB_EVENT_NAME)) {
    const count = event.pull_request?.commits;
    const number = event.pull_request?.number;
    if (
      !Number.isSafeInteger(count) ||
      count < 1 ||
      !Number.isSafeInteger(number)
    )
      throw new Error("Invalid PR metadata");
    for (let page = 1; page <= Math.ceil(count / 100); page++) {
      const batch = await api(
        `pulls/${number}/commits?per_page=100&page=${page}`,
      );
      if (!Array.isArray(batch) || !batch.length)
        throw new Error("PR commit listing incomplete");
      commits.push(...batch);
    }
    if (
      commits.length !== count ||
      new Set(commits.map((c) => c.sha)).size !== count
    ) {
      throw new Error("Incomplete or duplicated PR commit listing");
    }
  } else if (env.GITHUB_EVENT_NAME === "push") {
    if (
      !Array.isArray(event.commits) ||
      event.distinct_size > event.commits.length
    )
      throw new Error("Truncated push payload");
    const shas = [
      ...new Set([...event.commits.map((c) => c.id), event.after]),
    ].filter((sha) => sha && !/^0+$/.test(sha));
    if (!shas.length || shas.some((sha) => !/^[a-f0-9]{40}$/i.test(sha)))
      throw new Error("Invalid push SHAs");
    commits = await Promise.all(shas.map((sha) => api(`commits/${sha}`)));
  } else throw new Error("Unsupported GitHub event");
  const errors = commits.flatMap((commit) =>
    inspectCommit(commit).map(
      (issue) => `${commit.sha.slice(0, 12)}: ${issue}`,
    ),
  );
  if (errors.length)
    throw new Error(`Forbidden commit identity:\n${errors.join("\n")}`);
  return commits.length;
}

if (process.argv[1]?.endsWith("check-git-identities.mjs")) {
  try {
    const event = JSON.parse(
      readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"),
    );
    console.log(
      `Verified ${await checkEvent(event, process.env)} commit identities`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
