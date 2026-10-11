# P365-CI-BRANCH-001 — main required status-check protection

**Issue:** [#327](https://github.com/LDonthepath/P365/issues/327)  
**Status:** `OWNER-ADMIN-ACTIVATION-PENDING` — this PR cannot change GitHub branch settings.  
**Baseline:** `main@f93355bc0b0f6a372a41d27dec01e74ee7205292` (11 October 2026 UTC).  
**Scope:** unique check-run identity and evidence-backed operator activation guide; **no change to test commands, workflow triggers, product code, canonical data, cron or deployment**.

## Grounded live evidence (before changes)

- GitHub `GET /repos/LDonthepath/P365/branches/main` returned `protected: true`, `protection.enabled: true`, but `required_status_checks.enforcement_level: "off"`, `contexts: []`, `checks: []`. Thus `protected=true` does **not** prove required CI is enforced.
- `GET /repos/LDonthepath/P365/rulesets` returned `[]` on this connected GitHub account. This does **not** rule out other protections that require a higher permission to inspect.
- `GET /repos/LDonthepath/P365/branches/main/protection` and `.../required_status_checks` returned `403 Resource not accessible by integration`. The connected GitHub App has **no repository administration access** for the necessary settings write/read; do not mark config verified or attempt indirect write.
- `GET .../commits/124bfb06de57a61a2c0be652aaabf2c5e38a21b2/check-runs` for the merged #352 PR's pre-merge HEAD returned **two different GitHub Actions check-runs named `verify`**: one from `recovery-g0-quality.yml` run [#38101354463](https://github.com/LDonthepath/P365/actions/runs/38101354463), one from path-filtered `verify-data-ecb-boj.yml` run [#38101354548](https://github.com/LDonthepath/P365/actions/runs/38101354548). Both happened to pass on that PR. Selecting `verify` as required is ambiguous and dangerous.
- `.github/workflows/recovery-g0-quality.yml`: unconditional `pull_request` trigger, Node 24, `npm ci`, full test/typecheck/lint/build, fail-closed final shell gate; its job ID was `verify`.
- `.github/workflows/verify-data-ecb-boj.yml`: `pull_request.paths` filter and job ID `verify`. **Do not add this filtered `verify` as a required check**; on other PRs it will not run and may stay pending.
- Neither `Vercel` success nor a `main` merge commit by itself is proof that the whole CI suite was enforced.

**GitHub docs:** [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches), [Managing branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule), and [Troubleshooting required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks). GitHub advises unique job names across workflows, and cautions against requiring path-filtered workflows.

## Change in this PR

Only G0 job **display name** becomes **`recovery-g0-verify`** while its YAML job ID remains `verify`. It continues to run for every PR, to perform the exact same `npm ci`, test/typecheck/lint/build and final gate. The existing path-filtered ECB/BoJ job remains `verify` and is **not** required.

The PR's own G0 run after this change must prove through `/commits/{PR_HEAD}/check-runs` that `recovery-g0-verify` appears **once**, is emitted by `github-actions`, and **succeeds**. Record exact SHA/run ID. Run G0 typecheck, full test, lint and build through Actions; report real failures if any.

## Owner steps (after PR merge, owner-admin required)

Open **[Repository Settings → Branches](https://github.com/LDonthepath/P365/settings/branches)** as the repository owner (or navigate Settings → Rules → Rulesets if existing rules are managed there). **Inspect the existing rule targeting `main` before editing; do not accidentally create conflicting overlapping rules.** Do not enable extra restrictions unrelated to the issue.

1. Choose the rule targeting exactly `main`, or create one only if inspection confirms no matching rule. Preserve other existing requirements.
2. Enable **Require a pull request before merging** for `main`. Preserve owner-controlled manual merge; do not enable GitHub auto-merge. If this is a single-maintainer repo, **do not set a mandatory approval count requiring a second unavailable reviewer**. If a second independent reviewer actually exists, agree on approvals separately.
3. Enable **Require status checks to pass before merging**. Select exactly **`recovery-g0-verify`** provided by **GitHub Actions**, *after* a successful check has appeared on the current PR/main. Also select **Require branches to be up to date before merging** (strict) so approval cannot use stale checks. Do **not** select generic `verify` (duplicate, one path-filtered), the filtered ECB/BoJ check, or `Vercel Preview Comments`.
4. Disable **Allow force pushes** and **Allow deletions**. Enable **Do not allow bypassing the above settings** for admins if the owner intends no direct push or unchecked override (this is required to make the "no direct main pushes" policy apply to an administrator). Do not enable a merge queue unless G0 adds a `merge_group` trigger in a separate approved change.
5. Save. **Record Settings screenshot** (exact branch pattern, required check name, strict=true, PR rule, owner bypass policy, force push/delete policy), omitting any sensitive information. GitHub Actions workflow configuration and admin rule are separate pieces: merging this PR **does not activate protection**.

### Mandatory post-activation readback

- From owner/admin GitHub UI inspect the rule after Save. The connected GitHub App's GET `/branches/main/protection` may still return 403; use owner screenshot or admin-authorized REST output. Non-admin `branches/main` metadata alone is insufficient.
- Create a tiny **subsequent, independent test PR** only if owner approves such a test. It must display **`recovery-g0-verify`** as required. While pending, the merge button is blocked; after successful latest-head check and any required update with `main`, merge can proceed **only after owner review**. This is a protected-rules validation checkpoint, not permission to merge an unreviewed PR.
- If G0 genuinely fails, merge must be blocked; **do not intentionally break production/test workflows** to simulate failure. A safe pending-check observation suffices.
- Check `GET /repos/LDonthepath/P365/branches/main` still returns `protected=true`, and after owner settings save the required check is shown as `recovery-g0-verify` with strict/up-to-date. If the policy does not enforce, leave #327 **BLOCKED** and attach screenshot or mismatch. A passing run alone is not enough.
- No Supabase, provider, database, Vercel or market-data runtime verification is necessary for this GitHub administration-only change.

## Rollback / risks

- Workflow rename can cause formerly configured required check `verify` to be permanently Pending. **Confirm current required checks were empty before merge and inspect owner rules before/after.** If `verify` was made required elsewhere after baseline, correct the admin setting as part of activation before enabling `recovery-g0-verify`.
- To roll back, owner may remove the new required-check selection in Settings (restoring the previous enforcement configuration), then revert the G0 display-name commit via a reviewed PR. Do not loosen unrelated protections silently or force-push `main`.
- `Require pull request` with required approving reviews may block a solo owner. Keep manual owner merge workflow while avoiding an impossible approval requirement.
- Do not require ECB/BoJ path-filtered `verify`; it can be absent on normal code/docs PRs.

## Closure gates

- [ ] PR-head G0 successfully reports new unique **`recovery-g0-verify`**; full suite PASS.
- [ ] Owner reviews and merges the one-issue-one-PR change.
- [ ] Owner/admin enables the rule, saves screenshot/API evidence of PR requirement, strict required check, no force-push/delete, and bypass configuration.
- [ ] Owner/admin proves a new PR cannot merge with a pending/missing required check, and can merge after it passes (without bypass); actual `main` and branch rule re-read.
- [ ] Issue #327 updated to `VERIFIED` and `CLOSED (completed)` **only after** activation proof, not PR creation/merge alone; update roadmap #283.

**No admin permission is available in the connected GitHub App; owner settings activation is a real BLOCKER, not an omitted implementation step.**
