-- MACRO-CUT-004 / issue #455: READ ONLY inventory; never alters history or cron.
-- Run using a read-only transaction / role. Numbers are naturally time-sensitive.
-- CAUTION: source_id is NULL for ~98% of records, use effective source every time.
SELECT now() AS checked_utc, current_database() AS database_name,
       count(*) AS market_memory_rows,
       count(*) FILTER (WHERE source_id IS NULL) AS source_column_null,
       count(*) FILTER (WHERE source_id IS NULL AND payload->>'sourceId' IS NULL) AS source_both_missing,
       count(*) FILTER (WHERE source_id IS NOT NULL AND payload->>'sourceId' IS NOT NULL
                                AND source_id <> payload->>'sourceId') AS source_conflicts,
       pg_size_pretty(pg_total_relation_size('public.market_memory')) AS market_memory_plus_indexes,
       pg_size_pretty(pg_database_size(current_database())) AS database_total
FROM public.market_memory;

-- Physical row and JSON payload size grouped by BOTH record family and effective source.
SELECT COALESCE(source_id, payload->>'sourceId', '<unattributed>') AS effective_source,
       record_type, count(*) AS physical_rows, sum(pg_column_size(payload))::bigint AS payload_bytes,
       min(captured_at) AS first_capture, max(captured_at) AS last_capture
FROM public.market_memory
GROUP BY 1,2 ORDER BY payload_bytes DESC;

-- Review classification, NOT an executable DELETE manifest.
WITH grouped AS (
  SELECT COALESCE(source_id, payload->>'sourceId', '<unattributed>') AS source,
         count(*) AS n, sum(pg_column_size(payload)) AS b
  FROM public.market_memory GROUP BY 1
)
SELECT CASE WHEN source IN ('fred','gdelt','biquote','federal-reserve','forex-factory')
                 THEN 'RETAIN_PROTECTED'
            WHEN source IN ('coingecko-market','yahoo-finance','binance-spot',
                 'cftc-gold-cot','defillama-stablecoins','sosovalue-etf-flow',
                 'alpha-vantage','coindesk','alpha-vantage-market')
                 THEN 'CANDIDATE_REVIEW_NOT_APPROVED'
            ELSE 'UNKNOWN_RETAIN_UNTIL_QUALIFIED' END AS decision,
       sum(n) AS physical_rows, sum(b)::bigint AS payload_bytes,
       array_agg(source ORDER BY source) AS sources
FROM grouped GROUP BY 1 ORDER BY 1;

-- Snapshot OBSERVATION and EVIDENCE references: no orphaning allowed.
WITH obs_refs AS (
  SELECT DISTINCT unnest(observation_ids) AS ref FROM public.market_memory WHERE record_type='SNAPSHOT'
), ev_refs AS (
  SELECT DISTINCT unnest(evidence_ids) AS ref FROM public.market_memory WHERE record_type='SNAPSHOT'
), obs AS (
  SELECT COALESCE(m.source_id,m.payload->>'sourceId','<unattributed>') AS effective_source,
         count(DISTINCT r.ref) AS referenced_canonical_ids, count(*) AS referenced_physical_rows
  FROM obs_refs r JOIN public.market_memory m ON m.record_type='OBSERVATION' AND m.canonical_id=r.ref
  GROUP BY 1
), ev AS (
  SELECT COALESCE(m.source_id,m.payload->>'sourceId','<unattributed>') AS effective_source,
         count(DISTINCT r.ref) AS referenced_canonical_ids, count(*) AS referenced_physical_rows
  FROM ev_refs r JOIN public.market_memory m ON m.record_type='EVIDENCE' AND m.canonical_id=r.ref
  GROUP BY 1
)
SELECT 'SNAPSHOT.OBSERVATION' AS reference_family,* FROM obs
UNION ALL SELECT 'SNAPSHOT.EVIDENCE',* FROM ev ORDER BY 1,4 DESC;

-- Context's JSON observation IDs are independent of the physical observation_ids column.
WITH refs AS (
  SELECT DISTINCT v.value AS ref
  FROM public.market_memory c
  CROSS JOIN LATERAL jsonb_array_elements_text(c.payload->'observationIds') AS v(value)
  WHERE c.record_type='CONTEXT' AND jsonb_typeof(c.payload->'observationIds')='array'
)
SELECT COALESCE(m.source_id,m.payload->>'sourceId','<unattributed>') AS effective_source,
       count(DISTINCT refs.ref) AS referenced_canonical_ids, count(*) AS referenced_physical_rows
FROM refs JOIN public.market_memory m ON m.record_type='OBSERVATION' AND m.canonical_id=refs.ref
GROUP BY 1 ORDER BY referenced_physical_rows DESC;

-- Cron command fingerprint and actual selector, never print secret-bearing command text.
SELECT j.jobid,j.jobname,j.active,j.schedule,
       md5(j.command) AS command_fingerprint,
       position('providers=fred' in j.command)>0 AS calls_fred,
       position('providers=gdelt' in j.command)>0 AS calls_gdelt,
       position('providers=coingecko-context' in j.command)>0 AS calls_legacy_coingecko_context,
       position('snapshot-capture' in j.command)>0 AS calls_snapshot,
       position('event-ingestion' in j.command)>0 AS calls_event_ingestion
FROM cron.job j WHERE j.jobid IN (2,3,4,5,6,10,15,20,23,24,25)
ORDER BY j.jobid;

-- Post owner-approval retirement proof (15 Oct 2026): zero live retired jobs
-- AND four exact private snapshots with unchanged command fingerprints.
-- DO NOT print or export the privately stored command field.
WITH live AS (
  SELECT count(*) AS n FROM cron.job WHERE jobid IN (4,10,15,20)
), saved AS (
  SELECT count(*) AS n,
         bool_and(NOT original_active AND retired_at IS NOT NULL
                    AND md5(command)=command_fingerprint) AS valid
  FROM p365_ops.macro_cut_004_cron_rollback
)
SELECT CASE WHEN live.n=0 AND saved.n=4 AND saved.valid
            THEN 'PASS_RETIRED_WITH_PRIVATE_ROLLBACK'
            ELSE 'STOP_RETIRED_CRON_DRIFT' END AS retired_jobs_guard
FROM live CROSS JOIN saved;

-- Protect actively running retained jobs and intentionally inactive Biquote #3.
SELECT CASE WHEN count(*)=7 AND bool_and(CASE WHEN jobid=3 THEN NOT active ELSE active END)
 THEN 'PASS_RETAINED_CRON_STATE' ELSE 'STOP_RETAINED_CRON_DRIFT' END AS retained_jobs_guard
FROM cron.job WHERE jobid IN (2,3,5,6,23,24,25);
