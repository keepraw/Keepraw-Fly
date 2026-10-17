# Repository agent instructions

These instructions apply to AI coding agents working on Keepraw-Fly. Product
changes are subject to the ordinary test and review process; identity checks
are an additional requirement, not a replacement.

## Maintainer-directed Git commits

When working **on behalf of the repository owner**, create new local commits
using only the Git identity of the `keepraw` account. Before committing in each
new clone or worktree, configure the repository-local identity:

```bash
git config --local user.name keepraw
git config --local user.email 49091395+keepraw@users.noreply.github.com
git config --local user.useConfigOnly true
git var GIT_AUTHOR_IDENT
git var GIT_COMMITTER_IDENT
```

Verify that **both effective identities** resolve to `keepraw` and the no-reply
address. `GIT_AUTHOR_*`, `GIT_COMMITTER_*`, `EMAIL`, command-line `-c`,
`--author`, and other Git overrides can defeat local settings. If anything
conflicts, stop and correct the environment **before** creating a commit.
Inspect the actual author and committer of each created commit before pushing.
Never silently overwrite a genuine outside contributor's authorship.

For GitHub API or hosted-agent commits, inspect the resulting GitHub author and
committer mapping before proposing a merge. If the GitHub author account is not
`keepraw` for a maintainer-authored change, stop and investigate. GitHub's
squash-and-merge editor can automatically copy `Co-authored-by` trailers from
original PR commits: review the proposed merge message before confirming it.
Do not add the previous `zzvw` account or `forgottenpedestrian@gmail.com` to
any commit identity or attribution trailer. Keep legitimate external authors
and co-authors attributed accurately.

The CI identity guard validates all original PR commits and main push commits;
its separate `pull_request_target` workflow reads the trusted base revision.
An identity check failure is not an instruction to bypass CI or edit GitHub
metadata: repair the source PR commits and rerun validation. Never rewrite
`main`, move published release tags, or republish artifacts as an identity fix.
