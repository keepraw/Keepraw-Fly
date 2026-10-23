import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const repository = "keepraw/Keepraw-Fly";
const prefix = `repos/${repository}`;
function api(path, method = "GET") {
  return JSON.parse(
    execFileSync("gh", ["api", "--method", method, path], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }) || "null",
  );
}
function pages(path, key) {
  const values = [];
  for (let page = 1; ; page++) {
    const result = api(
      `${prefix}/${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
    );
    const items = key ? result[key] : result;
    values.push(...items);
    if (items.length < 100) return values;
  }
}

export function classifyRuns(
  runs,
  prs,
  artifacts,
  releaseShas,
  now = Date.now(),
) {
  const cutoff = now - 30 * 24 * 60 * 60 * 1000;
  return runs.map((run) => {
    const related = prs.filter(
      (pr) =>
        pr.head?.repo?.full_name === run.head_repository?.full_name &&
        pr.head.ref === run.head_branch,
    );
    const newer = runs.filter(
      (other) =>
        other.workflow_id === run.workflow_id &&
        other.head_branch === run.head_branch &&
        other.head_repository?.full_name === run.head_repository?.full_name &&
        Date.parse(other.created_at) > Date.parse(run.created_at),
    );
    let reason;
    if (run.status !== "completed") reason = "active run";
    else if (run.path !== ".github/workflows/ci.yml")
      reason = "separate workflow: release/deployment/other retained";
    else if (run.head_branch === "main")
      reason = "main provenance and deployment retained";
    else if (releaseShas.has(run.head_sha))
      reason = "release/tag commit retained";
    else if (related.some((pr) => pr.state === "open"))
      reason = "open PR retained";
    else if (Date.parse(run.created_at) >= cutoff)
      reason = "within 30-day retention window";
    else if (!related.length || related.some((pr) => pr.state !== "closed"))
      reason = "PR association unproven";
    else if (!Number.isFinite(Date.parse(run.created_at)))
      reason = "invalid creation timestamp";
    else if (
      artifacts.some(
        (artifact) =>
          artifact.workflow_run?.id === run.id &&
          !artifact.name.startsWith("playwright-"),
      )
    )
      reason = "non-diagnostic artifact retained";
    else if (
      run.conclusion === "cancelled" &&
      newer.some((other) => other.status === "completed")
    )
      reason =
        "DELETE: superseded cancellation on closed PR, older than 30 days";
    else if (
      run.conclusion === "failure" &&
      newer.some((other) => other.conclusion === "success")
    )
      reason =
        "DELETE: failure superseded by successful closed-PR CI, older than 30 days";
    else reason = "success or unresolved diagnostic evidence retained";
    return {
      id: run.id,
      status: run.status,
      conclusion: run.conclusion,
      created_at: run.created_at,
      branch: run.head_branch,
      head_sha: run.head_sha,
      workflow: run.name,
      path: run.path,
      prs: related.map((pr) => pr.number),
      reason,
      delete: reason.startsWith("DELETE:"),
    };
  });
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(
      "Dry run: node scripts/cleanup-actions.mjs [--out plan.json]\nAfter owner review: node scripts/cleanup-actions.mjs --execute approved-plan.json\nThe approved candidates must remain eligible when re-fetched. No automatic artifact deletion.",
    );
    return;
  }
  if (
    args.length &&
    (args.length !== 2 || !["--out", "--execute"].includes(args[0]))
  )
    throw new Error("Use --help for supported arguments");
  const runs = pages("actions/runs", "workflow_runs");
  const prs = pages("pulls?state=all");
  const artifacts = pages("actions/artifacts", "artifacts");
  // Protect every tag, including historical releases. Failure to read any
  // inventory aborts the operation; no partial inventory can authorize deletion.
  const tags = pages("tags");
  const inventory = classifyRuns(
    runs,
    prs,
    artifacts,
    new Set(tags.map((tag) => tag.commit.sha)),
  );
  const candidates = inventory.filter((run) => run.delete);
  const plan = {
    repository,
    generated_at: new Date().toISOString(),
    retention_days: 30,
    total: inventory.length,
    candidates,
    retained: inventory.filter((run) => !run.delete),
  };
  console.table(
    candidates.map(({ id, conclusion, created_at, branch, reason }) => ({
      id,
      conclusion,
      created_at,
      branch,
      reason,
    })),
  );
  console.log(
    `${inventory.length} runs inventoried; ${candidates.length} candidates; ${inventory.length - candidates.length} retained. Default is dry-run.`,
  );
  if (args[0] === "--out")
    writeFileSync(args[1], JSON.stringify(plan, null, 2) + "\n", {
      flag: "wx",
    });
  if (args[0] !== "--execute") return;
  const approved = JSON.parse(readFileSync(args[1], "utf8"));
  if (
    approved.repository !== repository ||
    approved.retention_days !== 30 ||
    !Array.isArray(approved.candidates)
  )
    throw new Error("Invalid approved manifest");
  const ids = new Set();
  for (const item of approved.candidates) {
    const current = candidates.find((run) => run.id === item.id);
    if (
      !current ||
      current.head_sha !== item.head_sha ||
      current.conclusion !== item.conclusion ||
      current.created_at !== item.created_at ||
      ids.has(item.id)
    )
      throw new Error(
        `Run ${item.id} changed, duplicated or no longer eligible; regenerate the plan`,
      );
    ids.add(item.id);
  }
  // Delete only the explicit reviewed subset, never newly discovered candidates.
  for (const id of ids) {
    api(`${prefix}/actions/runs/${id}`, "DELETE");
    console.log(`Deleted ${id}`);
  }
  console.log(`Deleted ${ids.size} approved runs.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
