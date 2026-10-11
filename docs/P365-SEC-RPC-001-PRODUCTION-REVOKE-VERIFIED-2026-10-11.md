# SEC-RPC-001 — Owner-approved production EXECUTE hardening receipt

**Issue:** [#330](https://github.com/LDonthepath/P365/issues/330) · **Roadmap:** [#283](https://github.com/LDonthepath/P365/issues/283) · **Date:** 11 October 2026 · **State:** APPLIED TO PRODUCTION AND SQL-VERIFIED. This receipt supersedes the original [read-only audit's](P365-SEC-RPC-001-LEGACY-EXECUTE-AUDIT-2026-10-11.md) preliminary status; the initial audit remains as contemporaneous pre-change evidence.

## Scope and authorization

The owner confirmed **“Sesuai rekomendasi saja”** after the recommendation to revoke `EXECUTE` from `PUBLIC`, `anon`, and `authenticated` for exactly three legacy RPCs, while preserving `service_role`. This authorizes the production grants change, **not** self-merge or unrelated changes.

- Supabase production project: `orwhuzexnuochctccqvl`.
- Migration name: `sec_rpc_001_revoke_legacy_rpc_execute_20261011`.
- Migration history version: **`20261011021332`** (verified in production `list_migrations`).
- Execution: Supabase `apply_migration` returned success; the migration contains strict preflight and postflight privilege assertions.
- **Exact SQL submitted:** [`scripts/ops/sec_rpc_001_production_revoke_20261011.sql`](../scripts/ops/sec_rpc_001_production_revoke_20261011.sql).
- Existing original ACL export, authorized rollback SQL, caller inventory and limits: [initial qualification](P365-SEC-RPC-001-LEGACY-EXECUTE-AUDIT-2026-10-11.md).

## Verified before → after (actual live PostgreSQL catalog)

| Exact function identity (public schema) | Before anon/auth/service EXECUTE | After anon/auth/service EXECUTE | After postgres EXECUTE |
|---|---|---|---|
| `append_market_memory(text,text,text,timestamptz,timestamptz,jsonb,text[],text[],text[],text,text)` | true / true / true | **false / false / true** | true |
| `calculate_oms_and_save(double precision × 5)` | true / true / true | **false / false / true** | true |
| `process_market_snapshot(numeric × 4)` | true / true / true | **false / false / true** | true |

**Independent readback:** **2026-10-11 02:13:42 UTC**. All three `proacl` values are now exactly `{postgres=X/postgres,service_role=X/postgres}`; previous `PUBLIC`, `anon`, `authenticated` entries are absent. All three retain `SECURITY INVOKER`. The result is a verified least-privilege remediation, **not** proof of a previous exploitable anonymous write.

**Continuity readback:** at **2026-10-11 02:14:34 UTC**, `service_role` continues to have EXECUTE on the separate `public.p365_insert_fred_observations_v1(jsonb)`; service-role `market_memory` SELECT+INSERT remain true, anon INSERT remains false; **11 active Supabase cron jobs**, the same number as the before-state. No write-capable RPC was invoked for the test, and no table data, RLS policies, cron definition, Next.js source, or UI was changed as part of the production grant mutation.

## Known limitations and completion gate

1. **Anon-role HTTP OpenAPI metadata remains unverified**, although a separate working `public` FRED RPC proved Data API schema exposure via 20 observed HTTP 200 calls in the last-24h logs before this migration. SQL grant enforcement is directly verified; no mutative anonymous probe should be made. The original audit contains a safe GET-only metadata procedure.
2. Unknown third-party/out-of-repository clients cannot be categorically excluded; no caller was found among the audited current application, Edge Function, SQL routine/trigger, 11 active pg_cron commands or 24h API logs.
3. Supabase Security Advisor still reports two `function_search_path_mutable` warnings for obsolete snapshot functions. Search-path function edits are **not** part of this narrow grants remediation.
4. The PR is **not merged**. Owner merge decision, post-merge `main` alignment, and production privilege spot-check are the remaining lifecycle gates. Do not close #330 until those are verified.

Rollback requires a **separately authorized** restoration of the original public rights; the original qualification records the exact SQL and warns this restores anonymous EXECUTE. No rollback was necessary.

**Boundary:** This is a production ACL hardening action, not an application logic change, trading feature, or a claim that the previous RPCs were successfully exploited.
