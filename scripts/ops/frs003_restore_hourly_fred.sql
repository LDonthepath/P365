-- FRS-003 emergency rollback: restore hourly FRED (job #24) ONLY.
-- Does not change context-only hourly job #4; no secret printing.
BEGIN;
DO $frs003_hourly_restore$
DECLARE
  fred cron.job%ROWTYPE;
  context_job cron.job%ROWTYPE;
BEGIN
  SELECT * INTO STRICT fred FROM cron.job WHERE jobid=24 AND jobname='p365-fred-release-aware';
  SELECT * INTO STRICT context_job FROM cron.job WHERE jobid=4 AND jobname='p365-fred';
  IF NOT fred.active OR fred.schedule <> '17 4,13,14,21,22 * * *'
    OR position('providers=fred&fredReleaseAware=1' IN fred.command)=0
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
         OR position('fredReleaseAware=1' IN j.command)>0)
    )
  THEN
    RAISE EXCEPTION 'FRS-003 hourly restore preflight failed; inspect drift first';
  END IF;
  PERFORM cron.alter_job(
    job_id := fred.jobid,
    schedule := '31 * * * *'
  );
END
$frs003_hourly_restore$;
COMMIT;
-- This rollback ONLY restores #24 to the previous hourly split policy.
-- For full combined-lane rollback refer to scripts/ops/frs003_rollback.sql.
