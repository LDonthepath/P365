-- HOUSEKEEP-002B: bounded pg_cron execution-log pruning capability.
-- INSTALL-ONLY. This script DOES NOT schedule a job or delete any rows.
-- Requires owner-approved horizons and a separate activation authorization.
-- The schema is not exposed through P365's Data API.
BEGIN;

CREATE SCHEMA IF NOT EXISTS p365_ops;
REVOKE ALL ON SCHEMA p365_ops FROM PUBLIC, anon, authenticated, service_role;

-- Operators can hold individual cron run IDs (including apparent SQL-success
-- rows for which application HTTP/provider failures are under investigation).
-- A hold has no automatic expiry: incident closure must be explicit.
CREATE TABLE IF NOT EXISTS p365_ops.cron_log_retention_holds (
  runid bigint PRIMARY KEY,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 4 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON p365_ops.cron_log_retention_holds FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION p365_ops.prune_cron_run_details_v1(
  p_success_days integer,
  p_failure_days integer,
  p_batch_limit integer DEFAULT 250,
  p_execute boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, cron, p365_ops
AS $prune$
DECLARE
  v_success_before timestamptz;
  v_failure_before timestamptz;
  v_eligible integer;
  v_removed integer := 0;
BEGIN
  -- Cron jobs are owned by postgres. Do not expose this destructive operation
  -- to the application service role or a different database principal.
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'cron log retention is postgres-only' USING ERRCODE='42501';
  END IF;
  IF p_success_days IS NULL OR p_failure_days IS NULL
    OR p_success_days < 14 OR p_success_days > 365
    OR p_failure_days < p_success_days OR p_failure_days > 730
    OR p_batch_limit IS NULL OR p_batch_limit < 1 OR p_batch_limit > 500
    OR p_execute IS NULL THEN
    RAISE EXCEPTION 'unapproved or unbounded cron retention arguments' USING ERRCODE='22023';
  END IF;

  -- Avoid concurrent maintenance executions and avoid blocking live cron runs.
  IF NOT pg_try_advisory_xact_lock(726543298102::bigint) THEN
    RETURN jsonb_build_object('status','LOCKED','deleted',0);
  END IF;
  PERFORM set_config('lock_timeout','500ms',true);
  PERFORM set_config('statement_timeout','5s',true);
  v_success_before := clock_timestamp() - make_interval(days => p_success_days);
  v_failure_before := clock_timestamp() - make_interval(days => p_failure_days);

  -- A cron 'succeeded' status proves SQL dispatch only, not upstream HTTP
  -- success. Known incident runids MUST be entered into the hold table first.
  WITH candidates AS (
    SELECT d.runid
    FROM cron.job_run_details d
    WHERE d.start_time IS NOT NULL AND d.end_time IS NOT NULL
      AND d.status IS NOT NULL AND d.status <> 'running'
      AND (
        (d.status='succeeded' AND d.start_time < v_success_before)
        OR (d.status <> 'succeeded' AND d.start_time < v_failure_before)
      )
      AND NOT EXISTS (
        SELECT 1 FROM p365_ops.cron_log_retention_holds h WHERE h.runid=d.runid
      )
    ORDER BY d.start_time,d.runid LIMIT p_batch_limit
  ) SELECT count(*) INTO v_eligible FROM candidates;

  IF NOT p_execute THEN
    RETURN jsonb_build_object('status','DRY_RUN','eligibleSample',v_eligible,
      'batchLimit',p_batch_limit,'successDays',p_success_days,
      'failureDays',p_failure_days,'deleted',0);
  END IF;

  WITH targets AS (
    SELECT d.runid
    FROM cron.job_run_details d
    WHERE d.start_time IS NOT NULL AND d.end_time IS NOT NULL
      AND d.status IS NOT NULL AND d.status <> 'running'
      AND (
        (d.status='succeeded' AND d.start_time < v_success_before)
        OR (d.status <> 'succeeded' AND d.start_time < v_failure_before)
      )
      AND NOT EXISTS (
        SELECT 1 FROM p365_ops.cron_log_retention_holds h WHERE h.runid=d.runid
      )
    ORDER BY d.start_time,d.runid LIMIT p_batch_limit
    FOR UPDATE OF d SKIP LOCKED
  ), deleted AS (
    DELETE FROM cron.job_run_details d USING targets t WHERE d.runid=t.runid
    RETURNING d.runid
  ) SELECT count(*) INTO v_removed FROM deleted;

  RETURN jsonb_build_object('status','EXECUTED','deleted',v_removed,
    'batchLimit',p_batch_limit,'successDays',p_success_days,'failureDays',p_failure_days);
END
$prune$;

REVOKE ALL ON FUNCTION p365_ops.prune_cron_run_details_v1(integer,integer,integer,boolean)
  FROM PUBLIC, anon, authenticated, service_role;
COMMIT;

-- After owner approval, use:
-- SELECT p365_ops.prune_cron_run_details_v1(<success_days>,<failure_days>,250,false);
-- Do NOT switch to p_execute=true or schedule until owner approves horizons,
-- incident holds, first-batch dry run and rollback/disable procedures.
