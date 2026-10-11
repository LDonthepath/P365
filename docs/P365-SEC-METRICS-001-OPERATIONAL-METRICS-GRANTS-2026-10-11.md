# RECOVERY-G5-01 / SEC-METRICS-001 — Operational Metrics Table Privilege Hardening

**Issue:** #310 · **Baseline:** main at d12cd9e1f7d93761500a0508d5d2fbe5cf6abe15 · **Date:** 11 Oct 2026 (WIB)
**Change stage:** migration prepared on branch, **NOT APPLIED** to production.
**Supabase project:** orwhuzexnuochctccqvl. **Production deployment baseline:** dpl_8SjCf7pGDhFcs2QPbNeKdkBdNVZK (READY, same SHA).

## Live baseline — production SELECT-only SQL, 11 Oct 2026

Target relation public.p365_operational_metrics: owner postgres; RLS enabled; FORCE RLS false; zero policies; zero explicit per-column ACLs; 7 retained rows (last daily occurred_at 2026-10-11 00:00 UTC). ACL direct: postgres, anon, authenticated, service_role each have all seven privileges (arwdDxtm). No PUBLIC direct grant.

| Effective privileges | SELECT | INSERT | UPDATE | DELETE | TRUNCATE | REFERENCES | TRIGGER |
|---|---|---|---|---|---|---|---|
| anon BEFORE | Y | Y | Y | Y | **Y** | Y | Y |
| authenticated BEFORE | Y | Y | Y | Y | **Y** | Y | Y |
| service_role BEFORE | Y | Y | Y | Y | Y | Y | Y |
| postgres BEFORE | Y | Y | Y | Y | Y | Y | Y |
| anon AFTER (TARGET, **not verified**) | N | N | N | N | N | N | N |
| authenticated AFTER (TARGET, **not verified**) | N | N | N | N | N | N | N |
| service_role AFTER (TARGET, **not verified**) | Y | Y | Y | Y | Y | Y | Y |
| postgres AFTER (TARGET, **not verified**) | Y | Y | Y | Y | Y | Y | Y |

**Actual risk:** TRUNCATE is outside PostgreSQL row-level security. Despite RLS currently denying ordinary row reads/writes for public roles, table-level TRUNCATE is granted. This is a confirmed SQL authorization exposure; no actual attempted abuse or HTTP exploit was tested or claimed. SQL grants also unnecessarily expose DDL-associated TRIGGER and REFERENCES.

**Consumption proof:** cron.job #23 p365-storage-daily is active, runs at \`15 0 * * *\` as postgres, and is the only cron command referencing the table. No stored user-defined function referencing the table was discovered in a text search of pg_proc; this search is not a complete client dependency graph. Production code includes the server-side daily storage cron SQL in scripts/ops/ops_free_001a_storage_guardrail.sql. Direct service_role and postgres grants remain unchanged.

**Supabase advisor:** \`rls_enabled_no_policy\` INFO for this table is consistent with intentional deny-by-default public access and is not independently an exploit. Other advisor findings unrelated to this issue are intentionally left untouched.

## Proposed atomic fix

1. Source: [scripts/ops/sec_metrics_001_revoke_operational_metrics.sql](../scripts/ops/sec_metrics_001_revoke_operational_metrics.sql). Fail-closed preflight verifies table ownership/RLS/no policies/no column ACL/no PUBLIC direct grants, all seven baseline privileges for four roles, and exact job identity. REVOKE ALL table privileges FROM PUBLIC, anon, authenticated only. Postflight verifies public zero grants and service_role/postgres unchanged. No function ACL or cron changes.
2. Read-only verifier: [scripts/ops/sec_metrics_001_readonly_verify.sql](../scripts/ops/sec_metrics_001_readonly_verify.sql); collect actual output immediately before/after migration and after a **natural** daily cron run.
3. Emergency-only rollback: [scripts/ops/sec_metrics_001_emergency_rollback.sql](../scripts/ops/sec_metrics_001_emergency_rollback.sql); explicitly re-grants the previous seven privileges to anon/authenticated after a guarded preflight. **Rollback re-opens TRUNCATE exposure**; requires separate owner authorization and follow-up hardening.

**Deployment gate:** owner reviews and merges PR first. Obtain explicit owner approval for Supabase production migration, then run migration **once via Supabase apply_migration**. The file intentionally does not embed BEGIN/COMMIT; managed migration controls atomicity. Never apply DDL via a read-only inventory operation. Preserve migration version/receipt. No cron invocation; wait for next scheduled execution.

## Verification / closure gate

- [x] Live BEFORE matrix and RLS/column ACL measured via SELECT only.
- [x] Cron identity and authorized role grants measured via SELECT only.
- [ ] Exact PR HEAD tests/typecheck/lint/build/CI — report results honestly.
- [ ] Owner merges PR and authorizes SQL production application.
- [ ] Migration applied atomically; actual AFTER permissions measured for all 28 role/privilege cells.
- [ ] No unauthorized public TRUNCATE, no RLS/policy/column ACL drift, service_role/postgres intact.
- [ ] Natural subsequent \`p365-storage-daily\` run shows success **and** a new durable STORAGE_CAPACITY row; review cron job_run_details and metrics table without write endpoints.
- [ ] Record applied version, post-merge main/deployment SHA and runtime proof before closing #310.

**Explicit exclusions:** no function privilege changes (#330); no dashboard auth changes (#311); no canonical Market Memory alteration, retention, scheduler modification, service key export, public API experimentation, or external dependency. Test file uses static SQL contract assertions; it is **not** a substitute for running SQL against Postgres and verifying actual role behavior.
