-- MACRO-CUT-004 manual OPERATOR rollback ONLY; NEVER run on merge or in CI.
-- Runs only when all four retired cron jobs are absent, exact originals are present
-- in PRIVATE p365_ops.macro_cut_004_cron_rollback, and retained cron jobs still match.
-- Recreated job IDs may differ from original IDs; names/schedules/commands/states
-- must match exactly. Do not print/commit commands or credentials.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $rollback$
DECLARE
  rec record;
  new_jobid bigint;
  matched integer;
BEGIN
  SELECT count(*) INTO matched FROM cron.job
  WHERE jobid IN (2,3,5,6,23,24,25)
    AND CASE WHEN jobid=3 THEN NOT active ELSE active END;
  IF matched<>7 THEN
    RAISE EXCEPTION 'MACRO-CUT-004 rollback STOP: protected cron state drift';
  END IF;
  SELECT count(*) INTO matched FROM p365_ops.macro_cut_004_cron_rollback
  WHERE retired_at IS NOT NULL AND NOT original_active
    AND md5(command)=command_fingerprint;
  IF matched<>4 THEN
    RAISE EXCEPTION 'MACRO-CUT-004 rollback STOP: missing or corrupted original commands';
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobid IN (4,10,15,20)
      OR jobname IN (SELECT jobname FROM p365_ops.macro_cut_004_cron_rollback)) THEN
    RAISE EXCEPTION 'MACRO-CUT-004 rollback STOP: old/new retired jobs already present';
  END IF;
  FOR rec IN SELECT * FROM p365_ops.macro_cut_004_cron_rollback
                 ORDER BY original_jobid LOOP
    SELECT cron.schedule(rec.jobname, rec.schedule, rec.command) INTO new_jobid;
    PERFORM cron.alter_job(job_id:=new_jobid,
                           database:=rec.job_database,
                           username:=rec.job_username,
                           active:=false);
    SELECT count(*) INTO matched FROM cron.job
    WHERE jobid=new_jobid AND jobname=rec.jobname AND schedule=rec.schedule
      AND md5(command)=rec.command_fingerprint AND NOT active
      AND database=rec.job_database AND username=rec.job_username;
    IF matched<>1 THEN
      RAISE EXCEPTION 'MACRO-CUT-004 rollback STOP: restored job mismatch for original ID %',rec.original_jobid;
    END IF;
  END LOOP;
END;
$rollback$;
COMMIT;
-- Read-only verification:
SELECT jobname,active,schedule,md5(command) AS fingerprint
FROM cron.job WHERE jobname IN
  (SELECT jobname FROM p365_ops.macro_cut_004_cron_rollback)
ORDER BY jobname;
