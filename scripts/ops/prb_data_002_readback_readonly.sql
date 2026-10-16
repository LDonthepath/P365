-- PRB-DATA-002 / #364. SELECT-ONLY before/after checkpoint.
-- Run against production with a read-only operator; archive both outputs privately.
-- Target: 4 SA monthly FRED index series, Sep 2024 - Aug 2026 inclusive.
-- Never use observation period or FRED vintage date as availability/release instant.

-- A. Measured capacity and cron state; published Free quota is NOT verified project entitlement.
SELECT now() AS measured_at_utc,
       pg_database_size(current_database()) AS database_bytes,
       pg_total_relation_size('public.market_memory') AS market_memory_bytes,
       pg_indexes_size('public.market_memory') AS market_memory_index_bytes,
       (SELECT count(*) FROM cron.job WHERE active) AS active_jobs;

-- B. Per-series raw count, unique periods/keys, native revisions, availability and 12m pairs.
WITH target(series) AS (
  VALUES ('CPIAUCSL'),('CPILFESL'),('PCEPI'),('PCEPILFE')
), calendar AS (
  SELECT generate_series(date '2024-09-01',date '2026-08-01',interval '1 month')::date AS period
), obs AS (
  SELECT payload->'metadata'->>'seriesId' AS series,
         (payload->'metadata'->>'observationDate')::date AS period,
         canonical_id, dedupe_key, captured_at, effective_at,
         payload->>'value' AS value, payload->>'retrievedAt' AS retrieved_at,
         payload->'metadata'->>'vintageDate' AS vintage,
         payload->'metadata'->>'releaseDate' AS native_release
  FROM public.market_memory
  WHERE record_type = 'OBSERVATION'
    AND COALESCE(source_id, payload->>'sourceId') = 'fred'
    AND payload->'metadata'->>'seriesId' IN ('CPIAUCSL','CPILFESL','PCEPI','PCEPILFE')
), target_observations AS (
  SELECT * FROM obs WHERE period BETWEEN date '2024-09-01' AND date '2026-08-01'
)
SELECT t.series,
  (SELECT count(*) FROM target_observations o WHERE o.series=t.series) AS physical_rows_in_window,
  (SELECT count(DISTINCT o.canonical_id) FROM target_observations o WHERE o.series=t.series) AS canonical_ids,
  (SELECT count(DISTINCT o.dedupe_key) FROM target_observations o WHERE o.series=t.series) AS physical_dedupe_keys,
  (SELECT count(DISTINCT o.period) FROM target_observations o WHERE o.series=t.series) AS distinct_periods,
  (SELECT count(*) FROM calendar p WHERE NOT EXISTS (
       SELECT 1 FROM target_observations o WHERE o.series=t.series AND o.period=p.period
   )) AS missing_periods,
  (SELECT count(*) FROM calendar p WHERE p.period BETWEEN date '2025-09-01' AND date '2026-08-01'
    AND EXISTS (SELECT 1 FROM target_observations o WHERE o.series=t.series AND o.period=p.period)
    AND EXISTS (SELECT 1 FROM target_observations o WHERE o.series=t.series AND o.period=(p.period-interval '12 months')::date)
  ) AS structural_yoy_pairs,
  (SELECT count(DISTINCT (o.period,o.value)) FROM target_observations o WHERE o.series=t.series) AS factual_period_value_versions,
  (SELECT count(*) FROM target_observations o WHERE o.series=t.series AND o.native_release IS NOT NULL) AS native_release_dates
FROM target t ORDER BY t.series;

-- C. Missing-period matrix, one row per missing series-month; currently expected 62.
WITH target(series) AS (
  VALUES ('CPIAUCSL'),('CPILFESL'),('PCEPI'),('PCEPILFE')
), calendar AS (
  SELECT generate_series(date '2024-09-01',date '2026-08-01',interval '1 month')::date AS period
)
SELECT t.series, c.period AS missing_period
FROM target t CROSS JOIN calendar c
WHERE NOT EXISTS (
  SELECT 1 FROM public.market_memory m
  WHERE m.record_type = 'OBSERVATION'
    AND COALESCE(m.source_id, m.payload->>'sourceId') = 'fred'
    AND m.payload->'metadata'->>'seriesId' = t.series
    AND m.payload->'metadata'->>'observationDate' = to_char(c.period,'YYYY-MM-DD')
)
ORDER BY t.series,c.period;

-- D. Revision/identity lineage for every version of the same period; immutable rows.
SELECT payload->'metadata'->>'seriesId' AS series,
       payload->'metadata'->>'observationDate' AS observation_period,
       canonical_id, dedupe_key, effective_at, captured_at,
       payload->>'retrievedAt' AS retrieved_at,
       payload->'metadata'->>'vintageDate' AS vintage_date,
       payload->'metadata'->>'releasedAt' AS released_at,
       payload->>'value' AS source_value
FROM public.market_memory
WHERE record_type='OBSERVATION'
  AND COALESCE(source_id,payload->>'sourceId')='fred'
  AND payload->'metadata'->>'seriesId' IN ('CPIAUCSL','CPILFESL','PCEPI','PCEPILFE')
  AND payload->'metadata'->>'observationDate' BETWEEN '2024-09-01' AND '2026-08-01'
ORDER BY series, observation_period, captured_at, canonical_id;
