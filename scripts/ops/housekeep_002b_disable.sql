-- HOUSEKEEP-002B emergency disable/rollback of scheduling only.
-- May be run after owner-approved activation if a regression occurs.
-- Never re-creates historical run logs that an approved prune already removed.
BEGIN;
DO $disable$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job
  WHERE jobname='p365-pg-cron-log-retention';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END
$disable$;
COMMIT;
-- Verify cron.job has no p365-pg-cron-log-retention row and that other
-- schedules/credentials remain unchanged.
