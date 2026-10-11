-- OPS-CRON-NAME-001 / Issue #332 — OPERATOR ALIAS, SELECT ONLY.
-- Purpose: classify the two known cron jobs by ACTUAL endpoint/mode, not the
-- legacy jobname. Do NOT execute mutating cron.schedule/unschedule/alter_job.
-- Does NOT print cron.command, Vault tokens, net.http_get headers or responses.
-- Snapshot semantics: pg_cron succeeded means dispatch was queued; it does
-- NOT prove an HTTP 2xx response, accepted provider result, or durable writes.

WITH expected(jobid, legacy_jobname, operator_alias, expected_schedule, selector) AS (
  VALUES
    (4::bigint, 'p365-fred'::text, 'CoinGecko Context · setiap jam'::text,
      '31 * * * *'::text, 'providers=coingecko-context'::text),
    (24::bigint, 'p365-fred-release-aware'::text, 'FRED provider updates · setiap 5 menit'::text,
      '*/5 * * * *'::text, 'providers=fred&fredProviderUpdates=1'::text)
),
active_modes AS (
  SELECT
    COUNT(*) FILTER (WHERE active AND position('providers=coingecko-context' IN command) > 0)
      AS context_jobs,
    COUNT(*) FILTER (WHERE active AND (
      position('providers=fred&' IN command) > 0
      OR position('providers=fred,' IN command) > 0
    )) AS fred_jobs
  FROM cron.job
),
dispatch_24h AS (
  SELECT r.jobid,
    COUNT(*)::bigint AS attempts,
    COUNT(*) FILTER (WHERE r.status = 'succeeded')::bigint AS dispatched,
    COUNT(*) FILTER (WHERE r.status = 'failed')::bigint AS failed,
    MAX(r.start_time) AS latest_attempt
  FROM cron.job_run_details r
  WHERE r.start_time >= now() - interval '24 hours'
    AND r.jobid IN (4, 24)
  GROUP BY r.jobid
),
last_dispatch AS (
  SELECT e.jobid,
    (SELECT r.status FROM cron.job_run_details r
      WHERE r.jobid=e.jobid ORDER BY r.start_time DESC LIMIT 1) AS status
  FROM expected e
),
classified AS (
  SELECT e.jobid AS expected_jobid, e.legacy_jobname, e.operator_alias,
    e.expected_schedule, j.jobname AS live_jobname, j.schedule AS live_schedule,
    j.active AS live_active, j.jobid AS live_jobid,
    md5(j.command) AS command_fingerprint,
    CASE
      WHEN j.jobid IS NULL THEN 'JOB_TIDAK_DITEMUKAN'
      WHEN j.jobname IS DISTINCT FROM e.legacy_jobname THEN 'DRIFT_NAMA'
      WHEN j.schedule IS DISTINCT FROM e.expected_schedule THEN 'DRIFT_JADWAL'
      WHEN j.active IS DISTINCT FROM TRUE THEN 'JOB_NONAKTIF'
      WHEN position(e.selector IN j.command) = 0 THEN 'DRIFT_ENDPOINT_MODE'
      WHEN position('net.http_get' IN j.command) = 0
        OR position('vault.decrypted_secrets' IN j.command) = 0
        OR position('p365-kappa.vercel.app' IN j.command) = 0
        THEN 'DRIFT_TRANSPORT_PRODUKSI'
      WHEN e.jobid = 4 AND (
        position('providers=fred&' IN j.command) > 0 OR
        position('providers=fred,' IN j.command) > 0
      ) THEN 'DRIFT_PROVIDER_CAMPUR'
      WHEN e.jobid = 24 AND position('coingecko-context' IN j.command) > 0
        THEN 'DRIFT_PROVIDER_CAMPUR'
      WHEN active_modes.context_jobs <> 1 OR active_modes.fred_jobs <> 1
        THEN 'DRIFT_DUPLIKASI_JOB'
      ELSE 'TERVERIFIKASI'
    END AS mapping_status
  FROM expected e
  LEFT JOIN cron.job j ON j.jobid=e.jobid
  CROSS JOIN active_modes
)
SELECT c.expected_jobid AS jobid, c.live_jobname AS actual_jobname,
  CASE WHEN c.mapping_status = 'TERVERIFIKASI'
    THEN c.operator_alias ELSE 'ALIAS DITAHAN — PERIKSA DRIFT' END AS operator_label,
  c.mapping_status, c.live_schedule AS schedule_utc, c.live_active AS active,
  COALESCE(d.attempts,0) AS attempts_24h,
  COALESCE(d.dispatched,0) AS cron_dispatched_24h,
  COALESCE(d.failed,0) AS cron_failed_24h,
  d.latest_attempt AS latest_dispatch_utc,
  l.status AS last_cron_status,
  c.command_fingerprint
FROM classified c
LEFT JOIN dispatch_24h d ON d.jobid=c.expected_jobid
LEFT JOIN last_dispatch l ON l.jobid=c.expected_jobid
ORDER BY c.expected_jobid;
