# OBS-FRED-001D — Fail-closed historical evidence adapter

Status: **implementation checkpoint / owner merge required**. Related to [#242](https://github.com/LDonthepath/P365/issues/242), merged OBS-FRED-001B contract PR #244 and OBS-FRED-001C proof-engine PR #245.

## Audited defects and their mitigation

| Finding | Production evidence (2026-10-08) | Contract |
|---|---|---|
| Application-populated `captured_at` is NOT database commit order | `lib/data/market-memory-store.ts` `rowFor` writes `new Date().toISOString()` before POST; DB `captured_at` is NOT NULL with **no default** | Historical adapter exposes it only as stored app-assigned timestamp, always `orderingProven:false` |
| PostgreSQL `created_at` is NOT independent commit order | DB `created_at DEFAULT now()`, meaning transaction-start timestamp; concurrent transactions may commit in different order | Expose `createdAt` as diagnostic context, **never as commit-order proof** |
| Legacy FRED Observation rows have `source_id IS NULL` | SELECT: **823/1850** FRED observations have SQL column source_id NULL, while `payload.sourceId='fred'` | Require `payload->>sourceId=eq.fred`, **do not filter stored source_id**; validate returned column `source_id` is either null or 'fred' |
| Modern and legacy share old observed periods | 261 modern periods overlap with legacy; all 261 have at least one matching value | Query by `metadata.seriesId` and **effective_at**, retrieving both; no identity migration or blanket version counting |
| Unbounded scans and silently truncated results are unsafe | Existing effective_at index and series history index present | EXACT one period, one allowlisted series, one GET, **limit 65 sentinel**, reject if 65 or more rows; strict canonical validation |

## Implementation

Added `lib/data/fred-revision-history-evidence.ts`:
- Server-only adapter `SupabaseFredRevisionHistoryEvidenceReader.readPeriod({seriesId,observedAt})`, **not wired to cron, ingestion, dashboard, or the proof engine**.
- Strict allowlist from `MACRO_SERIES_REGISTRY` and canonical UTC timestamp; no arbitrary filters/query strings.
- PostgREST SELECT only, `select=canonical_id,source_id,captured_at,created_at,effective_at,payload`, `record_type=OBSERVATION`, exact period `effective_at`, exact `payload.metadata.seriesId`, and exact `payload.sourceId=fred`.
- Returns at most **64** qualified physical records, otherwise fails closed. Verifies record identity, domain, source, unit/frequency, observed/effective time, provenance, modern identity version and fingerprint, and duplicate canonical IDs.
- A successful single query can establish **bounded rowset** but **NOT global commit order, complete concurrent-write history, or provenance of newly inserted IDs**. Result therefore always contains `orderingProven:false`, `completeHistoricalOrderingProven:false`, `insertedIdentityProven:false`, `orderingStatus:NOT_EVALUATED`.
- Existing `proveFredRevision` requires `orderingProven:true`; passing this adapter's output cannot by itself claim a factual revision.
- No extra third-party service, index, function, migration, database write, credential export or scheduler change.

## Performance and operational boundary

Read-only `EXPLAIN (FORMAT JSON)` for representative `PAYEMS` and `2026-08-01`, using the actual JSON predicate shape, selected `idx_market_memory_effective_at` with estimated total cost ~14.61 and additional series/source filters. **This is only a planner estimate**, not live Vercel role latency, transaction safety or guarantee of all future dataset sizes. The existing `idx_market_memory_obs_series_history_v1` applies to an expression using `#>>`, which may not match the arrow-chain PostgREST query expression; no index migration performed. The 65-row response cap limits returned records, not PostgreSQL scan work. A future runtime integration must prove actual read budget under its own credential and timeseries cardinalities.

Read-only SQL checks confirmed 1,850 FRED Observation rows, no missing metadata series, frequency, or unit, and no modern seriesKey/metadata.seriesId mismatches in the inspected corpus. Nothing was rewritten. If data no longer satisfies this contract, the adapter throws and **must not** convert failure into `revised=0`.

## Remaining gate — NOT SOLVED BY THIS PR

Receipt from PR #243 returns **aggregate counts only**. The identifier of each physically inserted row and a transaction/serialization-safe earlier-version boundary are **not available**. Neither `captured_at` nor `created_at` proves global commit order; an unqualified `orderingProven:true` would be misleading.

Before any FRED `revised` production metric is activated:
1. Verify the natural cron's physical-write receipts (#242 automation scheduled for **2026-10-08 14:45 WIB**, after 14:31 WIB cron).
2. Qualify exact newly inserted Observation IDs with an owner-reviewed write receipt or atomic database operation; measure incremental cost.
3. Specify a concurrency-safe transactional predecessor policy (potential advisory lock/DB RPC requires **separate owner approval**). Do not use client timestamps or transaction-start timestamps as commit-order proof.
4. Re-run correctness tests for both modern and legacy, race/interleaving, unknown unit `DTWEXBGS`, partial provider failures, and bounded scan/overflow.
5. Only after separate code-review approval wire the evidence adapter into the ingestion path; keep `revised:null/NOT_EVALUATED` until all gates pass.

No change to FRED provider polling or the CoinGecko context hourly cron. **#242 remains OPEN** until the end-to-end and historical revision requirements are met.
