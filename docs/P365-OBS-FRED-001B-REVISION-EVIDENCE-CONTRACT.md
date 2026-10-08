# OBS-FRED-001B — FRED Revision Evidence & Legacy Reconciliation Contract

**Status:** CANDIDATE / OWNER REVIEW REQUIRED — documentation-only policy gate  
**Issue:** [#242](https://github.com/LDonthepath/P365/issues/242)  
**Prerequisite:** OBS-FRED-001A / [PR #243](https://github.com/LDonthepath/P365/pull/243) merged on `main@63338e73cce3bc45bcb2ae32c09c40a4c3b635ea`.  
**Scope:** read-only diagnosis and future acceptance rules for FRED revision observability. **No code, migration, cron, production SQL writes, provider calls, or canonical rewrites in this checkpoint.**

## 1. Live database proof — 2026-10-08 UTC

Source: read-only SQL on production `public.market_memory`; `record_type='OBSERVATION'`, `coalesce(source_id,payload->>'sourceId')='fred'`.

| Quantity | Live observed value | Interpretation |
|---|---:|---|
| Total physical FRED Observation rows | **1,850** | All retained versions, including legacy |
| Rows lacking `identity.measurementId` / revision fingerprint | **1,315** | Legacy; **not** safe to ignore or mutate |
| Rows with modern `identity.measurementId` | **535** | Current identity contract |
| Distinct modern measurements | **498** | Stable `domain + seriesKey + observedAt` identity |
| Modern measurements having multiple physical versions | **37** | All 37 have two versions, differing factual values |
| Total *additional* modern-version rows | **37** | **Historical stock**, NOT run-level `revised` metric |
| Modern measurements also present as legacy series+observedAt | **261 of 498** | Every pair has ≥1 exact same-value match |
| Modern measurements with no matching legacy period | **237** | Not necessarily all genuinely first published |
| Cases with unit/frequency/period/source context drift in modern version cohorts | **0** | Supported only for the audited 37 cohorts |

Eight modern series carry the 37 changed-value periods: `GDPC1` 8, `PCEPI` 7, `PCEPILFE` 7, `M2SL` 6, `CCSA` 3, `ICSA` 3, `PAYEMS` 2, `JTSJOL` 1. **Do not label these 37 as 'revisions in the latest run'**: insert timestamps span 2026-09-20 to 2026-10-02.

Concrete audit proof: PAYEMS observation period 2026-08-01 originally `159075` (written 2026-09-20) and later `159015` (written 2026-10-02), same unit `Thousands of Persons`, same measurement identity, different fingerprints. This is a demonstrable historical value revision. By contrast, a legacy row matching the modern version's **same** value is *not* itself a value revision merely because a new canonical identity appears.

### Reproducible aggregate SQL (SELECT-only)

```sql
WITH modern_groups AS (
  SELECT payload->'identity'->>'measurementId' measurement_id,
         count(*) physical_versions,
         count(DISTINCT payload->>'value') distinct_values,
         count(DISTINCT payload->'metadata'->>'unit') distinct_units,
         count(DISTINCT payload->'metadata'->>'frequency') distinct_freqs,
         count(DISTINCT payload->>'observedAt') distinct_periods,
         count(DISTINCT payload->>'sourceId') distinct_sources
  FROM public.market_memory
  WHERE record_type='OBSERVATION'
    AND coalesce(source_id,payload->>'sourceId')='fred'
    AND payload->'identity'->>'measurementId' IS NOT NULL
  GROUP BY 1
)
SELECT count(*) measurements,
       sum(physical_versions) physical_rows,
       count(*) FILTER(WHERE physical_versions>1) with_multiple_versions,
       sum(greatest(physical_versions-1,0)) additional_versions,
       count(*) FILTER(WHERE physical_versions>1
                         AND distinct_values=physical_versions) changed_value_cohorts,
       count(*) FILTER(WHERE physical_versions>1 AND
                        (distinct_units>1 OR distinct_freqs>1 OR
                         distinct_periods>1 OR distinct_sources>1)) semantic_drift_cohorts
FROM modern_groups;
```

Legacy overlap verification requires matching approved `metadata.seriesId` and `observedAt` with modern `identity.seriesKey` and `observedAt`, and value comparison. No legacy `measurementId` should be manufactured or persisted retroactively.

## 2. Definitions for the future `revised` counter

The physical insert receipt introduced by OBS-FRED-001A is the **only** authoritative source of the *set of newly inserted rows*. The number of attempted FRED observations, provider vintage records, or `persisted` legacy metrics is never a valid physical revision count.

Classify **only newly and durably inserted** FRED Observation versions, using the following precedence:

1. **PROVEN_FACTUAL_REVISION:** A preceding durable Observation exists for *the same* logical measurement (domain + approved seriesKey + observedAt + provider source); it is strictly earlier in P365 write-time history, and its **canonical numeric value differs**, while unit/frequency semantics are compatible. Include a legacy predecessor only when its series key, time, source and unit semantics can be independently qualified.
2. **IDENTITY_ONLY_OR_EQUIVALENT:** A preceding representation exists for the same logical measurement with numerically equivalent value; a different ID, source formatting, or an identity/version migration alone is **not** a factual revision.
3. **PROVEN_NEW_MEASUREMENT:** No predecessor exists **after an exhaustive, bounded and compatible search** of relevant modern **and** legacy coverage. A null hit on a partial query cannot prove this status.
4. **NOT_EVALUATED:** Missing or incompatible identity, ambiguous legacy equivalence, source/unit base changes, incomplete history, timeout/permission/pagination failure, insufficient prior-version evidence, or concurrent write ordering that cannot be established.

The published `revised` count must **remain null** while any newly inserted version is unclassified or comparison coverage is partial. Do not silently translate unknowns into zero; preserve separate provenance/coverage markers. `revised=0` remains sound when there were **zero physical Observation inserts**. A complete batch may publish `revised=0` only when all inserted versions are proven not to be factual revisions.

Do not equate `revisionFingerprint` inequality with factual value changes: `lib/domain/observation-identity.ts:68-83` hashes normalized value **plus source, unit, and frequency**. `DTWEXBGS` has an independently verified wrong persisted unit-base label; correcting it without a compatibility gate could create a synthetic version with an unchanged number. Use `canonicalObservationValue` for numeric-format equivalence rather than raw string inequality when implementing.

## 3. Safe retrieval and concurrency boundaries

**Do not perform one unbounded query per each of 264 hourly FRED fetch items.** Query cost and cardinality should scale with **new physical inserts** returned by PostgREST (often zero), not all normalized submissions. Before adding runtime classification:

- Review the exact write receipt contract: current receipt only emits aggregate counts, not inserted record identities. A future checkpoint needs safely bounded identity evidence for *actually inserted* rows; do not infer inserted identities from submission order.
- Use the existing `idx_market_memory_effective_at` / approved `idx_market_memory_obs_series_history_v1` under a bounded observedAt / series predicate. The read-only `EXPLAIN` on a sample PAYEMS period used `idx_market_memory_effective_at` with additional series predicates applied as filter, **not** a direct index on `identity.measurementId`. A new index, function, transaction change, or broad scan requires a separate reviewed checkpoint with `EXPLAIN` and performance budget.
- Establish strict `captured_at` precedence, evidence of complete compatible history, and a concurrent-writer rule. A post-write nontransactional read can observe other writers and may misclassify version order. Treat this case as `NOT_EVALUATED` until a reproducible concurrency proof exists; never guess.
- Avoid mutations/backfills of 1,315 legacy rows. No changes to `dedupe_key`, `revisionFingerprint`, `measurementId`, original `retrievedAt`, `captured_at`, or point-in-time historical read semantics.
- Fail open to **accurate unknown metrics**, not fail open to invented revisions or to an extra API ingestion run. Observability failure should not overwrite historical evidence.

## 4. Acceptance gates (for owner approval before implementation)

- [ ] Natural post-merge PR #243 FRED run verifies HTTP/provider SUCCESS and receipt `source=POSTGREST_RETURNING_KEYS`, physical `inserted/duplicates` and matched durable row counts. **Scheduled separately for 2026-10-08 14:45 WIB**, after 14:31 WIB cron. No manual ingestion.
- [ ] Define and unit-test modern same-measurement same-value/changed-value cases, including numeric formatting, wrong-unit scenarios, and distinct `sourceId`.
- [ ] Explicit legacy qualification for same series+observedAt; tests covering all 261 overlap archetypes in aggregate, no destructive migration; known same-value legacy predecessor must never be counted as a factual revision.
- [ ] Prove retrieval plan bounded by actual physical inserts, index/permissions/cost checked with EXPLAIN; concurrency-safe historical ordering or `NOT_EVALUATED` fallback.
- [ ] Count audit supports partial provider failures and does not falsely claim a batch-level complete `revised` when any candidate is unqualified.
- [ ] Follow existing owner merge controls: one logical PR per implementation checkpoint, preview tests/type/lint/build PASS; post-merge live trace independently verified before #242 closure.
- [ ] No FRED selective polling activation (#230/#231) until #229 and observability gates are independently accepted.

**Decision requested after owner reviews this docs PR:** approve a **read-only bounded revision-classification proof first**, rather than activating any new live revision counter immediately. Choose indexed/transactional classification only if the bounded candidate read is insufficient and its operational cost is demonstrated.
