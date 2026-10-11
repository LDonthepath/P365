# SEC-RPC-001 — Live legacy RPC EXECUTE qualification (11 October 2026)

**Issue:** [#330](https://github.com/LDonthepath/P365/issues/330) · **Parent:** [#283](https://github.com/LDonthepath/P365/issues/283) · **Status:** READ-ONLY QUALIFIED / production REVOKE **NOT AUTHORIZED / NOT EXECUTED**.

**Exact code baseline:** \`main@553d2d4b03d2da7ac4707120d20aa163c0d492a4\` (PR #355 merged). **Production:** Vercel alias \`p365-kappa.vercel.app\` → READY deployment \`dpl_Ej3yzHfxxuCQxD5bdbRx79ZYMpDY\`, same Git SHA (Vercel deployment and alias API readback, 2026-10-11 UTC). **Database:** project \`orwhuzexnuochctccqvl\`, PostgreSQL 17.6, ACTIVE_HEALTHY, read-only catalog measurements at 2026-10-11 01:55 UTC. This is a point-in-time qualification, not a permanent claim.

## Executive outcome

Three legacy \`public\` functions have effective \`EXECUTE\` for \`anon\` and \`authenticated\`; all are \`SECURITY INVOKER\` owned by \`postgres\`. \`PUBLIC\` EXECUTE is present on **all three**, so revoking only \`anon\` is insufficient. \`service_role\` has a separate direct EXECUTE grant on all three, which can be preserved. No invocation, production SQL mutation, schema migration, scheduler change, or HTTP write probe was executed.

**Important limits of proof:** PostgreSQL catalog rights plus \`public\` schema USAGE are verified. **The live PostgREST exposed-schema configuration and role-scoped HTTP API route visibility were NOT verified**: neither \`pg_settings\` nor \`pg_db_role_setting\` exposed \`pgrst.db_schemas\`, and the available connector did not expose the project's Data API settings. Do not label actual HTTP invoke/exploit \`PROVEN\` on this basis. \`SECURITY INVOKER\` requires additional target-table privileges; an effective EXECUTE grant by itself is not evidence of an unauthenticated write.

## Verified inventory (SQL catalog readback)

| Function (all schema \`public\`) | Signature / return | \`prosecdef\` | Before \`anon/auth/service\` EXECUTE | Origin of EXECUTE | Table / effects | Proposed after \`anon/auth/service\` |
|---|---|---|---|---|---|---|
| \`append_market_memory\` | \`(text,text,text,timestamptz,timestamptz,jsonb,text[],text[],text[],text,text) → market_memory\` | false (INVOKER) | **true / true / true** | \`PUBLIC\`; direct \`service_role\` | INSERT conflict-ignore then SELECT from \`public.market_memory\` | **false / false / true** (NOT APPLIED) |
| \`calculate_oms_and_save\` | \`(double precision × 5) → void\` | false (INVOKER) | **true / true / true** | \`PUBLIC\` + direct \`anon\`, \`authenticated\`, \`service_role\` | INSERT into unqualified \`market_snapshots\`; formula-based legacy OMS | **false / false / true** (NOT APPLIED) |
| \`process_market_snapshot\` | \`(numeric × 4) → jsonb\` | false (INVOKER) | **true / true / true** | \`PUBLIC\` + direct \`anon\`, \`authenticated\`, \`service_role\` | SELECT prior + INSERT into unqualified \`market_snapshots\`; obsolete regime/OMS calculations | **false / false / true** (NOT APPLIED) |

- \`append_market_memory\` has function-level \`search_path=public\`. The two snapshot functions have no function-level search_path, independently flagged in Supabase Security Advisor as \`function_search_path_mutable\`. This issue does **not** change function bodies/search paths.
- \`public.market_memory\`: exists, RLS enabled, **zero policies**; \`anon\` and \`authenticated\` have **neither SELECT nor INSERT**; \`service_role\` has SELECT and INSERT. Thus current anon EXECUTE does not prove this INVOKER function can read/write canonical history. Protect existing canonical append-only + provenance invariants.
- \`to_regclass('public.market_snapshots')\` returns **NULL**; no \`market_snapshots\` relation with that name appears in catalog. The two legacy snapshot RPCs refer to the missing relation; no evidence they perform successful writes today. Their \`SECURITY INVOKER\` functions have no privilege-elevation proof.
- A read-only \`pg_proc\` definition search found no other SQL function containing these exact legacy function names, and \`pg_trigger\` returned no triggers invoking them.
- All 11 active \`cron.job\` commands in the observed production catalog were checked with explicit name matches: no references to any of the three RPC names.

## Caller analysis and safeguards

1. On current main, \`lib/data/market-memory-store.ts\` writes to \`/rest/v1/market_memory?on_conflict=dedupe_key\` using a server-only key; its FRED coordinated-write path uses **\`/rest/v1/rpc/p365_insert_fred_observations_v1\`**, not any of these three names. Do not revoke the qualified FRED RPC. Existing history read RPC is likewise distinct.
2. Repository code search returned no application caller for \`calculate_oms_and_save\` or \`process_market_snapshot\`. A historical document (\`docs/P365-OBS-FRED-001E-EXACT-INSERT-AND-TRANSACTION-ORDERING.md\`) documents the unused \`append_market_memory\` path and its legacy dedupe semantics. Search is evidence of no located caller, **not** exhaustive proof against private clients/out-of-repo integrations.
3. The single deployed Supabase Edge Function \`bright-responder\` (ACTIVE, version 3, \`verify_jwt=false\`) was read from its deployed code. It uses \`supabase.from("market_snapshots").insert(...)\` directly, **not these RPCs**. It remains a separate legacy deployment; a prior orphan cron was unscheduled. Do not invoke, modify, or delete it under #330.
4. Service-role grants on all three are currently **true** and must remain **true** after any change. Keep \`postgres\` owner privileges. No mass \`REVOKE ALL ON ALL FUNCTIONS\`, schema-wide change, direct table grants/RLS (#310), or broad function rewrite.

## Reproducible read-only verification

Run [\`scripts/ops/sec_rpc_001_readonly_inventory.sql\`](../scripts/ops/sec_rpc_001_readonly_inventory.sql) in Supabase SQL Editor / a role with catalog visibility before/after a separately approved change. It queries exact function OIDs/signatures, actual effective privileges and ACLs, target-table privileges, existence of \`public.market_snapshots\`, SQL-function and trigger references, and cron references. No mutating statements or function invocations appear in that file.

**Live Data API exposure gate still open:** Using the project's existing publishable/anon credential only in the operator's secure environment, verify *read-only* PostgREST schema metadata/OpenAPI and confirm \`public\` is an exposed schema in **Project → Integrations → Data API Settings**. Record role-scoped route evidence for \`/rest/v1/rpc/<name>\` (if exposed). Do **not** send POST to any of these three write-capable RPCs, and do not treat an HTTP 404, 405, 401 or 403 alone as proof of non-exposure without interpreting gateway/schema-cache/permissions. Never print credentials or JWTs into audit artifacts. A verified production negative after actual revocation would require a zero-side-effect denial proof (e.g., role privilege readback + API schema readback), not a successful function call.

## Proposed exact-scope SQL — **PLAN ONLY, NOT EXECUTED**

**Owner gate:** Obtain explicit owner approval for production SQL before running anything below. Confirm out-of-repo dependents and current signatures/ACLs have not changed; obtain a pre-change ACL/export and verified backup/restore posture. Perform an operator-controlled transaction with minimal lock window and positive privilege readback. A diff in permissions, function identity or dependency inventory invalidates this plan.

\`\`\`sql
BEGIN;
SET LOCAL lock_timeout = '3s';
REVOKE EXECUTE ON FUNCTION public.append_market_memory(
  text,text,text,timestamp with time zone,timestamp with time zone,jsonb,
  text[],text[],text[],text,text
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_oms_and_save(
  double precision,double precision,double precision,double precision,double precision
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_market_snapshot(
  numeric,numeric,numeric,numeric
) FROM PUBLIC, anon, authenticated;
-- BEFORE COMMIT verify role rights using read-only inventory in the same session.
-- If any required check fails: ROLLBACK (not COMMIT).
COMMIT;
\`\`\`

**Expected post-change privilege matrix (predicted, NOT measured):**

| RPC | anon | authenticated | service_role | postgres |
|---|---|---|---|---|
| append_market_memory | false | false | true | true |
| calculate_oms_and_save | false | false | true | true |
| process_market_snapshot | false | false | true | true |

## Exact rollback SQL — conditional on a separately approved grant restoration

Pre-change ACLs are recorded above. To reinstate the *original* privileges on these exact signatures (and **only** if rollback is explicitly approved), restore \`PUBLIC\` on all three and the additional direct \`anon/authenticated\` grants on the two snapshot RPCs:

\`\`\`sql
BEGIN;
GRANT EXECUTE ON FUNCTION public.append_market_memory(
  text,text,text,timestamp with time zone,timestamp with time zone,jsonb,
  text[],text[],text[],text,text
) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_oms_and_save(
  double precision,double precision,double precision,double precision,double precision
) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_market_snapshot(
  numeric,numeric,numeric,numeric
) TO PUBLIC, anon, authenticated;
COMMIT;
\`\`\`

This rollback **reopens anonymous EXECUTE**; it is not a benign generic repair. \`service_role\` direct grants were never removed in the plan. Validate all per-role \`has_function_privilege\` values, SQL catalog ACLs and Data API metadata again after authorized mutation. If a function was replaced/renamed or default grants changed, stop rather than applying stale SQL. No data rollback is needed for a privilege-only change.

## Acceptance & outstanding gates

- [x] Exact \`main\` + production deployment SHA identified; two unrelated PRs (#347/#351) remain open and untouched.
- [x] Function signatures/owner/INVOKER/ACL and actual anon, auth, service-role effective privileges measured on production catalog.
- [x] Underlying table permission, SQL function/trigger and active cron checks recorded; production Edge Function inspected; current main app writer inspected.
- [x] Target-specific read-only SQL, candidate REVOKE, non-destructive rollback and predicted privilege matrix documented.
- [ ] **Real role-scoped Data API exposed-schema and endpoint evidence** not yet captured (not to be inferred from default config).
- [ ] **Explicit owner SQL authorization**, then approved production privilege transaction and measured actual after-state / service-role continuity.
- [ ] Verify any out-of-repo consumers before executing REVOKE; verify post-merge main, exact CI, SQL readback, security-advisor result; only then consider #330 CLOSED (completed).

This qualification PR makes **no runtime/code changes** and does not claim a verified vulnerability exploit or successful remediation. Do not automatically close #330 when it merges; record any unresolved owner gates in #283.
