-- FRS-003 rollback: restore job #24 to the previous hourly release-aware mode.
-- Does not change hourly CoinGecko Context job #4; no secrets are printed.
BEGIN;
DO $frs003_restore_release_aware$
DECLARE
  fred cron.job%ROWTYPE;
  context_job cron.job%ROWTYPE;
  restored_command text;
BEGIN
  SELECT * INTO STRICT fred FROM cron.job WHERE jobid=24 AND jobname='p365-fred-release-aware';
  SELECT * INTO STRICT context_job FROM cron.job WHERE jobid=4 AND jobname='p365-fred';
  IF NOT fred.active OR fred.schedule <> '*/5 * * * *'
    OR (length(fred.command) - length(replace(fred.command,
      'providers=fred&fredProviderUpdates=1', ''))) / length('providers=fred&fredProviderUpdates=1') <> 1
    OR position('coingecko-context' IN fred.command)>0
    OR position('net.http_get' IN fred.command)=0
    OR position('vault.decrypted_secrets' IN fred.command)=0
    OR NOT context_job.active OR context_job.schedule <> '31 * * * *'
    OR position('providers=coingecko-context' IN context_job.command)=0
    OR position('providers=fred' IN context_job.command)>0
    OR EXISTS (
      SELECT 1 FROM cron.job j WHERE j.active AND j.jobid<>fred.jobid
       AND (position('providers=fred&' IN j.command)>0
         OR position('providers=fred,' IN j.command)>0
         OR position('fredReleaseAware=1' IN j.command)>0
         OR position('fredProviderUpdates=1' IN j.command)>0)
    )
  THEN
    RAISE EXCEPTION 'FRS-003 restore preflight failed; inspect schedule drift first';
  END IF;
  restored_command := replace(fred.command,
    'providers=fred&fredProviderUpdates=1', 'providers=fred&fredReleaseAware=1');
  PERFORM cron.alter_job(
    job_id := fred.jobid,
    schedule := '31 * * * *',
    command := restored_command
  );
END
$frs003_restore_release_aware$;
COMMIT;
-- This restores the prior hourly split policy only. For the pre-split combined
-- FRED + Context lane, use scripts/ops/frs003_rollback.sql after review.
