-- OBS-FRED-001G: REVIEW-ONLY INSTALL ARTIFACT. DO NOT EXECUTE IN PRODUCTION
-- without a separate owner approval, staging concurrency proof and writer audit.
-- Two-stage gate: install defaults to enforced=false. A separate authorized
-- operation must coordinate P365_FRED_TRANSACTIONAL_REVISIONS=1 across ALL FRED
-- writers, then activate the gate. Never enable while legacy writers are active.
BEGIN;

CREATE TABLE IF NOT EXISTS public.p365_fred_revision_gate (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enforced boolean NOT NULL DEFAULT false,
  epoch bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.p365_fred_revision_gate(singleton,enforced)
VALUES (true,false) ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.p365_fred_revision_heads (
  logical_key text PRIMARY KEY,
  canonical_id text NOT NULL,
  epoch bigint NOT NULL,
  measurement_id text NOT NULL,
  unit text NOT NULL,
  frequency text NOT NULL,
  canonical_value numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.p365_fred_revision_gate ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p365_fred_revision_heads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.p365_fred_revision_gate FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.p365_fred_revision_heads FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.p365_fred_revision_gate TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.p365_fred_revision_heads TO service_role;

-- When explicitly activated, reject ALL uncoordinated FRED Observation writes.
-- GUC is an accidental-bypass guard, not a security boundary against a
-- malicious holder of the service-role database credential.
-- Every gate state transition advances the proof epoch. Re-enabling after
-- a rollback can never trust a previous ledger head as the latest version.
CREATE OR REPLACE FUNCTION public.p365_fred_revision_gate_epoch_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $epoch$
BEGIN
  IF NEW.enforced IS DISTINCT FROM OLD.enforced THEN
    NEW.epoch := OLD.epoch + 1;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END
$epoch$;
DROP TRIGGER IF EXISTS p365_fred_revision_gate_epoch ON public.p365_fred_revision_gate;
CREATE TRIGGER p365_fred_revision_gate_epoch
BEFORE UPDATE ON public.p365_fred_revision_gate
FOR EACH ROW EXECUTE FUNCTION public.p365_fred_revision_gate_epoch_v1();

CREATE OR REPLACE FUNCTION public.p365_guard_fred_revision_writer_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog,public AS $fn$
BEGIN
  IF NEW.record_type = 'OBSERVATION'
    AND (NEW.payload->>'sourceId' = 'fred' OR NEW.source_id = 'fred')
    AND (SELECT enforced FROM public.p365_fred_revision_gate WHERE singleton)
    AND current_setting('p365.fred_revision_rpc',true) IS DISTINCT FROM '1'
  THEN
    RAISE EXCEPTION 'Coordinated FRED writer required'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$fn$;
DROP TRIGGER IF EXISTS p365_fred_revision_writer_guard ON public.market_memory;
CREATE TRIGGER p365_fred_revision_writer_guard
BEFORE INSERT ON public.market_memory
FOR EACH ROW EXECUTE FUNCTION public.p365_guard_fred_revision_writer_v1();

CREATE OR REPLACE FUNCTION public.p365_insert_fred_observations_v1(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog,public
AS $fn$
DECLARE
  v_item jsonb;
  v_prior jsonb;
  v_keys text[] := '{}'::text[];
  v_ids text[] := '{}'::text[];
  v_dedupes text[] := '{}'::text[];
  v_key text;
  v_sorted_key text;
  v_id text;
  v_dedupe text;
  v_domain text;
  v_series text;
  v_period text;
  v_measurement text;
  v_unit text;
  v_frequency text;
  v_value_text text;
  v_value numeric;
  v_effective timestamptz;
  v_actual_insert text;
  v_prev public.p365_fred_revision_heads%ROWTYPE;
  v_head_found boolean;
  v_enforced boolean;
  v_epoch bigint;
  v_qualified boolean;
  v_has_prior boolean;
  v_prior_number numeric;
  v_prior_reference numeric;
  v_prior_count integer;
  v_inserted integer := 0;
  v_revised integer := 0;
  v_unknown integer := 0;
  v_inserted_ids text[] := '{}'::text[];
  v_expected_dedupe text;
  v_input_count integer;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'FRED receipt requires a JSON array' USING ERRCODE = '22023';
  END IF;
  v_input_count := jsonb_array_length(p_rows);
  IF v_input_count > 500 THEN
    RAISE EXCEPTION 'FRED receipt batch exceeds 500 rows' USING ERRCODE = '22023';
  END IF;
  -- Locks on the singleton control row prevent activation/deactivation mid-batch.
  SELECT enforced,epoch INTO STRICT v_enforced,v_epoch FROM public.p365_fred_revision_gate
  WHERE singleton FOR SHARE;

  -- Validate the ENTIRE envelope before any INSERT. One canonical version per
  -- logical measurement per call: no provider array-order chronology inferred.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    v_id := v_item->>'canonical_id';
    v_domain := v_item #>> '{payload,domain}';
    v_series := v_item #>> '{payload,metadata,seriesId}';
    v_period := v_item #>> '{payload,observedAt}';
    v_measurement := v_item #>> '{payload,identity,measurementId}';
    v_unit := v_item #>> '{payload,metadata,unit}';
    v_frequency := v_item #>> '{payload,metadata,frequency}';
    v_dedupe := v_item->>'dedupe_key';
    IF jsonb_typeof(v_item) <> 'object' OR jsonb_typeof(v_item->'payload') <> 'object'
       OR v_item->>'record_type' IS DISTINCT FROM 'OBSERVATION'
       OR v_item #>> '{payload,sourceId}' IS DISTINCT FROM 'fred'
       OR v_domain IS NULL OR v_domain NOT IN ('MACRO','ASSET')
       OR v_item #>> '{payload,identity,version}' IS DISTINCT FROM 'v1'
       OR v_series IS NULL OR v_series NOT IN ('FEDFUNDS', 'EFFR', 'WALCL', 'WRESBAL', 'M2SL', 'WTREGEN', 'SOFR', 'IORB', 'RRPONTSYD', 'CPIAUCSL', 'CPILFESL', 'PCEPI', 'PCEPILFE', 'UNRATE', 'PAYEMS', 'ICSA', 'CCSA', 'JTSJOL', 'JTSQUR', 'SAHMREALTIME', 'DGS2', 'DGS10', 'DFII10', 'T10YIE', 'T10Y2Y', 'BAMLC0A0CM', 'BAMLH0A0HYM2', 'DTWEXBGS', 'GDPC1', 'VIXCLS', 'SP500', 'NASDAQCOM', 'DCOILWTICO')
       OR v_item #>> '{payload,identity,seriesKey}' IS DISTINCT FROM v_series
       OR v_measurement IS NULL OR length(v_measurement) < 10 OR length(v_measurement) > 160
       OR v_unit IS NULL OR length(v_unit) = 0
       OR v_frequency IS NULL OR v_frequency NOT IN ('DAILY','WEEKLY','MONTHLY','QUARTERLY')
       OR v_id IS NULL OR v_id <> v_item #>> '{payload,id}'
       OR length(v_id) > 200 OR v_dedupe IS NULL
       OR v_period IS NULL OR v_item->>'effective_at' IS NULL
       OR v_item->>'captured_at' IS NULL
    THEN
      RAISE EXCEPTION 'Unqualified FRED receipt identity/semantics' USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_effective := (v_item->>'effective_at')::timestamptz;
      IF v_effective IS DISTINCT FROM v_period::timestamptz
        OR v_effective IS DISTINCT FROM date_trunc('milliseconds',v_effective)
      THEN
        RAISE EXCEPTION 'Unqualified FRED observation period' USING ERRCODE = '22023';
      END IF;
      -- Verify exact existing JS key format; never silently repair dedupe.
      v_expected_dedupe := 'OBSERVATION:' || v_id || ':' ||
        to_char(v_effective AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
      IF v_dedupe IS DISTINCT FROM v_expected_dedupe THEN
        RAISE EXCEPTION 'Unqualified FRED dedupe key' USING ERRCODE = '22023';
      END IF;
      PERFORM (v_item->>'captured_at')::timestamptz;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'Invalid FRED receipt timestamp' USING ERRCODE = '22023';
    END;
    v_key := v_domain || ':' || v_series || ':' || to_char(v_effective AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    IF v_key = ANY(v_keys) OR v_id = ANY(v_ids) OR v_dedupe = ANY(v_dedupes) THEN
      RAISE EXCEPTION 'Ambiguous FRED batch duplicate identity' USING ERRCODE = '22023';
    END IF;
    v_keys := array_append(v_keys,v_key);
    v_ids := array_append(v_ids,v_id);
    v_dedupes := array_append(v_dedupes,v_dedupe);
  END LOOP;

  -- Each logical measurement has one transaction-level lock. Acquiring locks
  -- in global lexical order avoids cross-batch lock-order deadlock.
  FOR v_sorted_key IN SELECT DISTINCT key FROM unnest(v_keys) AS key ORDER BY key LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('P365:FRED:001G:'||v_sorted_key,0));
  END LOOP;
  -- PL/pgSQL statements below obtain fresh READ COMMITTED snapshots after
  -- waiting for locks; testing is mandatory before production activation.

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    v_id := v_item->>'canonical_id';
    v_dedupe := v_item->>'dedupe_key';
    v_domain := v_item #>> '{payload,domain}';
    v_series := v_item #>> '{payload,metadata,seriesId}';
    v_period := v_item #>> '{payload,observedAt}';
    v_measurement := v_item #>> '{payload,identity,measurementId}';
    v_unit := v_item #>> '{payload,metadata,unit}';
    v_frequency := v_item #>> '{payload,metadata,frequency}';
    v_value_text := v_item #>> '{payload,value}';
    v_effective := (v_item->>'effective_at')::timestamptz;
    v_key := v_domain || ':' || v_series || ':' ||
      to_char(v_effective AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    v_value := NULL;
    IF v_value_text ~ '^[-+]?[0-9]+(\.[0-9]+)?([Ee][-+]?[0-9]+)?$'
       AND length(v_value_text) <= 80 THEN
      BEGIN
        v_value := v_value_text::numeric;
      EXCEPTION WHEN numeric_value_out_of_range THEN v_value := NULL;
      END;
    END IF;

    v_qualified := false;
    v_has_prior := false;
    v_prev := NULL;
    SELECT * INTO v_prev FROM public.p365_fred_revision_heads WHERE logical_key=v_key;
    v_head_found := FOUND AND v_prev.epoch = v_epoch;
    IF v_enforced AND v_series <> 'DTWEXBGS' AND v_value IS NOT NULL THEN
      IF v_head_found THEN
        -- A head is the previous COMMITTED INSERT from a coordinated writer;
        -- guard blocks noncooperating writes while enforcement is active.
        IF v_prev.unit=v_unit AND v_prev.frequency=v_frequency
           AND v_prev.measurement_id=v_measurement
           AND v_prev.canonical_value IS NOT NULL THEN
          v_qualified := true;
          v_has_prior := true;
          v_prior_reference := v_prev.canonical_value;
        END IF;
      ELSE
        -- Legacy/modern pre-gate versions have no reliable insertion order.
        -- Only an empty history or an exhaustive uniform-value history
        -- admits a revision proof without selecting an arbitrary last row.
        v_qualified := true;
        v_prior_count := 0;
        v_prior_reference := NULL;
        FOR v_prior IN
          SELECT payload FROM public.market_memory
          WHERE record_type='OBSERVATION'
            AND payload->>'sourceId'='fred'
            AND payload->>'domain'=v_domain
            AND payload #>> '{metadata,seriesId}' = v_series
            AND effective_at=v_effective
          LIMIT 65
        LOOP
          v_prior_count := v_prior_count + 1;
          IF v_prior_count > 64
             OR v_prior #>> '{metadata,unit}' IS DISTINCT FROM v_unit
             OR v_prior #>> '{metadata,frequency}' IS DISTINCT FROM v_frequency
             OR v_prior #>> '{observedAt}' IS DISTINCT FROM v_period
             OR (v_prior #>> '{identity,measurementId}' IS NOT NULL AND
                v_prior #>> '{identity,measurementId}' IS DISTINCT FROM v_measurement)
             OR v_prior #>> '{value}' IS NULL
             OR v_prior #>> '{value}' !~ '^[-+]?[0-9]+(\.[0-9]+)?([Ee][-+]?[0-9]+)?$'
             OR length(v_prior #>> '{value}') > 80
          THEN
            v_qualified := false;
            EXIT;
          END IF;
          BEGIN
            v_prior_number := (v_prior->>'value')::numeric;
          EXCEPTION WHEN numeric_value_out_of_range THEN
            v_qualified := false;
            EXIT;
          END;
          IF v_prior_count > 1 AND v_prior_number IS DISTINCT FROM v_prior_reference THEN
            v_qualified := false;
            EXIT;
          END IF;
          v_prior_reference := v_prior_number;
        END LOOP;
        v_has_prior := v_prior_count > 0;
      END IF;
    END IF;

    -- This is the one and only canonical write for this candidate.
    -- Conflict-ignore RETURNING is the physical insert authority.
    PERFORM set_config('p365.fred_revision_rpc','1',true);
    v_actual_insert := NULL;
    INSERT INTO public.market_memory
      (record_type,canonical_id,effective_at,captured_at,dedupe_key,payload)
    VALUES
      ('OBSERVATION',v_id,v_effective,(v_item->>'captured_at')::timestamptz,
       v_dedupe,v_item->'payload')
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING canonical_id INTO v_actual_insert;
    PERFORM set_config('p365.fred_revision_rpc','0',true);

    IF v_actual_insert IS NOT NULL THEN
      v_inserted := v_inserted + 1;
      v_inserted_ids := array_append(v_inserted_ids,v_actual_insert);
      IF v_qualified THEN
        IF v_has_prior AND v_prior_reference IS DISTINCT FROM v_value THEN
          v_revised := v_revised + 1;
        END IF;
      ELSE
        v_unknown := v_unknown + 1;
      END IF;
      IF v_enforced THEN
        INSERT INTO public.p365_fred_revision_heads
          (logical_key,canonical_id,epoch,measurement_id,unit,frequency,canonical_value)
        VALUES(v_key,v_id,v_epoch,v_measurement,v_unit,v_frequency,v_value)
        ON CONFLICT(logical_key) DO UPDATE SET
          canonical_id=EXCLUDED.canonical_id,
          epoch=EXCLUDED.epoch,
          measurement_id=EXCLUDED.measurement_id,
          unit=EXCLUDED.unit,frequency=EXCLUDED.frequency,
          canonical_value=EXCLUDED.canonical_value,updated_at=now();
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'submitted',v_input_count,'inserted',v_inserted,
    'duplicates',v_input_count-v_inserted,
    'insertedCanonicalIds',to_jsonb(v_inserted_ids),
    'revised',CASE WHEN v_unknown=0 THEN to_jsonb(v_revised) ELSE 'null'::jsonb END,
    'revisionAssessment',CASE WHEN v_unknown=0 THEN 'COMPLETE' ELSE 'NOT_EVALUATED' END
  );
END
$fn$;

REVOKE ALL ON FUNCTION public.p365_fred_revision_gate_epoch_v1() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.p365_guard_fred_revision_writer_v1() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.p365_insert_fred_observations_v1(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.p365_insert_fred_observations_v1(jsonb) TO service_role;
COMMIT;
