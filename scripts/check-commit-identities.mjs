import { execFileSync } from "node:child_process";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trimEnd();
}

function commit(ref) {
  if (!ref || ref.startsWith("-")) throw new Error("A commit ref is required.");
  return git("rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`);
}

function incorrect(name, email) {
  return (
    name.trim().toLowerCase() === "zzvw" ||
    email.toLowerCase() === "forgottenpedestrian@gmail.com" ||
    /^(?:\d+\+)?zzvw@users\.noreply\.github\.com$/i.test(email)
  );
}

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const baseRef = args[0] ?? process.env.COMMIT_BASE_SHA;
const head = commit(args[1] ?? "HEAD");
if (!baseRef)
  throw new Error("Usage: check-commit-identities.mjs <base> [head]");
const revision = /^0{40}$/.test(baseRef) ? head : `${commit(baseRef)}..${head}`;
const commits = git("rev-list", revision).split("\n").filter(Boolean);
const failures = [];

for (const sha of commits) {
  const [author, authorEmail, committer, committerEmail, message] = git(
    "show",
    "-s",
    "--format=%an%x00%ae%x00%cn%x00%ce%x00%B",
    sha,
  ).split("\0");
  for (const [role, name, email] of [
    ["Author", author, authorEmail],
    ["Committer", committer, committerEmail],
  ]) {
    if (incorrect(name, email))
      failures.push(`${sha}: ${role} ${name} <${email}>`);
  }
  for (const match of message.matchAll(
    /^Co-authored-by:\s*(.*?)\s*<([^>]+)>\s*$/gim,
  )) {
    if (incorrect(match[1], match[2]))
      failures.push(`${sha}: ${match[0].trim()}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  console.error(
    "Incorrect account attribution. See docs/engineering-standards.md before fixing your own commits; preserve independent contributors and bot identities.",
  );
  process.exitCode = 1;
} else {
  console.log(
    `Commit identity checks passed for ${commits.length} incoming commits.`,
  );
}
