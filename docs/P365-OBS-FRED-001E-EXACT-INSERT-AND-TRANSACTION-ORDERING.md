# OBS-FRED-001E — Exact Insert Identity & Transaction Ordering Decision Gate

**Status:** PROPOSED CONTRACT / OWNER REVIEW; **DESIGN AND READ-ONLY VERIFICATION ONLY**
**Issue:** #242. **Code baseline:** `main@9b8da4cb04d5b79b1d5c60c1bc0a7a2576e1aa81` (2026-10-08 07:53:32 UTC).
**Scope:** one document. Do not deploy a database function, modify an index/trigger, run an ingestion, change cron, wire revision classification, or modify existing Market Memory data in this checkpoint.

## 1. Precisely what is verified in production

| Property | Evidence | Consequence |
|---|---|---|
| PostgreSQL 17.6; default READ COMMITTED | `current_setting('server_version')`, `current_setting('default_transaction_isolation')` | Statement snapshots and unique conflicts require an explicit concurrency protocol. |
| `market_memory.dedupe_key` unique index | `pg_indexes.uq_market_memory_dedupe_key`; `lib/data/market-memory-record.ts` | Existing append-only idempotency remains authoritative; no new competing key. |
| `market_memory_append_only` trigger | `pg_trigger`, enabled BEFORE UPDATE OR DELETE | Neither proposed approach may update or delete canonical rows. |
| `market_memory_dedupe_key` trigger | BEFORE INSERT only fills dedupe key when NULL | Current application-supplied key is not overwritten; preserve current key semantics. |
| `source_id` SQL column may be NULL | 1,850 FRED observations: **535 modern NULL + 288 legacy NULL + 1,027 legacy 'fred'** | Prior reports that called all 823 NULL-source rows 'legacy' were **incorrect**. A source_id-only predicate also excludes **all 535 modern** rows. Use `payload.sourceId='fred'` plus provenance verification. |
| 646 FRED series/observedAt groups | Aggregate `payload.metadata.seriesId, effective_at`: 1,850 rows, 386 multirow groups, 146 groups with different raw values, **maximum 8 versions per group** | 64-row history cap is sufficient only for observed current cardinality; cap sentinel remains mandatory for future drift. Different raw values alone are not qualified run-level revisions. |
| First natural FRED write receipt after #243 | 2026-10-08 07:31 UTC, `net._http_response.id=37439` HTTP 200, 264 submitted, **0 physical inserts, 264 duplicates** for each of Observation and Evidence | Production **zero-insert path PASS** only; positive insert counts and exact previous-version ordering are still unproven. |
| `captured_at` generated in Node `rowFor` before HTTP POST | `lib/data/market-memory-store.ts` | Application-supplied timestamp does **not** prove DB transaction order. |
| `created_at` defaults to SQL `now()` | `information_schema.columns` | Transaction-start time is also **not** commit order. UUID `id` is not commit-order sortable either. |
| Existing `append_market_memory` RPC | `pg_get_functiondef(public.append_market_memory)` | Existing SECURITY INVOKER function performs INSERT ON CONFLICT DO NOTHING and, on collision, SELECTs existing row. It **cannot distinguish INSERT from duplicate by response alone**; lacks measurement-level locking/prior-version proof and has a different legacy dedupe rendering. Do **not** retrofit or reuse unchanged for revision telemetry. |
| Function EXECUTE ACL | `pg_proc.proacl` and `has_function_privilege`: legacy `append_market_memory` callable by `anon`/`authenticated` through PUBLIC, but SECURITY INVOKER and table INSERT/SELECT unavailable to those roles | This is **not proof of unauthenticated table write**. Nevertheless any *new* write RPC must explicitly REVOKE PUBLIC/anon/authenticated and GRANT only a qualified server role; do not modify old grants in this checkpoint. |

**Read-only SQL to reproduce key aggregates:**

```sql
SELECT current_setting('server_version'),
       current_setting('default_transaction_isolation');

SELECT COALESCE(source_id,'[NULL]') AS sql_source,
       CASE WHEN payload #>> '{identity,measurementId}' IS NULL
            THEN 'LEGACY' ELSE 'MODERN' END AS identity_class,
       count(*) AS n
FROM public.market_memory
WHERE record_type='OBSERVATION' AND payload->>'sourceId'='fred'
GROUP BY 1,2 ORDER BY 1,2;

WITH periods AS (
 SELECT payload #>> '{metadata,seriesId}' AS series_id, effective_at,
        count(*) AS versions, count(DISTINCT payload->>'value') AS distinct_raw_values
 FROM public.market_memory
 WHERE record_type='OBSERVATION' AND payload->>'sourceId'='fred'
 GROUP BY 1,2
) SELECT count(*) AS groups, sum(versions) AS physical_rows,
         max(versions) AS max_versions,
         count(*) FILTER(WHERE versions>64) AS over_history_cap,
         count(*) FILTER(WHERE distinct_raw_values>1) AS changed_raw_value_groups
  FROM periods;
```

## 2. Core invariant: receipt identity is not revision order

Current `lib/data/market-memory-store.ts` writes FRED with PostgREST `on_conflict=dedupe_key`, `Prefer: resolution=ignore-duplicates,return=representation`, `select=dedupe_key`. The adapter validates each returned dedupe key against submitted rows, then discards the keys and returns only `{ submitted, inserted, duplicates }`. PostgreSQL `INSERT ... ON CONFLICT DO NOTHING RETURNING` returns **only actual successful inserts**. Keeping the returned key set and mapping it to the already-qualified input canonical Observation IDs is a **non-destructive additive extension** of that receipt; it requires **no extra HTTP roundtrip**. The map must reject duplicate submitted keys, keys not in the request, missing/ambiguous canonical identity, and inconsistent response cardinality.

However, receiving which rows were inserted **after a separate HTTP INSERT** does not establish which same-measurement version committed before them. Two concurrent writers can each append distinct revision fingerprints; client-assigned `captured_at`, transaction-start `created_at`, RPC response order, observedAt, retrieval time, and UUID are not a valid commit-order oracle. A subsequent standalone SELECT cannot retroactively prove serial predecessor order. These are **separate proof problems**.

## 3. Decisions for implementation after owner approval

### 3A. OBS-FRED-001F: additive exact-insert receipt (one isolated PR)

- Evolve **only optional FRED receipt** to supply exact inserted canonical IDs or dedupe keys in addition to existing submitted/inserted/duplicate counts. Retain old counters, PostgREST conflict-ignore, schema, other providers, and append-only behavior.
- Join returned key against **in-memory input mapping**, never a guessed order, arbitrary prior snapshot, or `findHistory` response. Confirm uniqueness, value validity, and FRED identity. Avoid emitting raw canonical payload, API key or per-record private content into operator logs.
- When zero rows are inserted, the existing `revised=0` remains sound. With any new insert, keep `revised=null`, `revisionAssessment=NOT_EVALUATED` pending transactional qualification. Do not invoke historical SELECTs as though they prove commit order.
- Test `inserted=0`, mixed 1 insert/263 duplicates, all inserted, duplicate keys inside batch, unknown key returned, response parse/permission error, simultaneous retries, partial Evidence success/Observation error and legacy metric compatibility. Confirm production via the next **natural** cron that encounters a positive insert; never create a new Observation solely to test counts.
- Owner may independently merge #001F **only after** reviewing this design and implementing tests; #001F alone does not authorize revision counting.

### 3B. OBS-FRED-001G: coordinated predecessor proof (separate design, migration and PR)

**Preferred candidate, not yet production-qualified:** a minimal **FRED-only server-invoked PostgreSQL transaction/RPC** that serializes the same logical measurement (`domain`, `seriesKey`, canonical observedAt, `sourceId`) and performs predecessor read plus conflict-ignore insert in one transaction. For new FRED payload, it must:

1. Validate a strict batch envelope (bounded size, registered series, canonical UTC observedAt, source=fred, measurementId, revisionFingerprint, exact canonical value/unit/frequency, current dedupe key). Enforce existing append-only and source qualifications; do not silently repair legacy data or the `DTWEXBGS` unit-base mismatch.
2. Acquire a transaction-level lock for each logical measurement **before reading the predecessor**; use a deterministic namespaced lock key and globally sorted lock acquisition for multi-measurement batches, with controlled lock/statement timeouts and deadlock/serialization retry policy. A hash collision only increases contention, but a non-cooperating writer invalidates the ordering proof. Transaction-scoped advisory locks are voluntary and safe **only if every FRED writer uses the same protocol**.
3. In a qualified READ COMMITTED transaction, after acquiring the lock, issue a **fresh** predecessor read. Do not rely on a statement snapshot taken before waiting for a lock, on `captured_at`, or on `created_at`. Test actual PostgreSQL 17.6 behavior under two distinct concurrent sessions; do not claim this freshness is established by a conceptual design.
4. Treat the predecessor as a logical series+period and compare both modern and legacy rows, including `source_id IS NULL` with `payload.sourceId='fred'`. A prior same-value legacy representation is **identity-only**, never a factual revision. If multiple prior values exist and trustworthy relative order is absent, set `NOT_EVALUATED` (not first/last by app timestamp). Use normalized numeric values and compatible unit/frequency/source; defer `DTWEXBGS` until its semantic remediation is approved.
5. Append the candidate with the existing unique dedupe contract, **DO NOTHING on conflict**, inspect the actual `RETURNING` for inserted identity; never count duplicate or non-durable candidates. Do not use `DO UPDATE`, overwrite, delete or infer from the older `append_market_memory` RPC's existing-row return. Handle same-measurement **multiple candidate versions in one batch** explicitly: provider chronological order must be qualified; if ambiguous, do not invent revision chronology.
6. Return a *bounded*, authenticated receipt with actual insert identity, duplicate count, proof status, and predecessor basis. Persist the canonical write even when revision classification is unqualified; metric stays null/NOT_EVALUATED. Carefully assess the existing **Evidence-then-Observation two-POST** path: a new Observation RPC does not make both record families atomic by itself. Any atomic paired Evidence+Observation redesign needs its own reviewed compatibility boundary.
7. Require a **single authoritative writer protocol** across FORWARD/BACKFILL, retries, corrections, scheduler, diagnostics or approved manual lanes. Any bypass, partial migration, or legacy writer that can append FRED without the lock must downgrade ordering provenance to NOT_EVALUATED. Do not infer exclusivity merely from the cron configuration.
8. Use `SECURITY INVOKER` by default, fixed safe search_path/schema-qualified objects and narrow EXECUTE grants. Revoke default PUBLIC and explicit anon/authenticated EXECUTE, grant only a confirmed server write role. Do not introduce a SECURITY DEFINER RPC casually; qualify RLS, data scope, ownership and privilege escalation separately.

**Strong alternative if serialization cannot be proven:** keep `revised=null/NOT_EVALUATED` with exact insert identities. This is preferable to invented factual revision counts. An `INSERT ... RETURNING`-only or `SELECT-after-POST` implementation is **not** an acceptable ordering proof.

## 4. Concurrency and historical qualification test matrix (required before wiring)

| Case | Expected proof |
|---|---|
| Retry same dedupe key / concurrent identical values | At most one physical insert; all other submissions duplicate; no invented revision. |
| Two different values for same previously unseen measurement, concurrent sessions | Lock serialization or an explicit NOT_EVALUATED outcome, never two 'first measurements'. |
| Two different values for same existing measurement, concurrent sessions | A committed predecessor that is guaranteed by protocol; otherwise NOT_EVALUATED. |
| Writer waits on lock while a preceding transaction commits | Fresh predecessor statement must observe committed prior write under qualified isolation. |
| Writer aborts/rolls back after attempting insert | No durable insert or qualifying revision; retry remains idempotent. |
| Same batch includes two different vintages of one measurement | No reliance on unordered JSON body or SQL input order; only verified vintage sequence or NOT_EVALUATED. |
| Existing 1,315 identity-legacy rows or mixed-source-column groups | Complete matching on source+series+period+unit and numeric equivalence; no identity-only false revisions. |
| More than 64 historical rows for one period / timeout / permission failure | NOT_EVALUATED, no partial-result revision count; bounded reads and measured query cost. |
| `DTWEXBGS` wrong base-unit / changed frequency / source mismatch | NOT_EVALUATED pending explicit semantic compatibility approval. |
| Partial Evidence success with Observation failure / vice versa | Documented append-only recovery path; never claim transactional pair atomicity unless redesigned and proven. |
| Mixed old/new writer during migration or uncoordinated manual lane | No global ordering claim; downgrade revisions until exclusivity is enforced. |
| RPC callable with anon/authenticated grants | Security test must fail unauthorized access; never broaden table rights to make test pass. |

## 5. Performance and activation gates

- Production baseline: 33 FRED series × 8 observations = **264 normalized/submitted** per hourly run, usually 0 actual physical inserts; one natural 2026-10-08 07:31 UTC run proved all duplicates. Do not infer expected savings or acceptable latency without measuring.
- The indexed series/period predicate can use `idx_market_memory_obs_series_history_v1` when the SQL **matches index expressions** (`payload->>'domain'`, `payload #>> '{metadata,seriesId}'`, effective_at); a read-only `EXPLAIN` on PAYEMS showed estimated total plan cost about **2.66**. The existing PostgREST arrow-chain form used by 001D selected `idx_market_memory_effective_at` with estimated cost **14.61** instead. These are planner estimates, not runtime budgets.
- A 65-row sentinel limits responses but **not** the number of rows PostgreSQL scans. Before PR #001G, measure realistic multi-series `EXPLAIN (ANALYZE, BUFFERS)` **only in an approved staging database**, never by running new writes in production. Validate p50/p95 latency, lock wait, deadlock rate, function privileges, append-only trigger interaction and WAL/storage overhead with owner-approved acceptance thresholds.
- Before any data-writing migration: review SQL DDL, function grants, deterministic lock identity, rollback plan, production writer exclusivity, and business equivalence of old/new dedupe keys. Use preview/staging concurrency integration tests; a single mock test is insufficient.
- Shadow mode can report **insert identities with revised still unknown**; do not report `revised=0` on nonzero inserts. Deploy behind an explicit owner-approved gate with one small PR per stage. On any incorrect metric, **disable the new classification while retaining current proven canonical persistence**, not by overwriting past rows.
- No change to FRS-001/#229 metadata gaps, FRS-002/#230, or FRS-003/#231 scheduler until separately approved. #242 remains OPEN for nonzero natural insert proof and safe revision classification.

## 6. Source references and approval required

- Repository: `lib/data/market-memory-store.ts` (`rowFor`, `insertManyWithReceipt`); `lib/application/historical-ingestion.ts` (`executeProvider`); `lib/domain/observation-identity.ts`; `lib/data/fred-revision-history-evidence.ts` (001D); `lib/application/fred-revision-proof.ts` (001C); `lib/data/market-memory-record.ts`.
- Live evidence: SQL `pg_indexes`, `pg_trigger`, `pg_get_functiondef(append_market_memory)`, `pg_proc.proacl`, `information_schema.columns`, `current_setting`, FRED Observation aggregate; FRED natural HTTP response `net._http_response.id=37439`.
- PostgreSQL **17**: https://www.postgresql.org/docs/17/sql-insert.html ; https://www.postgresql.org/docs/17/transaction-iso.html ; https://www.postgresql.org/docs/17/explicit-locking.html .
- PostgREST return/ignore conflicts: https://docs.postgrest.org/en/stable/references/api/tables_views.html .
- Supabase function privileges/invoker/definer: https://supabase.com/docs/guides/database/functions .

**Owner decision gate:** Approve **001F exact identity receipt** as a small additive runtime PR first; approve **001G** only after a separate staging transaction test proves consistency across all qualified FRED writers and the security/performance plan is reviewed. Neither implementation is authorized by merging this document alone.
