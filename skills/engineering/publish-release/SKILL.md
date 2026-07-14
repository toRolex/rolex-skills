---
name: publish-release
description: Use when the user says 发版/发布/release/publish/bump version/tag, or wants to cut a release from develop.
---

# Publish Release

Cut a release from `develop` through Git Flow: bump version on a release branch, open a PR to `main`, merge, then sync `main` back into `develop` and tag `main`.

## Preconditions

Before starting:

- You are inside a git repository with `origin` configured.
- The `gh` CLI is installed and authenticated.
- `main` is protected; all releases land through a PR.
- `develop` can be merged into locally for sync-back. If `develop` is also protected, run this skill to the PR-to-main step, then open a separate sync-back PR from `main` to `develop`.
- `develop` contains everything meant for this release.
- The user has confirmed the new version. Default is patch bump (`+0.0.1`).

## Process

### 1. Resolve the new version

```bash
git tag --sort=-version:refname | head -3
```

Take the latest tag as the baseline, apply the user's bump rule, and record the new version as `vX.Y.Z`.

Completion: a concrete `vX.Y.Z` is chosen and confirmed with the user if it differs from the default.

### 2. Detect version files

Find files in the repo root that carry the project's version. Check, in order:

- `pyproject.toml`
- `package.json`
- `Cargo.toml`

Record which exist. At least one must be present.

Completion: the list of version files to bump is fixed.

### 3. Sync develop and open the release branch

First, ensure `develop` is up to date with `/safe-pull`:

```bash
git checkout develop
# /safe-pull
```

Then cut the release branch:

```bash
git checkout -b release/X.Y.Z
```

Completion: `develop` is synced with remote; the branch `release/X.Y.Z` exists and is checked out.

### 4. Bump the version

Update the `version` field in every detected version file to `X.Y.Z` (no `v` prefix). Then commit:

```bash
git add <version-files>
git commit -m "chore: bump version to X.Y.Z"
```

Completion: every detected version file reads `X.Y.Z`; the bump commit is on `release/X.Y.Z`.

### 5. Draft release notes

Generate the raw change list from the previous tag:

```bash
git log <previous-tag>..develop --oneline
```

Write the release notes following the format in [RELEASE_NOTES.md](RELEASE_NOTES.md). Group commits into:

- **Added** — new features
- **Changed** — changes in existing functionality
- **Fixed** — bug fixes
- **Removed** — deprecated or removed features
- **Security** — vulnerability fixes

Save the release notes to a file for later use:

```bash
cat > /tmp/release-notes-vX.Y.Z.md << 'EOF'
## vX.Y.Z (YYYY-MM-DD)

### Added
- ...

### Fixed
- ...

EOF
```

Completion: a release notes file exists at `/tmp/release-notes-vX.Y.Z.md`, ready for the PR body and GitHub Release.

### 6. Push the release branch

```bash
git push -u origin release/X.Y.Z
```

Completion: `release/X.Y.Z` is on `origin`.

### 7. Open PR to main (remote)

Fetch the latest `main` from remote, then create a PR targeting the **remote** `main` branch via GitHub CLI. `gh pr create --base main` always resolves to the `main` branch on the remote repository — do **not** check out or merge into local `main`.

```bash
git fetch origin main
gh pr create --base main --head release/X.Y.Z
```

The PR body must include the version bump and the grouped release notes.

Completion: a PR from `release/X.Y.Z` to `origin/main` is open; its number is recorded.

### 8. Hand off for review

Stop and report the PR URL and a summary of the release. The user reviews and merges the PR through the GitHub UI or another approved channel — do **not** merge locally into `main` and do **not** call `gh pr merge` automatically. All merges to `main` go through GitHub's remote PR merge.

Completion: the PR URL and release summary have been reported to the user; the agent stops and waits for merge confirmation.

### 9. QA gate

Once the PR is merged (the merge commit now exists on `origin/main`), deploy the merged code to staging and run QA before tagging.

Generate a QA test plan with `/qa-plan` — it defaults to "changes since the last tag", which matches the release scope exactly:

```
/qa-plan
```

Execute the QA plan on staging. If issues are found, fix them on the release branch (or a new feature branch), re-merge, and re-run QA. Do **not** tag until QA passes.

Completion: QA plan is generated and all P0/P1 items pass on staging.

### 10. Fetch the merge commit from origin/main and tag

Once QA passes, fetch `origin/main` to get the merge commit, check it out as a detached HEAD (or create a local tracking branch if needed), and tag it. Do **not** make any local changes to `main`.

```bash
git fetch origin main
git checkout main       # creates local tracking branch from origin/main if needed
git merge --ff-only origin/main  # fast-forward to exact merge commit
git tag vX.Y.Z
git push origin vX.Y.Z
```

If local `main` does not exist yet, `git checkout main` auto-creates it from `origin/main`. If it does exist and is behind, `git merge --ff-only origin/main` advances it without creating a merge commit.

Completion: `vX.Y.Z` exists on `origin` and points to the merge commit on `origin/main`.

### 11. Publish GitHub Release

Create a GitHub Release using the release notes drafted in Step 5:

```bash
gh release create vX.Y.Z \
  --title "vX.Y.Z" \
  --notes-file /tmp/release-notes-vX.Y.Z.md
```

If this is a pre-release (alpha, beta, rc), add `--prerelease`. For the first major release or significant milestones, also add the `--latest` flag explicitly.

Completion: the GitHub Release is published with full release notes at the release URL.

### 12. Sync-back to develop

```bash
git checkout develop
git fetch origin main
git merge origin/main --no-edit
git push origin develop
```

Completion: `develop` HEAD contains the version bump and the tagged release commit from `origin/main`.

### 13. Verify

Run these checks and confirm each passes:

```bash
git tag --sort=-version:refname | head -3           # vX.Y.Z is the latest
git log origin/main -1 --oneline                    # origin/main points to the tag
git log origin/develop -1 --oneline                 # origin/develop is up to date with main
gh pr view <PR_NUMBER> --json state                 # state is MERGED
gh release view vX.Y.Z --json name,tagName          # release is published
```

Completion: all five checks return the expected result.

## Reference

- **Source of truth**: the git tag is the canonical version; version files are mirrors. **Tags must always point to a commit on `origin/main`**, never on a release branch, local `main`, or develop.**Every commit on `origin/main` must have a tag** — main is always in a tagged, releasable state.
- **Remote-first**: all operations involving `main` must reference `origin/main` (fetch, checkout tracking branch, merge-ff from remote). Never make direct commits or local merge commits on `main`.
- **Sync-back**: merging `origin/main` into `develop` after the tag is required. Skipping it loses the bump on `develop` and breaks the next release.
- **Protected develop**: if `develop` is protected too, stop after step 8 and open a second PR from `origin/main` to `develop` to perform the sync-back.
- **Release branch life**: create → bump → PR to main → merge via GitHub → tag on the merge commit → sync-back. The release branch can be deleted after the PR is merged.
- **Bump scope**: only change `version` fields. Keep the release branch to version changes only.
