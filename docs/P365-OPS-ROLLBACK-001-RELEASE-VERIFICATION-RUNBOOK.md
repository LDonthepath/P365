# P365-OPS-ROLLBACK-001 — Production release verification and rollback runbook

**Issue:** https://github.com/LDonthepath/P365/issues/334  
**Recovery roadmap:** https://github.com/LDonthepath/P365/issues/283  
**Ownership:** P365 owner approves every production promotion, rollback and re-enable of domain auto-assignment. This is an *operational procedure*, not an authorization to make a production change.  
**Scope:** Vercel application release/alias, deployment SHA, safe dashboard smoke checks and Supabase Cron compatibility. Supabase PostgreSQL/Market Memory recovery belongs to #331; GitHub branch protection belongs to #327.  
**Source baseline of this rehearsal:** main a3f97d0c03309e2d789308e4934b1fc2c4fba43b, 12 October 2026 WIB.

## 1. Release invariants / stop conditions

1. Owner merges a reviewed one-issue PR only after its required G0 test/typecheck/lint/build checks and any issue-specific acceptance tests pass. Do not treat a Vercel READY state as proof of test success or user-facing correctness.
2. Before changing production, snapshot and record: exact GitHub main SHA; intended PR/merge SHA; Vercel project/account; target production deployment ID and git SHA; *actual alias mapping*; previous eligible production deployment; latest relevant request/functional telemetry; Supabase pg_cron job definitions plus last **natural** outcomes. Distinguish a prior historical screenshot from a current check.
3. Deployment must have target=production, readyState=READY and matching GitHub commit *before* a deployment is accepted as a rollback or release target. Do **not** promote a protected preview as if it were a production build; promoting a preview can rebuild with production environment variables.
4. Application rollback never rolls back the append-only canonical Market Memory, observation revisions, Supabase schema/migrations, cron definitions, provider secrets, releasedAt/publishedAt/retrievedAt/captured_at history, or previously emitted events. Check backward compatibility first; if incompatible, **STOP** and request an explicit owner-approved forward fix/incident plan. No DELETE/TRUNCATE or replay to “undo” a release.
5. Supabase pg_cron remains the **only automatic ingestion scheduler**. GitHub Actions scheduler must not be re-enabled as a workaround. Never hit /api/cron/* in a release smoke or dry-run: those routes can mutate DB/provider budgets. Preserve cron Bearer guards.
6. Dashboard authentication bypass is an owner-authorized audit exception, **not** permission to expose private Server Actions, secrets, or admin endpoints. No silent auth-policy change.
7. This runbook does not mandate a real rollback for testing. Rehearsal is read-only. Owner alone makes the production-switch decision.

## 2. Measured read-only rehearsal — 12 October 2026 WIB

Verified via authenticated *read-only* GitHub and Vercel connector operations, without rollback, promotion, cron triggering, SQL writes, or a new deployment:

| Check | Observed result |
|---|---|
| GitHub main | a3f97d0c03309e2d789308e4934b1fc2c4fba43b (merged PR #389 / issue #305) |
| Vercel project | p365, project ID prj_zlQJeeLdOE0ES2fsoHfbvtde00qW, Node 24.x |
| Production alias lookup | p365-kappa.vercel.app resolves to deployment dpl_fqsyv3sYWgHky51iiCmxkSDtzJKM |
| Current production deployment | dpl_fqsyv3sYWgHky51iiCmxkSDtzJKM; target production; READY; Git source main, SHA exactly a3f97d0c03309e2d789308e4934b1fc2c4fba43b; region metadata icn1 |
| Immediately prior production | dpl_EJ7ncGFqvKhjZ4B155viNWZ3ez9Q; READY; source main@43985bfa6304664c33ffc5f0a8f3aa9f654ebb01; listed as eligible rollback candidate at inspection |
| Runtime log visibility | A 15-minute production error/fatal query returned *no matching logs*. A 60-minute read returned Vercel Hobby retention/API error; absence of a log is **not** proof of absence of incidents. |
| Production HTML/user journey | **NOT VERIFIED in this rehearsal**: external page fetch unavailable; no user-browser/mobile screenshot, data-parity proof or request timing claimed |
| Supabase cron/state and data parity | **NOT VERIFIED in this rehearsal**: read-only last-natural-run/sql compatibility evidence must be gathered for an actual release, without manually invoking cron |

**Ephemeral warning:** the SHA/deployment/alias IDs above are a *dated example*, not an instruction to roll back to those exact IDs in a future incident. Re-read the latest production alias and eligible deployment list at decision time. A Git main HEAD is not automatically the current production alias during a rollback/failure.

## 3. Normal post-merge production acceptance (mandatory)

Operator worksheet — fill actual UTC timestamps and full SHA at execution:

| Field | Required evidence |
|---|---|
| Issue / approved PR / merge time | Links; owner authorization; GitHub PR-head check run and full suite result |
| main SHA and source tree | Current GitHub exact merge SHA; diff/tree relationship to tested PR HEAD; no unrelated commits silently attributed |
| Deployment mapping | Vercel production project, deployment ID and Git SHA; READY; alias p365-kappa.vercel.app maps to **that same deployment** |
| Error and latency window | Exact interval, response codes and dashboard GET samples (N, p50/p95 if N adequate, missing-data/timeout notes); recent Vercel function errors/warnings, with retention limits and query failures disclosed |
| Trader-visible behavior | Real /dashboard HTTP status plus actual content, quality/source labels, BTC/Gold separation and mobile/desktop interaction where affected; Vercel READY/HTTP 200 alone is insufficient |
| DB and cron compatibility | **Read-only** pg_cron job configuration + last natural run/pg_net outcome, SQL role/access evidence if affected, canonical physical inserts/dedup receipts if relevant; HTTP 200 / pg_cron succeeded alone does not prove data persisted |
| Final disposition | VERIFIED/CLOSED only if each issue-specific gate passes; otherwise OPEN/BLOCKED with incident link and owner decision |

Sequence:

1. Check main, merge SHA, correct project/team, check-run status and expected release boundary. Do not trigger duplicate production deploys just for verification.
2. Inspect the production alias **and** deployment metadata independently; ensure the deployment Git SHA matches the accepted merged SHA. If Vercel has not deployed it or alias points elsewhere, mark **NOT DEPLOYED / BLOCKED**.
3. Run only public read-only GET smoke checks for /dashboard with request timestamps, status, content assertions and sample timing. If the dashboard GET initiates live provider reads, record the limitation and avoid mass requests. Never use /api/cron/*.
4. Inspect recent runtime logs at the shortest supported window (Hobby observed 15 minutes); record API errors separately. Correlate request IDs/path/time and mark inaccessible logs **UNKNOWN** rather than 0 errors. If relevant, inspect errors on the exact deployed SHA.
5. For data-affecting PRs, run SELECT-only checks of canonical counts, last qualified evidence, freshness/PIT and Supabase cron schedule + natural-run receipts. No manual cron invocation, SQL mutation or provider-paid probe. After a **docs-only** PR, this can be N/A with justification; do not claim a new physical insert.
6. Attach evidence to the owning issue and recovery roadmap #283. Close only after owner merge and the issue-specific post-merge verification.

## 4. Incident / rollback decision

**Possible triggers (investigate, not automatic):** reproducible dashboard 5xx or crash; material verified factual or point-in-time regression; verified secret/access exposure; systematic missing canonical data from a new release; severe sustained query timeout/performance regression; cron backward incompatibility. A single HTTP 200 or isolated latency sample is not a pass/fail threshold; compare with recorded base and affected paths.

**Decision gate:** Owner confirms (a) incident and intended recovery outcome; (b) current main vs current aliased deployment; (c) a *previous* eligible READY production deployment and its exact SHA; (d) source/API/schema/cron compatibility with current Supabase state; (e) whether reverting application code while leaving newer append-only records and migrations is safe. If any item is unknown, stop and choose a forward-compatible fix or containment review.

**Vercel Hobby limitation:** Official Vercel documentation states Hobby can Instant Rollback only to the *immediately previous production deployment*. Do not assume any older listed READY deployment is selectable. Plan entitlements must be checked by the owner at the point of incident. A rollback does not rewrite environment variables; earlier builds may have stale settings. See references.

**Execution is deliberately NOT part of this document-only issue.** The following are **operator-only, state-changing commands**, to be run *after explicit owner approval* in the correct authenticated Vercel scope/project:

~~~bash
# DO NOT RUN during a dry run or read-only verification.
# Confirm current deployment/previous eligibility with vercel inspect/list first.
vercel rollback
vercel rollback status

# After verifying the chosen current, healthy deployment and after OWNER approval:
# To undo a rollback/re-enable production auto-assignment via an approved promotion:
vercel promote <approved-production-deployment-id-or-url>
vercel promote status
~~~

Important: rollback changes production routing, **not GitHub main**. Reconcile the source-of-truth via a separate reviewed fix/revert PR if necessary; never force-push main. Vercel documentation states rollback suspends automatic production-domain assignment. Merging more PRs may produce READY deployments **without becoming current production** until the owner deliberately restores normal behavior. Inspect the alias *after every operation*; do not assume auto-assign is back.

## 5. Supabase and release safety

- Supabase pg_cron is external to Vercel release promotion; retain its sole scheduler ownership, current job definitions, Bearer-protected HTTP targets and DB privileges. Vercel Instant Rollback docs about platform cron configuration do **not** imply that Supabase pg_cron definitions are reverted.
- Before selecting an old build, compare route names/request schema/token expectations, data read contract, queries, migrations and supported record families. Old code that cannot read current canonical data is **not a safe rollback** merely because the deployment is READY.
- Do not claim a failed ingestion incident from an EMPTY response without provider qualification and physical INSERT/dedup evidence. #242 and #312 own exact write receipts.
- A production rollback cannot restore lost/deleted canonical data; DB backups/restores require #331's separate safe drill and owner decision.

## 6. Non-mutative rehearsal checklist and acceptance state

- [x] Verified exact main SHA, current alias → current READY production deployment, matching SHA and project.
- [x] Identified immediate prior READY production deployment and eligibility metadata; no assumption of ability to switch to arbitrary older builds.
- [x] Verified current short-window error/fatal log query returned no matching logs; recorded 60-minute Hobby/log API failure as UNKNOWN.
- [x] Recorded no real rollback/promotion and no cron/DB/provider mutation.
- [x] Defined operator decision, failure/rollback branches, owner approval, Hobby constraint, auto-assignment recovery and issue post-merge evidence fields.
- [ ] **Owner review** of rollback triggers/permission boundaries and acceptance of this rehearsal's **unverified live dashboard and Supabase checks**.
- [ ] PR-head required G0 CI for this documentation-only change and owner-controlled merge.
- [ ] Post-merge exact main, production alias and relevant nonmutative acceptance documented; only then #334 can close completed.

**Rehearsal verdict:** evidence supports a documented recovery procedure and read-only alias/SHA rollback-candidate check, **not** a successful end-to-end real rollback, dashboard functional parity or proof of cron correctness. Do not label those unverified gates PASS.

## 7. Official Vercel references

- https://vercel.com/docs/deployments/rollback-production-deployment (rollback execution and Hobby previous-deployment limit)
- https://vercel.com/docs/cli/rollback (rollback/status and undo)
- https://vercel.com/docs/instant-rollback (automatic domain reassignment disabled after rollback; retained build configuration)
- https://vercel.com/docs/deployments/promoting-a-deployment (promotion, production build vs preview rebuild)
- https://vercel.com/docs/cron-jobs/manage-cron-jobs (Vercel cron policies are distinct from P365's Supabase pg_cron ownership)
