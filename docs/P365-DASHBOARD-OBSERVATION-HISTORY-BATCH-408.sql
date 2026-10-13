-- RECOVERY-G2-08 / #408: OWNER-APPROVAL REQUIRED BEFORE PRODUCTION EXECUTION.
-- Additive *transport only*. Preserve the existing single-series RPC exactly.
-- No CREATE/GRANT/ALTER/rollout has been executed in production by this PR.
-- The application flag P365_DURABLE_PROJECTION_BATCH=enabled remains OFF by default.
--
-- Bounded response: at most 16 calls x 32 rows = 512 (below the default
-- PostgREST response-row cap). Each entry retains its original captured-at,
-- effective-at, provenance, order, offset and page-limit parameters.
CREATE OR REPLACE FUNCTION public.p365_observation_history_candidates_batch_v1(
  p_requests jsonb
)
RETURNS TABLE (
  request_index integer,
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
  IF p_requests IS NULL OR jsonb_typeof(p_requests) <> 'array'
    OR jsonb_array_length(p_requests) < 1 OR jsonb_array_length(p_requests) > 16 THEN
    RAISE EXCEPTION 'batch requires 1..16 requests' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_requests) AS request(value)
    WHERE jsonb_typeof(request.value) <> 'object'
      OR jsonb_typeof(request.value -> 'p_limit') <> 'number'
      OR (request.value ->> 'p_limit')::integer NOT BETWEEN 1 AND 32
      OR jsonb_typeof(request.value -> 'p_offset') <> 'number'
      OR (request.value ->> 'p_offset')::integer NOT BETWEEN 0 AND 5000
      OR jsonb_typeof(request.value -> 'p_captured_at_on_or_before') <> 'string'
  ) THEN
    RAISE EXCEPTION 'invalid or unbounded Observation batch request' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT r.ordinality::integer, candidate.id, candidate.effective_at, candidate.payload
  FROM jsonb_array_elements(p_requests) WITH ORDINALITY AS r(value, ordinality)
  CROSS JOIN LATERAL public.p365_observation_history_candidates_v1(
    r.value ->> 'p_domain',
    r.value ->> 'p_series_key',
    r.value ->> 'p_source_id',
    (r.value ->> 'p_observed_at_on_or_after')::timestamptz,
    (r.value ->> 'p_observed_at_on_or_before')::timestamptz,
    (r.value ->> 'p_captured_at_on_or_before')::timestamptz,
    (r.value ->> 'p_sort_desc')::boolean,
    (r.value ->> 'p_limit')::integer,
    (r.value ->> 'p_offset')::integer
  ) AS candidate
  ORDER BY r.ordinality,
    CASE WHEN (r.value ->> 'p_sort_desc')::boolean THEN candidate.effective_at END DESC,
    CASE WHEN (r.value ->> 'p_sort_desc')::boolean THEN candidate.id END DESC,
    CASE WHEN NOT (r.value ->> 'p_sort_desc')::boolean THEN candidate.effective_at END ASC,
    CASE WHEN NOT (r.value ->> 'p_sort_desc')::boolean THEN candidate.id END ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.p365_observation_history_candidates_batch_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.p365_observation_history_candidates_batch_v1(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.p365_observation_history_candidates_batch_v1(jsonb) TO service_role;

COMMENT ON FUNCTION public.p365_observation_history_candidates_batch_v1(jsonb)
IS 'GET-only bounded multi-series transport for p365_observation_history_candidates_v1; caller enforces canonical retrievedAt, revisions and tie-aware pagination.';
