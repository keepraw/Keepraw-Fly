#!/usr/bin/env bash
# Release source consistency (scripts/verify-release-source.sh) and the image
# job's fail-closed ordering. Part 1 runs the real check against CI run
# fixtures. Part 2 executes the release workflow's own image-job steps, in
# order, with recording stand-ins for gh/docker and the action steps, and
# proves that a refused source stops the job before any push, signing or
# upload. Neither part talks to GitHub or Sigstore.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
A=$(printf 'a%.0s' {1..40}) B=$(printf 'b%.0s' {1..40}) C=$(printf 'c%.0s' {1..40})

ci_run() { # out head_sha [jq-edit]
  jq -n --arg sha "$2" '{id: 101, status: "completed", conclusion: "success", event: "push",
    head_branch: "main", head_sha: $sha, path: ".github/workflows/ci.yml",
    repository: {full_name: "keepraw/Keepraw-Fly"}, head_repository: {full_name: "keepraw/Keepraw-Fly"}}' \
    | jq "${3:-.}" > "$1"
}
expect_ok() { # description args...
  local description=$1; shift
  [[ $(bash scripts/verify-release-source.sh "$@") == "$A" ]] || { echo "FAIL: $description" >&2; exit 1; }
  echo "ok - accepts $description"
}
expect_fail() { # description args...
  local description=$1; shift
  if bash scripts/verify-release-source.sh "$@" > "$work/out" 2>&1; then
    echo "FAIL: expected refusal: $description" >&2; exit 1
  fi
  echo "ok - refuses $description: $(tail -n1 "$work/out")"
}

ci_run "$work/ci.json" "$A"
expect_ok "CI, event and tag on one commit" "$work/ci.json" "$A" "$A"
expect_fail "a CI commit that differs from the release event commit" "$work/ci.json" "$B" "$A"
expect_fail "a tag that points at another commit" "$work/ci.json" "$A" "$B"
expect_fail "CI, event and tag all different" "$work/ci.json" "$B" "$C"
expect_fail "an abbreviated event SHA" "$work/ci.json" "${A:0:12}" "$A"
expect_fail "an abbreviated tag SHA" "$work/ci.json" "$A" "${A:0:12}"
ci_run "$work/bad.json" "$A" '.conclusion = "failure"'; expect_fail "a failed CI run" "$work/bad.json" "$A" "$A"
ci_run "$work/bad.json" "$A" '.status = "in_progress" | .conclusion = null'; expect_fail "an unfinished CI run" "$work/bad.json" "$A" "$A"
ci_run "$work/bad.json" "$A" '.conclusion = "cancelled"'; expect_fail "a cancelled CI run" "$work/bad.json" "$A" "$A"
ci_run "$work/bad.json" "$A" '.event = "pull_request"'; expect_fail "a pull_request CI run" "$work/bad.json" "$A" "$A"
ci_run "$work/bad.json" "$A" '.head_branch = "fix/x"'; expect_fail "a CI run on another branch" "$work/bad.json" "$A" "$A"
ci_run "$work/bad.json" "$A" '.path = ".github/workflows/fork-pages.yml"'; expect_fail "another workflow's run" "$work/bad.json" "$A" "$A"
ci_run "$work/bad.json" "$A" '.head_repository.full_name = "fork/Keepraw-Fly"'; expect_fail "a run built from a fork" "$work/bad.json" "$A" "$A"
ci_run "$work/bad.json" "$A" 'del(.head_sha)'; expect_fail "a run without head_sha" "$work/bad.json" "$A" "$A"
echo '{"message": "Not Found", "status": "404"}' > "$work/bad.json"; expect_fail "a missing CI run (404 body)" "$work/bad.json" "$A" "$A"
: > "$work/empty.json"; expect_fail "empty CI metadata" "$work/empty.json" "$A" "$A"
echo 'not json' > "$work/bad.json"; expect_fail "malformed CI metadata" "$work/bad.json" "$A" "$A"

# Part 2: the image job's own steps, extracted from release.yml in order.
node - "$work/steps" <<'NODE'
const { readFileSync, mkdirSync, writeFileSync } = require("node:fs");
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const release = readFileSync(".github/workflows/release.yml", "utf8");
const job = release.split("\n  image:\n")[1].split("\n  attach:\n")[0];
const steps = job
  .split("\n    steps:\n")[1]
  .split(/\n(?=      - )/)
  .filter((chunk) => chunk.startsWith("      - "));
steps.forEach((step, index) => {
  const uses = /^ {6}- uses: (\S+?)@/m.exec(step)?.[1] ?? /^ {8}uses: (\S+?)@/m.exec(step)?.[1];
  const run = /\n {8}run: \|\n([\s\S]*)$/.exec(step)?.[1];
  const file = `${out}/${String(index).padStart(2, "0")}`;
  if (uses) writeFileSync(`${file}.uses`, uses + "\n");
  else if (run) writeFileSync(`${file}.sh`, run.replace(/^ {10}/gm, ""));
  else throw new Error(`unrecognized step ${index}: ${step.slice(0, 80)}`);
});
NODE
source_step=$(grep -l 'verify-release-source.sh' "$work/steps"/*.sh 2>/dev/null | head -n1 || true)
[[ -n $source_step ]] || { echo "FAIL: release.yml image job does not run verify-release-source.sh" >&2; exit 1; }
for step in "$work/steps"/*; do
  [[ $step == "$source_step" ]] && break
  [[ $step == *.uses ]] && grep -qx 'actions/checkout' "$step" \
    || { echo "FAIL: only checkout may run before the source check: $(head -c 80 "$step")" >&2; exit 1; }
done
side_effects=$(grep -lE 'docker/|attest-build-provenance|upload-artifact' "$work/steps"/*.uses; grep -lE 'docker |gh release|curl ' "$work/steps"/*.sh || true)
for step in $side_effects; do
  [[ $(basename "$step") > $(basename "$source_step") ]] \
    || { echo "FAIL: side-effect step $(basename "$step") precedes the source check" >&2; exit 1; }
done
sed -n '/^  image:/,/^  attach:/p' .github/workflows/release.yml | grep -qE 'continue-on-error|if: .*(always|failure|cancelled)\(\)' \
  && { echo "FAIL: the image job must not continue after a failed step" >&2; exit 1; }
echo "ok - in release.yml only checkout runs before the source check; every push, signing and upload step follows it and the job cannot continue past a failure"

# Execute that exact step script with stand-ins: gh returns the CI fixture,
# git reports the checked-out commit, and the tag lookup returns TAG_SHA.
mkdir -p "$work/bin" "$work/repo/scripts"
cat > "$work/bin/gh" <<'MOCK'
#!/usr/bin/env bash
echo "gh $*" >> "$ACTION_LOG"
[[ $1 == api && $2 == repos/keepraw/Keepraw-Fly/actions/runs/101 ]] && cat "$CI_JSON"
MOCK
cat > "$work/bin/git" <<'MOCK'
#!/usr/bin/env bash
[[ $* == "rev-parse HEAD" ]] && echo "$GITHUB_SHA"
MOCK
for tool in docker curl; do printf '#!/usr/bin/env bash\necho "%s $*" >> "$ACTION_LOG"\n' "$tool" > "$work/bin/$tool"; done
printf '#!/usr/bin/env bash\necho "$TAG_SHA"\n' > "$work/repo/scripts/resolve-tag-commit.sh"
chmod +x "$work/bin/"*
cp scripts/verify-release-source.sh scripts/release-version.sh "$work/repo/scripts/"
cp --parents package.json apps/*/package.json packages/*/package.json compose.yaml deploy/Dockerfile \
  deploy/install.sh .github/workflows/fork-pages.yml docs/releases/*.md "$work/repo/"
job_case() { # ok|fail description ci-sha event-sha tag-sha
  local status=0
  ci_run "$work/job-ci.json" "$3"
  : > "$work/actions.log"; : > "$work/output"
  (cd "$work/repo" && PATH="$work/bin:$PATH" ACTION_LOG="$work/actions.log" CI_JSON="$work/job-ci.json" \
    GITHUB_SHA=$4 TAG_SHA=$5 GITHUB_REPOSITORY=keepraw/Keepraw-Fly GITHUB_OUTPUT="$work/output" CI_RUN_ID=101 \
    bash "$source_step") > "$work/job.out" 2>&1 || status=$?
  if [[ $1 == ok ]]; then
    [[ $status == 0 ]] && grep -qx "sha=$3" "$work/output" || { cat "$work/job.out" >&2; echo "FAIL: $2" >&2; exit 1; }
    echo "ok - job proceeds: $2"
  else
    [[ $status != 0 && ! -s $work/output ]] || { echo "FAIL: expected the job to stop: $2" >&2; exit 1; }
    ! grep -qE '^(docker|curl) ' "$work/actions.log" || { echo "FAIL: side effect after refusal: $2" >&2; exit 1; }
    echo "ok - job stops at the source check (no outputs, no push/sign/upload): $2"
  fi
}
job_case ok "CI, event and tag agree" "$A" "$A" "$A"
job_case fail "main moved past the chosen CI run" "$A" "$B" "$A"
job_case fail "tag points at another commit" "$A" "$A" "$B"
job_case fail "CI run for an older commit, tag on that commit, main ahead" "$B" "$A" "$B"
echo "PASS: release source consistency (fixtures and the workflow's own step; no GitHub or Sigstore calls)"
