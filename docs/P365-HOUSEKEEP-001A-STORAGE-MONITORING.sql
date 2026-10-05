-- HOUSEKEEP-001A — Daily Storage Capacity Monitoring
--
-- Activation boundary:
--   * Commit/review first.
--   * Do not execute this file against production until the owner merges HOUSEKEEP-001A.1.
--   * This job only records operational capacity telemetry.
--   * It never deletes, vacuums, reindexes, downsamples, or mutates canonical Market Memory.
--
-- HOUSEKEEP-001A.1 correction:
--   The existing table check originally allowed only CACHE_INVALIDATION and PROVIDER_FETCH.
--   STORAGE_CAPACITY must be explicitly added to that enum-like check before scheduling.
--
-- Cadence:
--   00:15 UTC daily.
--
-- Idempotency:
--   At most one STORAGE_CAPACITY row per UTC day. Re-running the body on the same day
--   is a no-op at the logical row level.

begin;

alter table public.p365_operational_metrics
  drop constraint p365_operational_metrics_metric_type_check;

alter table public.p365_operational_metrics
  add constraint p365_operational_metrics_metric_type_check
  check (
    metric_type = any (
      array[
        'CACHE_INVALIDATION'::text,
        'PROVIDER_FETCH'::text,
        'STORAGE_CAPACITY'::text
      ]
    )
  );

commit;

select cron.schedule(
  'p365-storage-daily',
  '15 0 * * *',
  $job$
  with constants as (
    select
      524288000::bigint as free_plan_limit_bytes,
      (
        date_trunc('day', now() at time zone 'UTC')
        at time zone 'UTC'
      ) as snapshot_day_utc
  ),
  measured as (
    select
      now() as measured_at,
      pg_database_size(current_database())::bigint as database_bytes,
      pg_total_relation_size('public.market_memory'::regclass)::bigint as market_memory_total_bytes,
      pg_relation_size('public.market_memory'::regclass)::bigint as market_memory_heap_bytes,
      pg_indexes_size('public.market_memory'::regclass)::bigint as market_memory_index_bytes,
      pg_total_relation_size('cron.job_run_details'::regclass)::bigint as cron_job_run_details_bytes,
      (select count(*) from public.market_memory)::bigint as market_memory_rows,
      (
        select count(*)
        from public.market_memory
        where record_type = 'EVIDENCE'
      )::bigint as evidence_rows,
      (
        select count(*)
        from public.market_memory
        where record_type = 'OBSERVATION'
      )::bigint as observation_rows
  )
  insert into public.p365_operational_metrics (
    metric_type,
    provider,
    cache_group,
    reason,
    occurred_at,
    metadata
  )
  select
    'STORAGE_CAPACITY',
    'supabase-postgres',
    null,
    'DAILY_STORAGE_CAPACITY_SNAPSHOT',
    c.snapshot_day_utc,
    jsonb_build_object(
      'schemaVersion', 'housekeep-storage-capacity-v1',
      'measuredAt', m.measured_at,
      'databaseBytes', m.database_bytes,
      'marketMemoryTotalBytes', m.market_memory_total_bytes,
      'marketMemoryHeapBytes', m.market_memory_heap_bytes,
      'marketMemoryIndexBytes', m.market_memory_index_bytes,
      'marketMemoryRows', m.market_memory_rows,
      'evidenceRows', m.evidence_rows,
      'observationRows', m.observation_rows,
      'cronJobRunDetailsBytes', m.cron_job_run_details_bytes,
      'freePlanDatabaseLimitBytes', c.free_plan_limit_bytes,
      'estimatedHeadroomBytes', greatest(c.free_plan_limit_bytes - m.database_bytes, 0),
      'databaseUtilizationPct',
        round(m.database_bytes::numeric * 100 / c.free_plan_limit_bytes, 2)
    )
  from constants c
  cross join measured m
  where not exists (
    select 1
    from public.p365_operational_metrics existing
    where existing.metric_type = 'STORAGE_CAPACITY'
      and existing.provider = 'supabase-postgres'
      and existing.reason = 'DAILY_STORAGE_CAPACITY_SNAPSHOT'
      and existing.occurred_at = c.snapshot_day_utc
  );
  $job$
);
