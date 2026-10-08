-- FRS-003 RESTORE LEGACY HOURLY COMBINED LANE. Owner emergency/rollback only.
-- No credentials in script. Restores the exact original provider suffix,
-- preserves existing p365-fred job ID 4 and schedule, and removes new job
-- in a single transaction. Aborts without changes on unexpected drift.
BEGIN;
DO $rollback$
DECLARE
  existing_job cron.job%ROWTYPE;
  selected_job cron.job%ROWTYPE;
  restored_command text;
BEGIN
  SELECT * INTO STRICT existing_job FROM cron.job WHERE jobname='p365-fred';
  SELECT * INTO STRICT selected_job FROM cron.job WHERE jobname='p365-fred-release-aware';
  IF existing_job.jobid <> 4 OR NOT existing_job.active
    OR existing_job.schedule <> '31 * * * *'
    OR NOT selected_job.active OR selected_job.schedule <> '31 * * * *'
    OR existing_job.command NOT LIKE '%net.http_get%'
    OR existing_job.command NOT LIKE '%vault.decrypted_secrets%'
    OR (length(existing_job.command) - length(replace(existing_job.command,
        'providers=coingecko-context', ''))) / length('providers=coingecko-context') <> 1
    OR (length(selected_job.command) - length(replace(selected_job.command,
        'providers=fred&fredReleaseAware=1', ''))) / length('providers=fred&fredReleaseAware=1') <> 1
  THEN
    RAISE EXCEPTION 'FRS-003 rollback preflight failed; inspect job drift first';
  END IF;
  restored_command := replace(existing_job.command, 'providers=coingecko-context',
    'providers=fred,coingecko-context');
  PERFORM cron.alter_job(job_id := existing_job.jobid, command := restored_command);
  IF NOT cron.unschedule(selected_job.jobid) THEN
    RAISE EXCEPTION 'FRS-003 rollback cannot unschedule selective FRED job';
  END IF;
END
$rollback$;
COMMIT;
-- AFTER EXECUTION read-only verification: only jobid=4 combined FRED+context
-- is active and no p365-fred-release-aware job remains. Inspect real HTTP.
