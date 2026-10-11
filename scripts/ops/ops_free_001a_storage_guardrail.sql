-- OPS-FREE-001A / #348 — proposed existing-job capacity-risk telemetry upgrade.
-- INSTALL/ACTIVATION ONLY; DO NOT RUN without explicit owner approval *after* merge.
-- Changes the command of ONE existing cron job; schedule, job count and name remain unchanged.
-- NO canonical DELETE/UPDATE, no compaction, no VACUUM, no new schema/provider/dependency.
--
-- Preflight before owner-approved activation (READ ONLY):
-- SELECT jobid,jobname,schedule,active,command FROM cron.job
-- WHERE jobname='p365-storage-daily';
-- Save the previous command securely for rollback. Do not rely on this file as its backup.
--
-- After approval, run this statement once as postgres. If activation fails, no scheduler
-- command should be considered upgraded. Retain the original command for rollback:
-- SELECT cron.alter_job(job_id => <actual jobid>, command => <saved previous command>);
--
-- Existing snapshot v1 rows remain unchanged; v2 adds a separate risk metadata namespace.
-- Operational thresholds are ABSOLUTE DATABASE BYTES, not percentages of a guessed quota.
-- The 500 MB scenario is a PUBLISHED Free-plan reference, NOT an account quota readback.
-- No user-facing alert delivery is provided by pg_cron: this is operator-readable telemetry.

DO $activation$
DECLARE
  v_jobid bigint;
  v_schedule text;
BEGIN
  SELECT jobid, schedule INTO STRICT v_jobid, v_schedule
  FROM cron.job
  WHERE jobname = 'p365-storage-daily' AND active IS TRUE;

  IF v_schedule <> '15 0 * * *' THEN
    RAISE EXCEPTION 'Unexpected storage monitoring cadence: %', v_schedule;
  END IF;

  PERFORM cron.alter_job(
    job_id => v_jobid,
    command => $daily$
WITH constants AS (
  SELECT
    (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS snapshot_day_utc,
    375000000::bigint AS warning_bytes,
    425000000::bigint AS escalation_bytes,
    450000000::bigint AS critical_bytes,
    500000000::bigint AS published_free_reference_bytes
),
measured AS (
  SELECT
    now() AS measured_at,
    pg_database_size(current_database())::bigint AS database_bytes,
    pg_total_relation_size('public.market_memory'::regclass)::bigint AS market_memory_total_bytes,
    pg_relation_size('public.market_memory'::regclass)::bigint AS market_memory_heap_bytes,
    pg_indexes_size('public.market_memory'::regclass)::bigint AS market_memory_index_bytes,
    pg_total_relation_size('cron.job_run_details'::regclass)::bigint AS cron_job_run_details_bytes,
    (SELECT count(*) FROM public.market_memory)::bigint AS market_memory_rows,
    (SELECT count(*) FROM public.market_memory WHERE record_type='EVIDENCE')::bigint AS evidence_rows,
    (SELECT count(*) FROM public.market_memory WHERE record_type='OBSERVATION')::bigint AS observation_rows
),
history AS (
  SELECT
    (metadata->>'measuredAt')::timestamptz AS measured_at,
    (metadata->>'databaseBytes')::bigint AS database_bytes
  FROM public.p365_operational_metrics
  WHERE metric_type='STORAGE_CAPACITY'
    AND provider='supabase-postgres'
    AND reason='DAILY_STORAGE_CAPACITY_SNAPSHOT'
    AND metadata->>'measuredAt' IS NOT NULL
    AND metadata->>'databaseBytes' ~ '^[0-9]+$'
    AND (metadata->>'measuredAt')::timestamptz >= now() - interval '7 days'
    AND (metadata->>'measuredAt')::timestamptz < now()
),
recent AS (
  SELECT max(measured_at) AS last_at, count(*) AS sample_count
  FROM history
),
baseline AS (
  SELECT h.measured_at, h.database_bytes
  FROM history h
  CROSS JOIN recent r
  WHERE r.last_at >= now() - interval '72 hours'
  ORDER BY h.measured_at ASC LIMIT 1
),
trend AS (
  SELECT
    r.sample_count,
    b.measured_at AS baseline_at,
    r.last_at,
    CASE
      WHEN b.measured_at IS NOT NULL
       AND r.last_at >= m.measured_at - interval '72 hours'
       AND m.measured_at - b.measured_at >= interval '24 hours'
      THEN round(
        (m.database_bytes - b.database_bytes)::numeric * 86400 /
        NULLIF(extract(epoch FROM m.measured_at - b.measured_at), 0), 0
      )::bigint
      ELSE NULL
    END AS growth_bytes_per_day
  FROM measured m CROSS JOIN recent r LEFT JOIN baseline b ON TRUE
),
risk AS (
  SELECT
    CASE WHEN t.growth_bytes_per_day > 0
      THEN round(
        greatest(c.published_free_reference_bytes - m.database_bytes, 0)::numeric /
        t.growth_bytes_per_day, 1
      )
      ELSE NULL
    END AS scenario_runway_days,
    CASE
      WHEN t.growth_bytes_per_day IS NULL THEN 'INSUFFICIENT_HISTORY'
      WHEN t.growth_bytes_per_day <= 0 THEN 'NON_POSITIVE_GROWTH'
      WHEN t.sample_count < 3 OR m.measured_at - t.baseline_at < interval '3 days'
        THEN 'SHORT_WINDOW'
      ELSE 'SHORT_HISTORY_ESTIMATE'
    END AS trend_quality
  FROM measured m CROSS JOIN trend t CROSS JOIN constants c
),
decision AS (
  SELECT
    CASE
      WHEN m.database_bytes >= c.critical_bytes OR
           (r.scenario_runway_days IS NOT NULL AND r.scenario_runway_days <= 7)
        THEN 'CRITICAL'
      WHEN m.database_bytes >= c.escalation_bytes OR
           (r.scenario_runway_days IS NOT NULL AND r.scenario_runway_days <= 14)
        THEN 'ESCALATION'
      WHEN m.database_bytes >= c.warning_bytes OR
           (r.scenario_runway_days IS NOT NULL AND r.scenario_runway_days <= 30)
        THEN 'WARNING'
      ELSE 'BELOW_OPERATING_THRESHOLDS'
    END AS risk_band
  FROM measured m CROSS JOIN constants c CROSS JOIN risk r
)
INSERT INTO public.p365_operational_metrics (
  metric_type,provider,cache_group,reason,occurred_at,metadata
)
SELECT
  'STORAGE_CAPACITY','supabase-postgres',NULL,'DAILY_STORAGE_CAPACITY_SNAPSHOT',
  c.snapshot_day_utc,
  jsonb_build_object(
    'schemaVersion','ops-free-storage-risk-v2',
    'measuredAt',m.measured_at,
    'databaseBytes',m.database_bytes,
    'marketMemoryTotalBytes',m.market_memory_total_bytes,
    'marketMemoryHeapBytes',m.market_memory_heap_bytes,
    'marketMemoryIndexBytes',m.market_memory_index_bytes,
    'cronJobRunDetailsBytes',m.cron_job_run_details_bytes,
    'marketMemoryRows',m.market_memory_rows,
    'evidenceRows',m.evidence_rows,
    'observationRows',m.observation_rows,
    'risk',jsonb_build_object(
      'band',d.risk_band,
      'warningAtBytes',c.warning_bytes,
      'escalationAtBytes',c.escalation_bytes,
      'criticalAtBytes',c.critical_bytes,
      'thresholdMeaning','ABSOLUTE_OPERATIONAL_NOT_QUOTA_PERCENT',
      'projectQuotaStatus','UNVERIFIED',
      'verifiedProjectQuotaBytes',NULL,
      'publishedFreeReferenceBytes',c.published_free_reference_bytes,
      'publishedReferenceStatus','DOCUMENTATION_ONLY_NOT_ACCOUNT_SPECIFIC',
      'sourcePlanCheckAt','2026-10-11T00:09:35Z',
      'sourcePlanCheck','SUPABASE_ORGANIZATION_API_FREE_AT_SNAPSHOT_ONLY',
      'trendQuality',r.trend_quality,
      'trendSamples',t.sample_count,
      'trendBaselineAt',t.baseline_at,
      'trendLatestAt',t.last_at,
      'growthBytesPerDay',t.growth_bytes_per_day,
      'estimatedDaysToPublishedReference',r.scenario_runway_days,
      'forecastCaveat','SHORT_NONSTATIONARY_HISTORY_NOT_EXACT_RUNWAY'
    )
  )
FROM constants c
CROSS JOIN measured m
CROSS JOIN trend t
CROSS JOIN risk r
CROSS JOIN decision d
WHERE NOT EXISTS (
  SELECT 1 FROM public.p365_operational_metrics prior
  WHERE prior.metric_type='STORAGE_CAPACITY'
    AND prior.provider='supabase-postgres'
    AND prior.reason='DAILY_STORAGE_CAPACITY_SNAPSHOT'
    AND prior.occurred_at=c.snapshot_day_utc
);
$daily$
  );
END
$activation$;

-- Read-only operator validation AFTER approved activation and next natural run:
-- SELECT occurred_at,metadata->>'databaseBytes' AS measured_bytes,
-- metadata#>>'{risk,band}' AS risk_band,
-- metadata#>>'{risk,trendQuality}' AS trend_quality,
-- metadata#>>'{risk,projectQuotaStatus}' AS actual_quota_verification
-- FROM public.p365_operational_metrics
-- WHERE metric_type='STORAGE_CAPACITY' ORDER BY occurred_at DESC LIMIT 8;
