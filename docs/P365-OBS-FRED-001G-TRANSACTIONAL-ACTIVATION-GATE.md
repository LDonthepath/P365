# OBS-FRED-001G — Coordinated FRED revision writer

Status: IMPLEMENTED, OPT-IN, NOT PRODUCTION-ACTIVATED. Tracking: GitHub issue #242.

## Functional behavior

Optional PostgreSQL RPC serializes each FRED logical measurement (domain, seriesId, observedAt) using transaction-scoped advisory locks, performs the existing unique dedupe-key conflict-ignore INSERT, and counts revisions ONLY with a proved predecessor. A noncanonical head ledger records the most recent coordinated write; the epoch automatically advances when enforcement toggles, invalidating previous heads. Existing market_memory rows remain append-only and are never updated or deleted.

With no ledger head, an empty compatible history proves a new measurement and an exhaustive uniform-value history proves the comparison value. Differing historic values, incomplete history (greater than 64 rows), unqualified unit or frequency, nonnumeric values, or DTWEXBGS unit-base mismatch require NOT_EVALUATED. Duplicate physical writes do not count as revisions. Multiple values for one measurement in one batch are rejected before any insert. The RPC returns precise submitted/inserted/duplicates plus revised when complete.

Application behavior changes ONLY when P365_FRED_TRANSACTIONAL_REVISIONS=1 is set server-side, and the SQL RPC is present. With the flag absent (default), all existing FRED and other provider paths are unchanged. Unknown proofs remain revised=null, never a fabricated 0. Evidence and Observation remain separate transactions; a partial write requires existing append-only recovery and is not globally atomic.

The installation script is scripts/ops/obs_fred_001g_install_rpc.sql. It creates the disabled-by-default gate, head table, and security-invoker RPC restricted to service_role; public/anon/authenticated cannot call it. A database trigger blocks noncooperating FRED Observation writes only when gate enforcement is explicitly enabled. The guard checks both legacy SQL source_id and modern payload.sourceId. Application-held service_role credentials are trusted: a malicious holder could set custom GUCs, so the guard blocks accidental bypass, not credential compromise.

## Verification / limits

- Staging-only disposable PostgreSQL 18.6 database p365stage: 24 PASS assertions involving two concurrent SQL sessions, reversed lock ordering, identical retry races, rollback, legacy ambiguous values, security and enrollment gate. Test harness scripts/tests/obs_fred_001g_pg_integration.py refuses any database name other than p365stage and resets only that fixture.
- FRED/ingestion/receipt focused and regression suite 75/75 PASS, TypeScript, modified-file ESLint and Next.js build PASS on development checkout. Only existing unrelated build warnings.
- NOT YET VERIFIED: PostgreSQL 17 two-session staging test against the production-equivalent triggers, real 264-row p50/p95 query cost, permission and writer audits, end-to-end Supabase credentials, and natural provider freshness. PostgreSQL 18 test success must not be represented as PostgreSQL 17 qualification.

## Operational owner gates

1. Audit all routes capable of FRED writes, including manual/backfill/corrections/cron and any legacy adapter bypass. Before production install, execute PostgreSQL 17 staging two-session tests with actual append-only trigger, realistic latency/locks, role grants and query plan. Record thresholds and regressions.
2. Obtain separate owner approval for database DDL INSTALL, initially with gate.enforced=false. GitHub merge and Vercel build must NOT apply SQL or change cron/jobs.
3. Coordinate the server-side opt-in flag on all FRED writers and verify RPC reporting while enforcement is still disabled (revised remains null for positive inserts). THEN request a separate owner authorization for gate activation; do not enable with any uncoordinated writer still active.
4. After activation, verify real HTTP/provider results, exact canonical physical inserts, legacy revisions only with uniform-history proof, freshness, error logs and request/storage budget from natural runs; keep GitHub #242 open until all pass.
5. On operational fault, separately approve disabling the gate BEFORE restoring flag-off clients; epoch invalidation prevents stale heads being trusted on re-enable. Historical Market Memory is never rewritten.

No production SQL, scheduler modification, manual ingestion or self-merge is authorized by this implementation PR.
