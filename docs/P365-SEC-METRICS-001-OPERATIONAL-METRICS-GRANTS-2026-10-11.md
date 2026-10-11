# RECOVERY-G5-01 / SEC-METRICS-001 — Operational Metrics Table Privilege Hardening

**Issue:** #310 · **Baseline:** main at d12cd9e1f7d93761500a0508d5d2fbe5cf6abe15 · **Date:** 11 Oct 2026 (WIB)
**Change stage:** **PRODUCTION-ACTIVE — migration APPLIED under explicit owner instruction while PR #358 remains OPEN**. Postflight 28/28 PASS; next natural post-change cron run remains pending.
**Supabase project:** orwhuzexnuochctccqvl. **Production deployment baseline:** dpl_8SjCf7pGDhFcs2QPbNeKdkBdNVZK (READY, same SHA).

## Live baseline — production SELECT-only SQL, 11 Oct 2026

Target relation public.p365_operational_metrics: owner postgres; RLS enabled; FORCE RLS false; zero policies; zero explicit per-column ACLs; 7 retained rows (last daily occurred_at 2026-10-11 00:00 UTC). ACL direct: postgres, anon, authenticated, service_role each have all seven privileges (arwdDxtm). No PUBLIC direct grant.

| Effective privileges | SELECT | INSERT | UPDATE | DELETE | TRUNCATE | REFERENCES | TRIGGER |
|---|---|---|---|---|---|---|---|
| anon BEFORE | Y | Y | Y | Y | **Y** | Y | Y |
| authenticated BEFORE | Y | Y | Y | Y | **Y** | Y | Y |
| service_role BEFORE | Y | Y | Y | Y | Y | Y | Y |
| postgres BEFORE | Y | Y | Y | Y | Y | Y | Y |
| anon AFTER (**verified 03:39:23 UTC**) | N | N | N | N | N | N | N |
| authenticated AFTER (TARGET, **not verified**) | N | N | N | N | N | N | N |
| service_role AFTER (TARGET, **not verified**) | Y | Y | Y | Y | Y | Y | Y |
| postgres AFTER (TARGET, **not verified**) | Y | Y | Y | Y | Y | Y | Y |

**Actual risk:** TRUNCATE is outside PostgreSQL row-level security. Despite RLS currently denying ordinary row reads/writes for public roles, table-level TRUNCATE is granted. This is a confirmed SQL authorization exposure; no actual attempted abuse or HTTP exploit was tested or claimed. SQL grants also unnecessarily expose DDL-associated TRIGGER and REFERENCES.

**Consumption proof:** cron.job #23 p365-storage-daily is active, runs at \`15 0 * * *\` as postgres, and is the only cron command referencing the table. No stored user-defined function referencing the table was discovered in a text search of pg_proc; this search is not a complete client dependency graph. Production code includes the server-side daily storage cron SQL in scripts/ops/ops_free_001a_storage_guardrail.sql. Direct service_role and postgres grants remain unchanged.

**Supabase advisor:** \`rls_enabled_no_policy\` INFO for this table is consistent with intentional deny-by-default public access and is not independently an exploit. Other advisor findings unrelated to this issue are intentionally left untouched.

## Applied atomic fix and rollback

1. Source: [scripts/ops/sec_metrics_001_revoke_operational_metrics.sql](../scripts/ops/sec_metrics_001_revoke_operational_metrics.sql). Fail-closed preflight verifies table ownership/RLS/no policies/no column ACL/no PUBLIC direct grants, all seven baseline privileges for four roles, and exact job identity. REVOKE ALL table privileges FROM PUBLIC, anon, authenticated only. Postflight verifies public zero grants and service_role/postgres unchanged. No function ACL or cron changes.
2. Read-only verifier: [scripts/ops/sec_metrics_001_readonly_verify.sql](../scripts/ops/sec_metrics_001_readonly_verify.sql); collect actual output immediately before/after migration and after a **natural** daily cron run.
3. Emergency-only rollback: [scripts/ops/sec_metrics_001_emergency_rollback.sql](../scripts/ops/sec_metrics_001_emergency_rollback.sql); explicitly re-grants the previous seven privileges to anon/authenticated after a guarded preflight. **Rollback re-opens TRUNCATE exposure**; requires separate owner authorization and follow-up hardening.

**Owner-directed activation exception (11 Oct 2026):** the owner explicitly instructed activating the change within this existing PR, before merge. Supabase `apply_migration` applied the exact unchanged PR SQL source **once**, succeeded, and recorded version **20261011033906** with name `sec_metrics_001_revoke_operational_metrics_20261011`. The migration contains no BEGIN/COMMIT; Supabase managed the atomic operation. Production SQL was applied before owner merge; the PR is still OPEN, and only the owner may merge it. No cron invocation or external HTTP request was made.

## Verification / closure gate

- [x] Live BEFORE matrix and RLS/column ACL measured via SELECT only.
- [x] Cron identity and authorized role grants measured via SELECT only.
- [x] Initial implementation HEAD `f130835` CI G0 run #38108867649 **SUCCESS**: 139 test files, 502 PASS / 0 FAIL; TypeScript PASS; lint PASS (0 errors, 3 existing warnings); Next.js build PASS (10/10 pages). Vercel preview exact HEAD READY. Recheck final evidence-documentation HEAD CI after committing this receipt.
- [x] Owner explicitly authorized production SQL application within PR #358 (before merge); **merge remains owner-pending**.
- [x] Supabase migration version `20261011033906` applied successfully; production AFTER effective privilege matrix **28/28 PASS, 0 FAIL** at 2026-10-11 03:39:23 UTC.
- [x] anon/authenticated: all seven privileges false, including TRUNCATE; service_role/postgres: all seven true; RLS enabled, FORCE RLS false, no policies/column ACLs. Three legacy RPC EXECUTE permissions from #330 unchanged.
- [ ] **After-activation natural cron proof still pending.** Today’s run #40519 at 2026-10-11 00:15 UTC already succeeded (`INSERT 0 1`) **before** 03:39 UTC migration. Existing seven capacity rows and latest 2026-10-11 daily row were unchanged by migration. Next natural run scheduled 2026-10-12 00:15 UTC; afterward verify success and a NEW persisted daily row without manually triggering it.
- [ ] After owner merge, record main/production deployment SHA and post-activation natural cron receipt before closing #310.

**Explicit exclusions:** no function privilege changes (#330); no dashboard auth changes (#311); no canonical Market Memory alteration, retention, scheduler modification, service key export, public API experimentation, or external dependency. Test file uses static SQL contract assertions; it is **not** a substitute for running SQL against Postgres and verifying actual role behavior.


## Production activation receipt — 11 Oct 2026 UTC

- **Owner authorization:** requested activation within PR #358 on 11 October. No separate issue or PR opened.
- **Before SELECT-only check:** 03:38:57.487619 UTC; direct table ACL \`{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}\`; role matrix 28 existing granted. Table owner \`postgres\`, RLS ON, FORCE RLS OFF, zero policies, zero column ACLs; 7 rows and latest metric \`2026-10-11 00:00:00Z\`.
- **Applied migration:** \`20261011033906\` \`sec_metrics_001_revoke_operational_metrics_20261011\`; Supabase migration API returned \`{"success":true}\`. Exact source bytes remain in \`scripts/ops/sec_metrics_001_revoke_operational_metrics.sql\` unchanged, including its historical pre-application comment.
- **After SELECT-only check:** 03:39:23.172269 UTC. **28/28 PASS**: both public roles 0/7; both authorized roles 7/7. ACL \`{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}\`. Owner, RLS, policies, column ACLs, cron metadata and metrics row count unchanged.
- **Legacy RPC check:** \`append_market_memory\`, \`calculate_oms_and_save\`, \`process_market_snapshot\`: anon/authenticated EXECUTE false; service_role EXECUTE true. No function ACL modified by this migration.
- **Cron SQL readback:** job ID 23, \`p365-storage-daily\`, ACTIVE, schedule \`15 0 * * *\`, runner \`postgres\`; latest run #40519 at 2026-10-11 00:15:00–00:15:03 UTC: \`succeeded\`, \`INSERT 0 1\`. Historical prior-run proof ONLY. Next natural execution post-migration not yet observed.
- **Security Advisor:** \`rls_enabled_no_policy\` remains INFO as an intentional default deny; pre-existing legacy function search_path WARN outside scope (#330), no new policy added.

**Do not confuse:** migration SUCCESS + permission matrix PASS is **actual privilege hardening proof**. It is **not** proof that a scheduled post-migration INSERT has already executed. Until the next scheduled job has physically persisted its new daily row and the owner merges PR #358, issue #310 remains open for verification.
