-- FRS-003: switch ONLY the FRED release-aware cron lane to 5 daily windows.
-- REVIEW + EXPLICIT OWNER AUTHORIZATION REQUIRED before production execution.
-- Existing context-only job #4 stays hourly and uses existing Vault bearer.
-- Official source-release hours are NOT equivalent to FRED first-availability.
-- P365 planner retains daily 33-series sweep at 04 UTC and fail-open safety.
BEGIN;
DO $frs003_nonhourly$
DECLARE
  fred cron.job%ROWTYPE;
  context_job cron.job%ROWTYPE;
BEGIN
  SELECT * INTO STRICT fred FROM cron.job WHERE jobid=24 AND jobname='p365-fred-release-aware';
  SELECT * INTO STRICT context_job FROM cron.job WHERE jobid=4 AND jobname='p365-fred';
  IF NOT fred.active OR fred.schedule <> '31 * * * *'
    OR position('providers=fred&fredReleaseAware=1' IN fred.command)=0
    OR position('coingecko-context' IN fred.command)>0
    OR position('net.http_get' IN fred.command)=0
    OR position('vault.decrypted_secrets' IN fred.command)=0
    OR position('p365-kappa.vercel.app' IN fred.command)=0
    OR NOT context_job.active OR context_job.schedule <> '31 * * * *'
    OR position('providers=coingecko-context' IN context_job.command)=0
    OR position('providers=fred' IN context_job.command)>0
    OR position('net.http_get' IN context_job.command)=0
    OR position('vault.decrypted_secrets' IN context_job.command)=0
    OR EXISTS (
      SELECT 1 FROM cron.job j WHERE j.active AND j.jobid<>fred.jobid
       AND (position('providers=fred&' IN j.command)>0
         OR position('providers=fred,' IN j.command)>0
         OR position('fredReleaseAware=1' IN j.command)>0)
    )
  THEN
    RAISE EXCEPTION 'FRS-003 nonhourly preflight failed: job drift/overlap; no change';
  END IF;

  -- UTC slots: 04:17 full-registry safety sweep, 13:17/14:17 morning
  -- US-Eastern (DST-sensitive), 21:17/22:17 afternoon source windows.
  -- Times are OWNER POLICY, not verified first-availability timestamps.
  PERFORM cron.alter_job(
    job_id := fred.jobid,
    schedule := '17 4,13,14,21,22 * * *'
  );
END
$frs003_nonhourly$;
COMMIT;
-- Read-only postflight: job #4 remains 31 * * * * and context only;
-- job #24 runs 17 4,13,14,21,22 * * * and FRED only; exactly one FRED
-- lane; monitor first NATURAL run's net._http_response JSON/physical writes.
