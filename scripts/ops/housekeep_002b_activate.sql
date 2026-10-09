-- HOUSEKEEP-002B activation: review only. NEVER execute before owner-approved
-- retention horizon, incident holds, and separate production mutation consent.
-- Requires merged/installed scripts/ops/housekeep_002b_install_bounded_retention.sql.
-- This DOES NOT alter existing cron jobs or Market Memory.
BEGIN;
DO $activate$
DECLARE
  -- HARD GATES: set all four values ONLY from owner-approved policy.
  v_success_days integer := NULL;
  v_failure_days integer := NULL;
  v_incidents_reviewed boolean := false;
  v_owner_approved_activation boolean := false;
  v_batch_limit integer := 250;
  v_jobname text := 'p365-pg-cron-log-retention';
  v_command text;
  v_dry_run jsonb;
BEGIN
  IF v_success_days IS NULL OR v_failure_days IS NULL
    OR NOT v_incidents_reviewed OR NOT v_owner_approved_activation THEN
    RAISE EXCEPTION 'HOUSEKEEP-002B owner retention/incident/activation approvals missing'
      USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM cron.job WHERE jobname=v_jobname) THEN
    RAISE EXCEPTION 'HOUSEKEEP-002B cron job already exists' USING ERRCODE='23505';
  END IF;
  -- The function checks allowed policy ranges, role, and incident-hold exclusion.
  SELECT p365_ops.prune_cron_run_details_v1(
    v_success_days,v_failure_days,v_batch_limit,false
  ) INTO v_dry_run;
  IF v_dry_run->>'status' <> 'DRY_RUN' THEN
    RAISE EXCEPTION 'HOUSEKEEP-002B dry-run preflight failed' USING ERRCODE='22023';
  END IF;
  v_command := format(
    'SELECT p365_ops.prune_cron_run_details_v1(%s,%s,%s,true);',
    v_success_days,v_failure_days,v_batch_limit
  );
  PERFORM cron.schedule(v_jobname,'17 3 * * *',v_command);
END
$activate$;
COMMIT;

-- After explicit approval and execution, verify cron.job row exists exactly
-- once, old scheduling unchanged, first natural batch <= 250 deletes, and
-- p365_operational_metrics/Market Memory counts unaffected.
-- Rollback before/after first run: unschedule ONLY this named job. Deleted
-- pg_cron execution-log rows are not automatically recoverable.
