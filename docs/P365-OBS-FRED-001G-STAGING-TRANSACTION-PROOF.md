# OBS-FRED-001G — PostgreSQL Transaction & Concurrency Proof (Staging Only)

**Status:** STAGING-PROOF; **NO PRODUCTION MIGRATION**.  
**Baseline:** GitHub main `277d46f74c77429003e88451d7c84939c2ccd6c0`; [#242](https://github.com/LDonthepath/P365/issues/242).  
**Prerequisites:** merged 001E design (PR #247) and 001F exact-insert receipt (PR #248).

This checkpoint adds ONLY the real-PostgreSQL sandbox probe `scripts/qualification/obs_fred_001g_transaction_probe.py` and this report. It is not imported by Next.js and requires no new app dependency, Supabase RPC, database migration, cron, write permission, provider request, canonical data rewrite, or application pipeline change.

## Reproducible boundary

The probe uses real PostgreSQL transactions on two independent connections through Python psycopg2. A hardcoded sandbox database name (`p365_obs_fred_001g_sandbox`), local Unix socket only, refusal of remote `PGHOST`/`PGSERVICE`/`DATABASE_URL`, and `P365_001G_ALLOW_LOCAL_DESTRUCTIVE=YES` gate prevent accidental external DB access. It creates and resets a disposable table in the local staging DB only. It is **destructive to that fixed sandbox DB**: never point production credentials or a real P365 database at this script.

Verified independently in the disposable VM:
- PostgreSQL **17.11** installed from official PGDG repository, port 5433: **10/10 PASS**.
- PostgreSQL **18.6** installed in the same VM, port 5432: **10/10 PASS**.
- Production was audited as PostgreSQL **17.6**. PG17 major-version parity is helpful but **NOT exact production-version/schema equivalence**.

Example command after creating the hardcoded sandbox DB and local role (requires local `python3-psycopg2` and PostgreSQL 17):

```bash
P365_001G_EXPECT_MAJOR=17 PGPORT=5433 \
P365_001G_ALLOW_LOCAL_DESTRUCTIVE=YES \
/usr/bin/python3 scripts/qualification/obs_fred_001g_transaction_probe.py
```

The probe exercises `READ COMMITTED`, a namespaced `pg_advisory_xact_lock(hashtextextended(key,0))`, a **fresh SELECT issued after acquiring the transaction-level lock**, and `INSERT ... ON CONFLICT(dedupe_key) DO NOTHING RETURNING canonical_id`. A per-period 65-row history limit and conservative comparison return NOT_EVALUATED on ambiguous history. Legacy `source_id` column may be NULL, but `payload.sourceId='fred'` is required.

## Ten executed scenarios

| Scenario | Observed result (PG17 and PG18) |
|---|---|
| Different concurrent versions, first writer holds lock | Second waits, then sees first committed row and classifies changed value; first NEW, second REVISION |
| App-supplied captured_at deliberately reversed | Captured timestamps do NOT match commit order |
| Two concurrent exact dedupe retries | 1 INSERT + 1 DO NOTHING, no false revision |
| First transaction rolls back while second waits | Second sees no durable predecessor; 1 surviving insert |
| Legacy NULL SQL source with identical numeric value | IDENTITY_ONLY_OR_EQUIVALENT |
| Legacy SQL source='fred' with different value | PROVEN_FACTUAL_REVISION in the simplified fixture |
| Multiple predecessor candidates with uncertain chronology | NOT_EVALUATED; factual append still succeeds |
| Noncooperating writer ignores advisory lock | **Bypass succeeds**, confirming a critical unsafe production gap |
| 65 prior rows | NOT_EVALUATED rather than a truncated/preferred predecessor |
| Two batches acquire two lock keys despite inverse input order | Sorted lock acquisition avoids deadlock in tested interleaving |
| Missing destructive-test authorization | Local DB access refused |

The table combines two assertions in the first scenario and totals **10 executable test functions**, not 11 independent functions. All 10 completed successfully on **17.11** and **18.6**. The script prints exact test statuses and exits nonzero on failure.

## Limits and blockers

1. Advisory locks are **voluntary**. Every FRED writer—FORWARD, BACKFILL, corrections, retries, authenticated manual/diagnostic lanes—must use the same lock scheme. The bypass test proves that a single uncoordinated writer defeats transaction-order claims. Neither cron configuration nor one successful test proves writer exclusivity.
2. `captured_at` is assigned by Node before POST, `created_at` defaults to SQL `now()` (transaction start), UUIDs and RETURNING array sorting are not commit-order timestamps.
3. The simplified probe classifies 0/1/>1 preceding versions only to test SQL isolation and locking. **It is NOT the approved P365 version-chain algorithm**. Historical legacy ambiguities, unit/frequency compatibility, multiple candidate versions in a single batch, the wrong DTWEXBGS unit base and full 001C proof-engine integration need separate qualification.
4. The fixture is not the full production `public.market_memory` schema: production append-only and dedupe triggers, indexes, role grants, RLS, exact PG17.6 patch behavior, Evidence-before-Observation two-write partial failures and PostgREST/RPC authorization **remain untested**.
5. Lock/statement timeouts are included in the isolated probe, but owner-approved throughput, p50/p95 latency, lock contention, WAL/storage, collision strategy and rollback thresholds remain **NOT VERIFIED**. No production SQL write/EXPLAIN ANALYZE was performed.
6. An actual RPC must be reviewed as a **separate PR** and must use narrow grants, explicit qualification, parameterized inputs, immutable canonical history and a documented disable/rollback mechanism. Do not introduce SECURITY DEFINER or broaden EXECUTE rights opportunistically.
7. Positive natural FRED insert receipt and durable transactional classification still require independent production end-to-end evidence. **Keep #242 OPEN**, and leave #229/#230/#231 scheduler gates unchanged.

## Owner decision gate

**Result:** Transaction ordering under *cooperating* writers is technically demonstrated on real PostgreSQL 17 and 18. **Production activation is NOT qualified**, especially because the noncooperating-writer bypass is proven.

Proposed **OBS-FRED-001G.2** as a separately owner-approved checkpoint: reproduce actual Market Memory trigger/schema and role boundaries in an isolated staging database, audit every FRED writer path, qualify an atomic predecessor-read/insert RPC with concurrency/rollback, and measure performance. Only then review a production migration, narrow EXECUTE grants, and eventual `revised` activation. No change to Supabase production was performed here.
