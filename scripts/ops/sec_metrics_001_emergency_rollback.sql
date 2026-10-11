-- SEC-METRICS-001 / #310 — EMERGENCY ROLLBACK (NOT NORMAL DEPLOYMENT).
-- Requires explicit owner authorization; RESTORES INSECURE pre-change grants
-- including TRUNCATE, which bypasses RLS. Never run for routine troubleshooting.
-- Execute using a transactional operator-approved SQL migration.
DO $preflight$
DECLARE r text; p text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    WHERE c.oid='public.p365_operational_metrics'::regclass
      AND pg_get_userbyid(c.relowner)='postgres'
      AND c.relrowsecurity IS TRUE
  ) THEN
    RAISE EXCEPTION 'SEC-METRICS-001 rollback: table or RLS drift';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='p365_operational_metrics'
  ) THEN
    RAISE EXCEPTION 'SEC-METRICS-001 rollback: policy drift';
  END IF;
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOREACH p IN ARRAY ARRAY[
      'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
    ] LOOP
      IF has_table_privilege(r,'public.p365_operational_metrics',p) THEN
        RAISE EXCEPTION 'SEC-METRICS-001 rollback: already granted %.%',r,p;
      END IF;
    END LOOP;
  END LOOP;
END
$preflight$;

SET LOCAL lock_timeout='3s';
-- Exactly restores the seven direct privileges measured at baseline.
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.p365_operational_metrics TO anon, authenticated;

DO $postflight$
DECLARE r text; p text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','postgres'] LOOP
    FOREACH p IN ARRAY ARRAY[
      'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
    ] LOOP
      IF NOT has_table_privilege(r,'public.p365_operational_metrics',p) THEN
        RAISE EXCEPTION 'SEC-METRICS-001 rollback: privilege restore failed %.%',r,p;
      END IF;
    END LOOP;
  END LOOP;
END
$postflight$;
