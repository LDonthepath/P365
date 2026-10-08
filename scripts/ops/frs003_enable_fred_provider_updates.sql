-- FRS-003: poll FRED's own series-update feed and fetch changed P365 series.
-- REVIEW + EXPLICIT OWNER AUTHORIZATION REQUIRED before production execution.
-- Job #4 remains the existing hourly CoinGecko Context lane.
-- This script mutates only job #24 and keeps its Vault-authenticated command.
BEGIN;
DO $frs003_provider_updates$
DECLARE
  fred cron.job%ROWTYPE;
  context_job cron.job%ROWTYPE;
  updated_command text;
BEGIN
  SELECT * INTO STRICT fred FROM cron.job WHERE jobid=24 AND jobname='p365-fred-release-aware';
  SELECT * INTO STRICT context_job FROM cron.job WHERE jobid=4 AND jobname='p365-fred';
  IF NOT fred.active OR fred.schedule <> '31 * * * *'
    OR (length(fred.command) - length(replace(fred.command,
      'providers=fred&fredReleaseAware=1', ''))) / length('providers=fred&fredReleaseAware=1') <> 1
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
         OR position('fredReleaseAware=1' IN j.command)>0
         OR position('fredProviderUpdates=1' IN j.command)>0)
    )
  THEN
    RAISE EXCEPTION 'FRS-003 provider-update preflight failed: job drift/overlap; no change';
  END IF;

  updated_command := replace(fred.command,
    'providers=fred&fredReleaseAware=1', 'providers=fred&fredProviderUpdates=1');
  -- Five-minute metadata polling; failed-feed full sweeps only UTC minute 00.
  -- Recovery repeats at 04:30/04:35/04:40 UTC. Owner must review 891/day
  -- continuous-outage request bound and unverified FRED time-filter zone.
  PERFORM cron.alter_job(
    job_id := fred.jobid,
    schedule := '*/5 * * * *',
    command := updated_command
  );
END
$frs003_provider_updates$;
COMMIT;
-- Read-only postflight: #4 stays hourly/context only; #24 runs every 5 minutes
-- with fredProviderUpdates=1; exactly one active FRED job. Verify actual FRED
-- metadata scan JSON, provider outcome, and canonical writes on natural runs.
