# OBS-FRED-001A — Actual physical inserts in FRED ingestion

Status: **PR review checkpoint — no production activation proof yet**. Related [#242](https://github.com/LDonthepath/P365/issues/242) and [#229](https://github.com/LDonthepath/P365/issues/229).

## Problem

The legacy `HistoricalIngestionProviderReport.persisted` (and the
top-level `persistedObservations`) represents the number of canonical records
**successfully submitted** to `saveMany`, **NOT** the number of newly
inserted durable Market Memory rows. PostgREST silently ignores duplicates via
`on_conflict=dedupe_key` with `resolution=ignore-duplicates`.

Production baseline (read-only verified 2026-10-08): six FRED runs submitted
1,584 Observation objects, while three physical new FRED Observation rows and
three matching Evidence rows appeared in the same 00:30–05:40 UTC window.
This difference is expected under idempotent persistence, not lost data.

## Narrow remedy

Only for FRED and only when both canonical repositories offer
`saveManyWithReceipt`:

1. Keep one existing bulk HTTP POST per record family, same
   `on_conflict=dedupe_key`, same conflict-ignore policy, and no extra
   query, migration or new table.
2. Use PostgREST `Prefer: resolution=ignore-duplicates,return=representation`
   and `?select=dedupe_key`. Parse just returned database keys, validate
   uniqueness and that each key belongs to submitted rows; those keys are
   **actual successful physical INSERTs** in that statement. Never infer
   counts from `submitted`, `Content-Range` guesses or a race-prone pre-read.
3. Expose `providers[].writeMetrics` on the FRED provider only:
   - `source=POSTGREST_RETURNING_KEYS` when both receipts succeed;
     `NOT_EVALUATED` if repository lacks this capability.
   - `observations/evidence.submitted`: normalized canonical records offered
     for insertion, even when duplicate.
   - `observations/evidence.inserted`: physical new rows reported by SQL
     `RETURNING` (null if not measured).
   - `observations/evidence.duplicates = submitted - inserted`, including
     identical rows within the batch.
   - `revised`: **null + revisionAssessment=NOT_EVALUATED** when there are
     new inserts without an independently proven earlier version of the
     same measurement. `revised=0` is safe only if zero observation
     inserts. New inserted records are **not automatically revisions**.
4. Legacy `persisted`, `persistedEvidence`, top-level
   `persistedObservations` and `persistedEvidence` retain previous meanings
   to preserve existing handlers and callers; mark them DEPRECATED as metrics
   of physical writes, not silently re-label them.
5. If Evidence insertion succeeds and Observation insertion fails, preserve
   the proven Evidence receipt but do **not** invent an Observation insert
   count. Status stays `PERSISTENCE_ERROR`. A malformed receipt is an error,
   not success with fabricated zero.
6. No change in other providers, cron cadence, FRED API requests, canonical
   revision hashes, dedupe keys, or Market Memory schema.
7. Adapter response only contains **dedupe keys of inserted rows** — not
   full canonical payload. This adds a small response body but no roundtrip.

## Future revision proof boundary

To classify `revised` accurately for a new physical Observation, we need a
provable earlier **different canonical version of the same measurementId**
from durable history. A FRED vintage update alone is not such proof. The
existing Market Memory indexes support series/effectiveAt queries but **not**
an indexed measurementId lookup, and extra queries for 264 records per hour
would add avoidable load. Do not perform an unqualified 100k-row scan or claim
atomic revision counts. Full revision classification requires a separately
reviewed, bounded history-evidence contract (or indexed transactional receipt)
with explicit concurrency/point-in-time semantics. Leave #242 OPEN for this
remaining gate if the owner requires precise revised counts.

## Verification and release procedure

Unit tests:
- One insert followed by retry gives `inserted=0,duplicates=N`.
- Concurrent duplicate writes return exactly one counted insert.
- Invalid receipt / unexpected duplicate key / HTTP write failure do not
  fabricate physical counts.
- Legacy `saveMany` continues `return=minimal`.
- FRED regression retains legacy response fields and mixed provider status.
- Failure after Evidence receipt keeps proven count, otherwise null.

Before owner merge: run `npx tsc --noEmit`, scoped ESLint, the focused
regression tests, and `npm run build`. No manual production FRED ingestion
tests (that would write to Market Memory).

After owner merge and production READY SHA verified: inspect actual natural
scheduled FRED HTTP responses in `net._http_response`, compare the
`writeMetrics` fields against physical `market_memory` rows on the same
time window; `pg_cron.succeeded` alone is insufficient. If the deployed
project's server write identity lacks SELECT permissions required for
PostgREST `return=representation`, rollback code via owner-reviewed revert
rather than widening public RLS/grants. A read-only production role check on
2026-10-08 showed service_role can SELECT/INSERT market_memory, but the
specific Vercel write-key role itself was not inspected or disclosed.

**Never close #242 until live production count evidence AND final revision
policy are owner reviewed.**
