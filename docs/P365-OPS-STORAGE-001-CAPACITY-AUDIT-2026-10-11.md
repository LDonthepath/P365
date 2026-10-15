# P365 OPS-STORAGE-001 — Measured Supabase capacity and Free-plan runway

**Audit snapshot:** 2026-10-11 00:09–00:11 UTC (07:09–07:11 WIB). **Git baseline:** `main@a4e4fca57ccd36ae5d45d75f32013f2bea4c26e7`.
**Owner issue:** [#333](https://github.com/LDonthepath/P365/issues/333); [recovery roadmap #283](https://github.com/LDonthepath/P365/issues/283).

**Scope:** Evidence-only / read-only production inspection. No DDL, DML, provider calls, migration, cron invocation, retentions, backfill, purge, compaction, canonical mutation, or application-code change. No dashboard quota value was manually overridden.

## 1. Entitlement and limits — evidence hierarchy

| Question | Actual evidence / source | Verdict |
|---|---|---|
| Which project was measured? | Supabase `list_projects` / `get_project`: project ref `orwhuzexnuochctccqvl`, organization `faqfjngphgqmnahvzrqp`, region `ap-northeast-2`, `ACTIVE_HEALTHY` | **VERIFIED** |
| Actual organization plan? | Supabase management connector `get_organization(id=faqfjngphgqmnahvzrqp)` response `plan: free; tier: tier_free` (11 Oct 2026) | **FREE — VERIFIED BY ACCOUNT API** |
| Standard Free *database size* threshold? | [Official Supabase database/disk documentation](https://supabase.com/docs/guides/platform/database-size) and [official billing table](https://supabase.com/docs/guides/platform/billing-on-supabase): 500 MB per Free project; database enters read-only when size exceeds threshold | **500 MB — VERIFIED AS PUBLISHED PLAN LIMIT**, not a project-specific live quota response |
| Standard Free provisioned disk? | Same [official documentation](https://supabase.com/docs/guides/platform/database-size): 1 GB disk, which includes WAL and Postgres system files; **500 MB database size** is the distinct read-only trigger | **1 GB — PUBLISHED DEFAULT; PROJECT-SPECIFIC ACTUAL DISK ALLOCATION NOT READ** |
| Actual configured disk bytes / account-specific quota? | Supabase `get_project` and `get_organization` expose no live disk-allocation or account-specific quota field through this connector; no authenticated Infrastructure/Compute & Disk dashboard read occurred | **UNVERIFIED — OWNER DASHBOARD READBACK REQUIRED** |
| P365 code's `freePlanDatabaseLimitBytes=524288000`? | `public.p365_operational_metrics.metadata.freePlanDatabaseLimitBytes` stores that literal for each snapshot | **NOT ENTITLEMENT EVIDENCE.** 524,288,000 bytes is 500 MiB, distinct from decimal 500 MB |

**Conservative projection convention:** use 500,000,000 bytes as a **working interpretation of 500 MB**; Supabase public docs do not supply a byte-precision quota API response here. Parallel sensitivity check uses the P365 legacy 524,288,000-byte assumption. Do **not** treat either as a confirmed account-specific byte threshold. The 1 GB disk allocation is not a substitute for the Free database quota.

**Before closing #333:** owner/admin should confirm screenshot or authenticated readback at [project Database Settings / Infrastructure](https://supabase.com/dashboard/project/orwhuzexnuochctccqvl/settings/compute-and-disk) and [organization billing/usage](https://supabase.com/dashboard/org/faqfjngphgqmnahvzrqp/billing), noting measured/allocated disk, quota units and capture time. Link proof in issue. This API gap is explicit, not silently counted as PASS.

## 2. Exact physical database measurements

Postgres `current_database() = postgres`, engine 17.6; observed via read-only SQL, 11 Oct 2026 00:09:35–00:09:55 UTC.

| Object / metric | Physical bytes | Decimal MB | Notes |
|---|---:|---:|---|
| `pg_database_size(current_database())` | **322,628,755** | **322.629** | Total database, not disk/WAL capacity |
| `pg_total_relation_size('public.market_memory')` | **282,992,640** | **282.993** | 87.7% of database size; includes heap, indexes, TOAST |
| `pg_relation_size('public.market_memory')` | 201,105,408 | 201.105 | Main table heap |
| `pg_indexes_size('public.market_memory')` | **81,313,792** | **81.314** | All Market Memory indexes; ~28.7% of this relation |
| Market Memory relation remainder | 573,440 | 0.573 | Auxiliary/TOAST etc. |
| `pg_total_relation_size('cron.job_run_details')` | **27,017,216** | **27.017** | Includes index 925,696 bytes; ~8.4% of total DB |
| Other database size, residual | **12,618,899** | **12.619** | Difference, not an independently measured single table |
| `public.market_memory` row count | **176,127** | n/a | `MIN(captured_at)=2026-09-15 17:53:36.811Z` and `MAX=2026-10-11 00:07:02.179Z` |

**Important:** `pg_database_size` includes the complete database's physical objects but is not a measurement of provisioned disk including WAL or reserved system usage. WAL bytes and provisioned disk size **not directly verified**. Free-plan limitation described in official docs is the *database size*, so this SQL total is the appropriate read-only trend series, but byte-precise entitlement remains unconfirmed.

## 3. Historical physical-size trend (existing append-only operational snapshots; read-only SELECT)

These are *already-recorded* `p365_operational_metrics` with `metric_type='STORAGE_CAPACITY'`. The `metadata.databaseBytes` is measured `pg_database_size`; the metadata `freePlanDatabaseLimitBytes`, utilization and headroom fields are **calculated using an unverified constant**, so **only the raw measured bytes are accepted as observation**.

| `metadata.measuredAt` UTC | DB bytes | Market Memory bytes | Market Memory index bytes | pg_cron history bytes |
|---|---:|---:|---:|---:|
| 2026-10-05 13:32:13 | 269,880,467 | 232,243,200 | 62,889,984 | 25,124,864 |
| 2026-10-06 00:15:00 | 276,778,131 | 239,009,792 | 64,331,776 | 25,346,048 |
| 2026-10-07 00:15:00 | 291,269,779 | 253,026,304 | 67,330,048 | 25,821,184 |
| 2026-10-08 00:15:00 | 308,677,779 | 269,869,056 | 74,760,192 | 26,312,704 |
| 2026-10-09 00:15:00 | 318,762,131 | 279,289,856 | 77,627,392 | 26,910,720 |
| 2026-10-10 00:15:00 | 321,416,339 | 281,804,800 | 80,125,952 | 26,992,640 |
| **2026-10-11 00:09:35–00:09:55 (live SQL)** | **322,628,755** | **282,992,640** | **81,313,792** | **27,017,216** |

Full nearly equal-time daily intervals from 6→7 Oct, 7→8, 8→9, 9→10: **+14,491,648; +17,408,000; +10,084,352; +2,654,208 bytes/day** respectively. 10→11 Oct 00:15→00:09 is a near-24h interval: +1,212,416 bytes (lower-volume period). The five-interval 6 Oct 00:15→11 Oct 00:09 rate is **9,177,029 bytes/day** (approximate because of different time offsets).

From 5 Oct measured snapshot to 10 Oct snapshot, raw **database growth +51,535,872 bytes**; **Market Memory +49,561,600 bytes** and **cron history +1,867,776 bytes**. Main Market Memory indexes alone grew **+17,235,968 bytes**. **None** of these changes is attributed to a particular market family without direct physical per-family partitioning.

## 4. Family-level acquisition / growth proxy (canonical capturedAt, logical payload bytes)

Source grouping uses **`payload->>'sourceId'`**, not top-level `market_memory.source_id` (the top-level field is frequently NULL on post-15-Sep records). Classification uses `payload.identity.seriesKey` for OBSERVATION and `payload.subject` for EVIDENCE. Each row counted once and attributed to one family. Grouped bytes use **`SUM(pg_column_size(payload))`**, measuring *stored JSONB payload datum size*, **not actual table/TOAST/index physical allocation per family**. Physical disk grows differently because of row overhead, alignment, index pages, bloat and maintenance. Never sum this table as a full database disk-growth measurement.

| UTC day | BTC spot 5m rows / payload B | Gold COMEX futures 5m rows / B | Binance BTCUSDT flow 5m rows / B | GDELT BTC/Gold rows / B | Other canonical rows / B |
|---|---|---|---|---|---|
| Oct 05 | 576 / 555,720 | 554 / 560,732 | 288 / 396,596 | 192 / 240,123 | 4,960 / 4,765,301 |
| Oct 06 | 576 / 555,624 | 552 / 558,896 | 288 / 396,138 | 192 / 246,002 | 4,186 / 4,095,568 |
| Oct 07 | 572 / 552,420 | 554 / 561,320 | 288 / 396,732 | 190 / 247,295 | 2,643 / 2,676,113 |
| Oct 08 | 576 / 556,230 | 554 / 561,100 | 288 / 396,908 | 190 / 245,071 | 2,637 / 2,678,660 |
| Oct 09 | 576 / 555,540 | 510 / 515,526 | 288 / 396,408 | 192 / 251,195 | 2,499 / 2,532,935 |
| Oct 10 | 576 / 555,360 | 2 / 2,026 | 288 / 396,218 | 192 / 228,989 | 910 / 862,589 |

At nominal complete-cadence days:
- **BTC 5m:** ~288 Observation plus ~288 Evidence daily; ~0.55 MB of payload/day total (the paired Evidence must not be forgotten).
- **Gold futures 5m:** ~255–277 Observation plus paired Evidence on the observed trading days; ~0.52–0.56 MB payload/day; Oct 10 has only 2 rows — a directly observed drop, not assumed missing history or synthetic weekend inserts. It is **COMEX Gold futures `GC=F`, not verified XAU/USD spot**.
- **Binance BTCUSDT completed 5m taker flow:** ~288 Evidence rows/day; ~0.396 MB payload/day.
- **GDELT BTC/Gold news candidates:** ~190–192 Evidence rows/day; ~0.23–0.25 MB payload/day.
- **Other records are substantive**; total database capacity cannot be explained by four popular families alone. Add exact per-series breakdowns if the product scope changes; do not relabel news as intraday causal evidence.

**pg_cron separately:** `cron.job_run_details` currently 27,017,216 total bytes, 28,873 estimated rows, read-only SQL daily job-run counts: 873 (Oct 5), 874 (Oct 6), 874 (Oct 7), 989 (Oct 8), 1,184 (Oct 9), 1,186 (Oct 10). The direct `SUM(pg_column_size(jr))` is approximately 0.48–0.61 MB/day *logical row datums*, not exact heap/index growth. Active scheduled `p365-pg-cron-log-retention` exists; **do not edit or run it**. Verify its policy and protected holds in separate #228 work before even proposing any noncanonical purge.

## 5. Runway, uncertainty and owner decision

As of 11 Oct 00:09:35 UTC, conservative **working** 500,000,000-byte database reference minus measured 322,628,755 bytes gives **177,371,245 bytes remaining** (64.53% utilized). If true byte interpretation is the old code's 500 MiB = 524,288,000 bytes, remaining would be **201,659,245 bytes** instead. **Neither byte boundary is presented as a confirmed project-level quota API reading.**

| Scenario | Observed basis | Assumed increase (bytes/day) | Runway using 500 MB | Implied calendar date, approximate |
|---|---|---:|---:|---|
| **Fast** | Max complete-day increase, Oct 7→8 | 17,408,000 | **10.2 days** | ~21 Oct 2026 |
| **Middle** | Five-interval trend, Oct 6→11 (elapsed-time normalized) | 9,177,029 | **19.3 days** | ~30 Oct 2026 |
| **Slow** | Min complete-day increase, Oct 9→10 | 2,654,208 | **66.8 days** | ~17 Dec 2026 WIB |

Under hypothetical 500 MiB: fast **11.6 days**, middle **22.0 days**, slow **76.0 days**. The even slower Oct 10→11 near-24h period is observed but excluded from the main slow-case selection to avoid falsely assuming sustained low activity. **These are extrapolations, not forecasts or exact exhaustion dates.** Only days of data, workloads and index page growth are nonstationary, and quotas/read-only enforcement can differ from the simplified linear assumption. Supabase also documents separate organization fair-use conditions based on billing-period average, not captured by point-in-time database size alone.

**Urgent owner decision, do not wait for G1:** actual plan is Free and both fast/middle runways are under a month. Choose one of:
1. **Upgrade organization to Pro** (separate owner billing authorization). Official Supabase billing advertises **8 GB initial disk included** and paid disk expansion; cost/plan applicability and spend cap must be checked by owner before purchase. No upgrade in this audit.
2. **Open a separate, owner-approved scoped retention/capacity issue**, first qualify noncanonical `pg_cron` / operational-log retention and proof holds, backup/rollback, and before/after counts. **Canonical `market_memory` is append-only and not a deletion candidate in this issue.** It is not proven that trimming logs alone would buy a full month.

**Alert design proposal only; not implemented:** run daily read-only capacity measurements, retain measuredAt, measuredBytes, source/entitlement freshness; warn on either estimated runway <30 days or verified utilization >=70%, escalate at <14 days or >=80%, critical at <7 days or >=90%. Do **not** activate hardcoded alerts until project-specific quota bytes / disk quota are corroborated in dashboard or management API. Existing storage metrics record the *assumed* quota, so downstream display must not label it verified. Raise stale/missing plan-data as `QUOTA_UNVERIFIED`.

**Decision/closure gate:** documented evidence is suitable for owner review, but #333 is **NOT YET FULLY VERIFIED/CLOSABLE** until project-specific quota/disk-allocation proof is attached and the owner records upgrade vs separately owned noncanonical retention choice. A green PR CI or a merged doc does not prove those two operational decisions.

## 6. Reproducible, READ-ONLY measurement SQL

All queries below are SELECT statements. Do **not** execute maintenance commands, purge historical rows, write artificial metrics, or invoke cron as part of this audit.

```sql
-- Current physical usage at actual query time (not an app hardcoded quota)
SELECT (now() AT TIME ZONE 'UTC') AS measured_utc,
       pg_database_size(current_database())::bigint AS database_bytes,
       pg_total_relation_size('public.market_memory')::bigint AS memory_total_bytes,
       pg_relation_size('public.market_memory')::bigint AS memory_heap_bytes,
       pg_indexes_size('public.market_memory')::bigint AS memory_index_bytes,
       pg_total_relation_size('cron.job_run_details')::bigint AS cron_history_total_bytes;
```

```sql
-- Historical actual measurement field ONLY; ignore hardcoded quota/utilization metadata.
SELECT metadata->>'measuredAt' AS measured_utc,
       (metadata->>'databaseBytes')::bigint AS database_bytes,
       (metadata->>'marketMemoryTotalBytes')::bigint AS memory_total_bytes,
       (metadata->>'marketMemoryIndexBytes')::bigint AS memory_index_bytes,
       (metadata->>'cronJobRunDetailsBytes')::bigint AS cron_total_bytes
FROM public.p365_operational_metrics
WHERE metric_type='STORAGE_CAPACITY'
ORDER BY (metadata->>'measuredAt')::timestamptz;
```

```sql
-- Family rows and logical JSONB payload sizes (NOT per-family physical disk size).
WITH family_records AS (
  SELECT (captured_at AT TIME ZONE 'UTC')::date AS day_utc,
    CASE
      WHEN payload->>'sourceId'='coingecko-market'
       AND (payload#>>'{identity,seriesKey}'='btc.spot.usd' OR
            (record_type='EVIDENCE' AND payload->>'subject'='btc.spot.usd'))
       THEN 'BTC spot 5m'
      WHEN payload->>'sourceId'='yahoo-finance'
       AND (payload#>>'{identity,seriesKey}'='gold.futures.usd' OR payload->>'subject'='gold.futures.usd')
       THEN 'Gold COMEX futures 5m'
      WHEN payload->>'sourceId'='binance-spot' THEN 'Binance 5m taker flow'
      WHEN payload->>'sourceId'='gdelt' THEN 'GDELT'
      ELSE 'Other Market Memory'
    END AS family,
    pg_column_size(payload) AS payload_bytes
  FROM public.market_memory
  WHERE captured_at >= '2026-10-05T00:00:00Z' AND captured_at < '2026-10-11T00:00:00Z'
)
SELECT day_utc,family,count(*) AS rows,
       sum(payload_bytes)::bigint AS logical_payload_bytes
FROM family_records GROUP BY 1,2 ORDER BY 1,2;
```

```sql
-- Cron log observations only, grouped by UTC date (no job execution).
SELECT (start_time AT TIME ZONE 'UTC')::date AS day_utc,
       count(*) AS logged_runs,
       sum(pg_column_size(jr))::bigint AS logical_row_bytes
FROM cron.job_run_details jr
WHERE start_time >= '2026-10-05T00:00:00Z'
GROUP BY 1 ORDER BY 1;
```

## Review and verification checklist

- [x] Current main SHA, issue, and no competing PR recorded.
- [x] Account plan Free **proven via management API**; standard public Free database/disk terms linked.
- [ ] **Project-specific provisioned disk/quota readback from dashboard or API** — pending, must not be replaced by code constant.
- [x] Raw dated total database, Market Memory heap/index/total, cron-log sizes and historical snapshots.
- [x] Per-family BTC, Gold COMEX, Binance, GDELT daily row/payload breakdown with physical allocation limitation.
- [x] Multi-rate runway range, read-only methods and owner-choice escalation under 30 days.
- [x] No schema/cron/retention/memory mutations; documentation-only checkpoint.
- [ ] Owner reviews/merges PR; merged SHA and doc presence reverified.
- [ ] Owner records upgrade or independent retention issue choice; evidence accepted; issue only then VERIFIED/CLOSED.
