# OBS-FRED-001F — Exact Physical Insert Identity Receipt

**Status:** implementation PR / owner merge required. Parent [#242](https://github.com/LDonthepath/P365/issues/242). Contract: merged OBS-FRED-001E ([PR #247](https://github.com/LDonthepath/P365/pull/247)). Baseline GitHub `main@5e915bdd0a5c92a35496e4bb82f14401afa67821`.

## Purpose and contract

P365 FRED ingestion already POSTs each FRED canonical batch to PostgREST with `on_conflict=dedupe_key`, `Prefer: resolution=ignore-duplicates,return=representation`, and `select=dedupe_key`. The DB response is the actual set of successfully inserted dedupe keys. OBS-FRED-001A counted those rows, then discarded identities.

001F retains exact **canonical IDs of physical inserts**, **internally only**, alongside existing `submitted/inserted/duplicates`. The HTTP request/response shape with Supabase remains unchanged. No new SQL query, RPC, migration, index, provider API request, scheduling, or extra entitlement is required.

`CanonicalWriteReceipt.insertedCanonicalIds?: string[]` is an optional internal field for repository compatibility. PostgREST adapter always populates it (empty array for zero inserts). An adapter lacking qualified identity proof may omit it; clients must never reconstruct it from submitted row order or `submitted - duplicates`.

For nonempty calls, the adapter builds a one-to-one map of `dedupe_key → canonical_id` before the POST and **rejects** duplicate dedupe keys, duplicate canonical IDs, or blank identities **before any HTTP write**. It checks returned keys: one exact allowed `dedupe_key` per object, no extra fields, no unknown keys, no duplicate keys and cardinality no greater than the submitted batch. Map only keys actually returned by PostgREST, and sort resulting IDs for deterministic presentation; **array order has no transaction/commit semantics**.

The old `submitted`, `inserted`, `duplicates` counters retain their meaning. `HistoricalIngestionProviderReport.writeMetrics` remains numeric-only; the internal `insertedCanonicalIds` array is **not logged or returned in the cron HTTP provider report**. `revised` remains zero only when physical Observation inserts are zero; otherwise `null` and `revisionAssessment=NOT_EVALUATED`. FRED Evidence remains written before Observation, **not** a joint atomic transaction. Any partial failure retains existing error/status behavior.

## Verification and acceptance

Scoped test suite must include: 0 insert/all dupes; 264 submitted/2 inserted/262 duplicates with unordered RETURNING keys; all insert; two concurrent identical requests; duplicate submitted key/canonical ID rejected before HTTP; unknown/duplicate/extra returned keys rejected; HTTP 503 and malformed JSON cause failure without secret leakage; empty request no network; legacy `saveMany` stays `return=minimal`; provider-level returned JSON does **not** contain `insertedCanonicalIds` even when test repository returns them. No new dependency required.

Before owner merge, validate `npx tsc --noEmit`, ESLint on changed TypeScript files, focused ingestion/receipt tests and `npm run build` in isolated checkout pinned to the exact baseline. This PR alone does **not** prove production positive-insert correctness: after merge verify matching READY production SHA and natural FRED ingestion response and associated Market Memory rows. Prior natural 2026-10-08 07:31 UTC verified **zero physical inserts** only. Do not manually write new canonical records for a test.

## Explicit boundary / future checkpoint

The receipt's ID set proves only which canonical versions were physically inserted by this one PostgREST statement. It does **NOT** prove whether those insertions revise a previous measurement, which prior version committed before the insertion, or the order of concurrent distinct-version writers. `captured_at` is set by the application before POST; `created_at` is transaction-start time; sorting IDs is not order proof. The read-only FRED history reader and pure revision classifier remain deliberately **unwired**.

A separate owner-approved OBS-FRED-001G design and staging concurrency proof is required before implementing transactionally coordinated predecessor reads/writes, choosing advisory-lock policy, changing schema/function grants or activating the `revised` metric. Keep [#242](https://github.com/LDonthepath/P365/issues/242) **OPEN** until positive-insert and revision gates genuinely pass. No FRS-002/#230 or FRS-003/#231 activation under this PR.
