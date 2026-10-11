# OPS-FREE-001A — daily storage-risk telemetry activation

**Owner issue:** [#348](https://github.com/LDonthepath/P365/issues/348). **P0, no automatic production activation.**
**Baseline:** `main@a4e4fca57ccd36ae5d45d75f32013f2bea4c26e7` (11 Oct 2026).

## Exactly one outcome

The existing Supabase `p365-storage-daily` scheduled collection retains its name, UTC 00:15 schedule, at-most-one-snapshot/day semantics and the canonical 5-minute ingestion lanes. The **proposed** command makes operator-readable risk bands computed from observed database bytes and trend (up to seven days) and annotates that account-specific quota bytes remain **UNVERIFIED**.

**This is early-warning telemetry, not an email/page, not a DB-size reduction, and not an activated job until owner approval.** No destructive change, no new job, no SQL table/schema changes, no COLD/archive, no data thinning, no provider modifications, no extra recurring writes. It does not imply a 3MB/day goal is currently attainable.

## Source evidence (live checked)

- Supabase management API: organization Free (11 Oct 2026), project ref `orwhuzexnuochctccqvl` ACTIVE_HEALTHY.
- 11 Oct 2026 00:09 UTC `pg_database_size` **322,628,755 B**, Market Memory total **282,992,640 B**, cron logs total **27,017,216 B**.
- Six previous `STORAGE_CAPACITY` snapshots have dates and raw database bytes. Legacy `freePlanDatabaseLimitBytes=524288000` was never a project-verified quota.
- Documented standard Free **500 MB database** / **1 GB disk** is **not** a live account-specific quota readback. [Supabase docs](https://supabase.com/docs/guides/platform/database-size).
- Source [issue #333](https://github.com/LDonthepath/P365/issues/333), [draft audit PR #347](https://github.com/LDonthepath/P365/pull/347).
- Existing `p365-pg-cron-log-retention` #235 is ALREADY active; do not reconfigure it as part of this change.

## Policy

- ABSOLUTE database-size bands: warning at **375,000,000 B**, escalation **425,000,000 B**, critical **450,000,000 B**.
- Trend-based bands (only with qualifying sample): <=30 days warning, <=14 days escalation, <=7 days critical.
- Trend from the earliest valid snapshot within seven days, if at least 24h between baseline and present and latest snapshot <=72h old; otherwise `INSUFFICIENT_HISTORY`. Negative/zero growth yields `NON_POSITIVE_GROWTH`, not fabricated infinite runway.
- Trend rate and days to **published Free reference** are coarse scenario outputs, not billing guarantees. A hardcoded account-specific quota is never emitted as `VERIFIED`. Missing quota verification is explicit even if risk is below operational thresholds.
- Historical v1 rows remain intact and readable; new v2 metadata contains the existing measurement names for compatibility and adds nested `risk`. v1 `databaseUtilizationPct`, `freePlanDatabaseLimitBytes` and `estimatedHeadroomBytes` are **not** copied because they were based on an unverified byte limit.
- **Operator alert limitation:** the risk flag is persisted in daily `p365_operational_metrics` and must be checked in the Supabase SQL editor / observability workflow. There is no push notification. Daily cadence is not a realtime emergency stop.

## Procedure / rollback (OWNER-GATED)

1. Owner reviews PR, one logical change, verifies SQL and CI. Owner merges; verify merged `main` and production deployment.
2. Before SQL activation, read current job as postgres (do not reveal credentials):
   ```sql
   SELECT jobid,jobname,schedule,active,command FROM cron.job
   WHERE jobname='p365-storage-daily';
   ```
   Preserve its **exact prior `command`** privately for rollback. Confirm **one** active matching job, exactly `15 0 * * *`, and snapshot table compatibility. Confirm no unrelated job changed.
3. Explicit separate owner permission is required to execute `scripts/ops/ops_free_001a_storage_guardrail.sql`. It only calls `cron.alter_job` for the verified matching active job; it **does not execute the daily job immediately**, write or remove any Market Memory record, or change cadence.
4. Read back `cron.job` command and compare job count/schedule/active status before vs after. Following the **next natural 00:15 UTC run**, read the new snapshot, `risk.band` and `risk.projectQuotaStatus` and inspect errors. If owner needs same-day proof, use read-only SELECT to evaluate projections; do not call cron manually.
5. If anything regresses, revert the job command using `cron.alter_job` with the privately saved original command. Retain newly written v2 snapshot records as historical telemetry; do not DELETE v1/v2 logs or canonical facts. No rollback requires schema deletion.
6. Track at least three to seven subsequent days of actual database growth `pg_database_size`; verify alert correctness and market-data freshness. No claims of savings until a separate, owner-approved write-path optimization has measured actual rows/day and DB bytes/day.

## Verification queries (READ ONLY)

```sql
SELECT (now() AT TIME ZONE 'UTC') AS measured_utc,
  pg_database_size(current_database())::bigint AS database_bytes,
  pg_total_relation_size('public.market_memory')::bigint AS market_memory_bytes,
  pg_total_relation_size('cron.job_run_details')::bigint AS cron_history_bytes;
```

```sql
SELECT occurred_at, metadata->>'schemaVersion' AS schema_version,
  (metadata->>'databaseBytes')::bigint AS measured_bytes,
  metadata#>>'{risk,band}' AS risk_band,
  metadata#>>'{risk,growthBytesPerDay}' AS growth_bytes_day,
  metadata#>>'{risk,estimatedDaysToPublishedReference}' AS hypothetical_runway_days,
  metadata#>>'{risk,trendQuality}' AS trend_quality,
  metadata#>>'{risk,projectQuotaStatus}' AS quota_verification
FROM public.p365_operational_metrics
WHERE metric_type='STORAGE_CAPACITY'
ORDER BY occurred_at DESC LIMIT 10;
```

## Test boundary

Node test fixture `lib/application/storage-capacity-guardrail.test.ts` verifies operational threshold boundary and source SQL safety. **It is not PostgreSQL SQL syntax/runtime validation**. Independent read-only SQL on production validates sample-size/growth/risk classification before owner authorizes modifying `cron.job`; natural production snapshot after activation remains final gate. Do not call the job during PR review.

## Remaining program work (other issues only)

Goal `<3MB/day` is *unproven* and likely infeasible at current fast sampling without trading off core history. Prior #232/#233 failed to identify safe redundant physical writes, and #235 already owns retention. A separately authorized issue needs before/after **physical** write evidence before changing CoinGecko slow context cadence, making archive/policy tradeoffs, or limiting noncritical ingestion. No deletion/compaction of canonical Market Memory without new owner-approved contract.
