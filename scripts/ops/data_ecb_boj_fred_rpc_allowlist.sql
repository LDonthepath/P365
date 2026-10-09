-- DATA-ECB-BOJ: Minimal production-safe FRED RPC allowlist expansion.
-- Adds only ECBASSETSW and JPNASSETS. Does not re-install tables, triggers,
-- revision gate, cron jobs, or alter the canonical writer contract.
-- Idempotent, fail-closed if the expected production function has drifted.
BEGIN;
DO $data_ecb_boj$
DECLARE
  writer_ddl text;
  target_fragment constant text := '''WALCL'', ''WRESBAL'', ''M2SL''';
  replacement_fragment constant text := '''WALCL'', ''ECBASSETSW'', ''JPNASSETS'', ''WRESBAL'', ''M2SL''';
BEGIN
  SELECT pg_get_functiondef('public.p365_insert_fred_observations_v1(jsonb)'::regprocedure)
    INTO STRICT writer_ddl;
  IF position('v_series NOT IN (' IN writer_ddl) = 0
     OR position('SECURITY INVOKER' IN upper(writer_ddl)) = 0
  THEN
    RAISE EXCEPTION 'FRED writer contract has drifted; allowlist not modified';
  END IF;
  IF position(replacement_fragment IN writer_ddl) > 0 THEN
    -- Already migrated; reject partial/ambiguous updates instead of guessing.
    IF position(target_fragment IN writer_ddl) > 0 THEN
      RAISE EXCEPTION 'Ambiguous FRED allowlist versions';
    END IF;
    RETURN;
  END IF;
  IF position(target_fragment IN writer_ddl) = 0
     OR position('ECBASSETSW' IN writer_ddl) > 0
     OR position('JPNASSETS' IN writer_ddl) > 0
     OR (length(writer_ddl) - length(replace(writer_ddl, target_fragment, '')))
         <> length(target_fragment)
  THEN
    RAISE EXCEPTION 'FRED writer allowlist differs from approved baseline; no change';
  END IF;
  -- CREATE OR REPLACE retains the function identity and existing EXECUTE grants.
  EXECUTE replace(writer_ddl, target_fragment, replacement_fragment);
END
$data_ecb_boj$;

DO $verify_data_ecb_boj$
DECLARE
  writer_ddl text;
BEGIN
  SELECT pg_get_functiondef('public.p365_insert_fred_observations_v1(jsonb)'::regprocedure)
    INTO STRICT writer_ddl;
  IF position('''WALCL'', ''ECBASSETSW'', ''JPNASSETS'', ''WRESBAL'', ''M2SL''' IN writer_ddl) = 0
     OR position('SECURITY INVOKER' IN upper(writer_ddl)) = 0
  THEN
    RAISE EXCEPTION 'FRED writer verification failed; transaction rolled back';
  END IF;
END
$verify_data_ecb_boj$;
COMMIT;
