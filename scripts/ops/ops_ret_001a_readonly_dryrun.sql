-- OPS-RET-001A / Issue #350 — READ-ONLY retention eligibility inventory.
-- This script is SELECT ONLY. It does not authorize a DELETE or prove replay safety.
-- Executed against existing canonical Market Memory records, with no DDL or cron calls.
-- A row without a documented explicit reference is NOT automatically safe to delete.
--
-- Age cutoffs use three distinct clocks; do not use calendar-day or observedAt alone:
-- (1) captured_at, (2) effective_at, (3) payload.retrievedAt.
-- Unparseable/missing time excludes the row from the old-on-all-clocks bucket.
-- current_timestamp is the runtime measurement anchor, not a frozen audit date.
WITH parameters AS (
  SELECT now() AS measured_at
),
horizons AS (
  SELECT hours FROM (VALUES (48), (72)) AS h(hours)
),
explicit_references AS (
  -- Snapshot arrays populated from observation, baseline, and event lineage.
  SELECT unnest(observation_ids) AS ref_id FROM public.market_memory
    WHERE record_type='SNAPSHOT'
  UNION ALL
  SELECT unnest(evidence_ids) AS ref_id FROM public.market_memory
    WHERE record_type='SNAPSHOT'
  UNION ALL
  -- CONTEXT references can exist without Snapshot references.
  SELECT jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(payload->'observationIds')='array'
      THEN payload->'observationIds' ELSE '[]'::jsonb END
  ) AS ref_id
  FROM public.market_memory WHERE record_type='CONTEXT'
  UNION ALL
  SELECT payload->>'evidenceId' AS ref_id FROM public.market_memory
    WHERE record_type IN ('EVENT','EVENT_RESULT')
),
reference_ids AS (
  SELECT DISTINCT ref_id FROM explicit_references WHERE ref_id IS NOT NULL
),
fact_rows AS (
  SELECT m.record_type, m.canonical_id, m.captured_at, m.effective_at,
    pg_column_size(m.payload)::bigint AS payload_bytes,
    CASE
      WHEN m.payload->>'sourceId'='coingecko-market'
        AND (m.payload#>>'{identity,seriesKey}' IN ('btc.spot.usd','eth.spot.usd')
          OR (m.record_type='EVIDENCE' AND m.payload->>'subject' IN ('btc.spot.usd','eth.spot.usd')))
        THEN 'BTC_ETH_5M'
      WHEN m.payload->>'sourceId'='yahoo-finance'
        AND (m.payload#>>'{identity,seriesKey}' IN ('gold.futures.usd','dxy.index.usd','fx.usdjpy.jpy_per_usd','fx.usdcnh.cnh_per_usd')
          OR (m.record_type='EVIDENCE' AND m.payload->>'subject' IN ('gold.futures.usd','dxy.index.usd','fx.usdjpy.jpy_per_usd','fx.usdcnh.cnh_per_usd')))
        THEN 'GOLD_DXY_FX_5M'
      WHEN m.payload->>'sourceId'='binance-spot'
        AND m.record_type='EVIDENCE'
        AND m.payload->>'subject'='Binance BTCUSDT completed 5m taker flow'
        THEN 'BINANCE_SPOT_FLOW_5M'
      ELSE NULL
    END AS family,
    CASE
      WHEN m.payload->>'retrievedAt' ~ '^20[0-9]{2}-[01][0-9]-'
        THEN (m.payload->>'retrievedAt')::timestamptz
      ELSE NULL
    END AS retrieved_at
  FROM public.market_memory m
  WHERE m.record_type IN ('OBSERVATION','EVIDENCE')
),
review_rows AS (
 SELECT p.measured_at,h.hours,f.family,f.record_type,f.canonical_id,f.captured_at,
 f.payload_bytes,
 f.captured_at < p.measured_at-make_interval(hours=>h.hours) AS captured_old,
 (f.captured_at < p.measured_at-make_interval(hours=>h.hours)
   AND f.effective_at < p.measured_at-make_interval(hours=>h.hours)
   AND f.retrieved_at < p.measured_at-make_interval(hours=>h.hours)) AS all_clocks_old,
 (r.ref_id IS NOT NULL) AS directly_referenced
 FROM fact_rows f CROSS JOIN parameters p CROSS JOIN horizons h
 LEFT JOIN reference_ids r ON r.ref_id=f.canonical_id
 WHERE f.family IS NOT NULL
)
SELECT measured_at,hours AS hot_hours,family,record_type,
 COUNT(*) FILTER(WHERE captured_old) AS captured_old_rows,
 COUNT(*) FILTER(WHERE all_clocks_old) AS old_all_three_clocks_rows,
 COUNT(*) FILTER(WHERE all_clocks_old AND directly_referenced) AS directly_protected_old_rows,
 COUNT(*) FILTER(WHERE all_clocks_old AND NOT directly_referenced) AS needs_indirect_lineage_review_rows,
 COALESCE(SUM(payload_bytes) FILTER(WHERE all_clocks_old),0)::bigint AS old_payload_bytes,
 COALESCE(SUM(payload_bytes) FILTER(WHERE all_clocks_old AND NOT directly_referenced),0)::bigint AS unreferenced_payload_upper_bound_bytes
FROM review_rows
GROUP BY 1,2,3,4
ORDER BY hot_hours,family,record_type;