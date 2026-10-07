-- DASH-READ-001 — indexed Observation-history transport for dashboard reads
--
-- Activation order:
-- 1. Run each CREATE INDEX CONCURRENTLY statement as its own top-level statement.
-- 2. Create/permission the RPC function.
-- 3. Verify plans and result parity.
-- 4. Deploy the application adapter that calls the RPC.
--
-- The migration is additive and does not alter canonical rows, retention, RLS,
-- provider cadence, or statement_timeout.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_memory_obs_series_history_v1
ON public.market_memory (
  ((payload ->> 'domain')),
  ((payload #>> '{metadata,seriesId}')),
  effective_at,
  id
)
WHERE record_type = 'OBSERVATION';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_memory_obs_metric_history_v1
ON public.market_memory (
  ((payload ->> 'domain')),
  ((payload #>> '{metadata,metricId}')),
  effective_at,
  id
)
WHERE record_type = 'OBSERVATION';

CREATE OR REPLACE FUNCTION public.p365_observation_history_candidates_v1(
  p_domain text,
  p_series_key text,
  p_source_id text,
  p_observed_at_on_or_after timestamptz,
  p_observed_at_on_or_before timestamptz,
  p_captured_at_on_or_before timestamptz,
  p_sort_desc boolean,
  p_limit integer,
  p_offset integer
)
RETURNS TABLE (
  id uuid,
  effective_at timestamptz,
  payload jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF p_domain IS NULL OR btrim(p_domain) = '' THEN
    RAISE EXCEPTION 'p_domain must be non-empty' USING ERRCODE = '22023';
  END IF;
  IF p_series_key IS NULL OR btrim(p_series_key) = '' THEN
    RAISE EXCEPTION 'p_series_key must be non-empty' USING ERRCODE = '22023';
  END IF;
  IF p_source_id IS NOT NULL AND btrim(p_source_id) = '' THEN
    RAISE EXCEPTION 'p_source_id must be null or non-empty' USING ERRCODE = '22023';
  END IF;
  IF p_captured_at_on_or_before IS NULL THEN
    RAISE EXCEPTION 'p_captured_at_on_or_before is required' USING ERRCODE = '22023';
  END IF;
  IF p_sort_desc IS NULL THEN
    RAISE EXCEPTION 'p_sort_desc is required' USING ERRCODE = '22023';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 500 THEN
    RAISE EXCEPTION 'p_limit must be between 1 and 500' USING ERRCODE = '22023';
  END IF;
  IF p_offset IS NULL OR p_offset < 0 OR p_offset > 5000 THEN
    RAISE EXCEPTION 'p_offset must be between 0 and 5000' USING ERRCODE = '22023';
  END IF;
  IF (
    p_observed_at_on_or_after IS NOT NULL
    AND p_observed_at_on_or_before IS NOT NULL
    AND p_observed_at_on_or_after > p_observed_at_on_or_before
  ) THEN
    RAISE EXCEPTION 'observedAt lower bound must not exceed upper bound' USING ERRCODE = '22023';
  END IF;

  IF p_sort_desc THEN
    RETURN QUERY
    SELECT mm.id, mm.effective_at, mm.payload
    FROM public.market_memory AS mm
    WHERE mm.record_type = 'OBSERVATION'
      AND mm.payload ->> 'domain' = p_domain
      AND (
        mm.payload #>> '{metadata,seriesId}' = p_series_key
        OR mm.payload #>> '{metadata,metricId}' = p_series_key
      )
      AND (p_source_id IS NULL OR mm.payload ->> 'sourceId' = p_source_id)
      AND mm.captured_at <= p_captured_at_on_or_before
      AND mm.effective_at >= COALESCE(
        p_observed_at_on_or_after,
        '-infinity'::timestamptz
      )
      AND mm.effective_at <= COALESCE(
        p_observed_at_on_or_before,
        'infinity'::timestamptz
      )
    ORDER BY mm.effective_at DESC, mm.id DESC
    LIMIT p_limit
    OFFSET p_offset;
  ELSE
    RETURN QUERY
    SELECT mm.id, mm.effective_at, mm.payload
    FROM public.market_memory AS mm
    WHERE mm.record_type = 'OBSERVATION'
      AND mm.payload ->> 'domain' = p_domain
      AND (
        mm.payload #>> '{metadata,seriesId}' = p_series_key
        OR mm.payload #>> '{metadata,metricId}' = p_series_key
      )
      AND (p_source_id IS NULL OR mm.payload ->> 'sourceId' = p_source_id)
      AND mm.captured_at <= p_captured_at_on_or_before
      AND mm.effective_at >= COALESCE(
        p_observed_at_on_or_after,
        '-infinity'::timestamptz
      )
      AND mm.effective_at <= COALESCE(
        p_observed_at_on_or_before,
        'infinity'::timestamptz
      )
    ORDER BY mm.effective_at ASC, mm.id ASC
    LIMIT p_limit
    OFFSET p_offset;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.p365_observation_history_candidates_v1(
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz,
  boolean,
  integer,
  integer
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.p365_observation_history_candidates_v1(
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz,
  boolean,
  integer,
  integer
) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.p365_observation_history_candidates_v1(
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz,
  boolean,
  integer,
  integer
) TO service_role;

COMMENT ON FUNCTION public.p365_observation_history_candidates_v1(
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz,
  boolean,
  integer,
  integer
) IS
  'Read-only bounded candidate transport for canonical Observation history. '
  'Preserves metadata seriesId/metricId candidate semantics; canonical identity, '
  'retrievedAt cutoff, and revision ordering remain application-validated.';
