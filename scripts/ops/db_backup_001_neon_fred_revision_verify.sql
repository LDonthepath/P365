-- DB-BACKUP-001 issue #331: read-only Neon live FRED revision pair verification.
-- Run against project snowy-flower-79929352, branch br-cold-hill-b3vq6nhq.
-- Separate from the 18-row multi-family sample. No row mutations.
SELECT count(*) AS restored_rows,
 count(DISTINCT payload #>> '{identity,measurementId}') AS measurement_ids,
 count(DISTINCT payload->>'value') AS distinct_values,
 count(DISTINCT payload #>> '{identity,revisionFingerprint}') AS distinct_fingerprints,
 count(DISTINCT dedupe_key) AS distinct_dedupe_keys,
 count(*) FILTER (
  WHERE captured_at <= '2026-10-05T00:00:00Z'::timestamptz
  AND (payload->>'retrievedAt')::timestamptz <= '2026-10-05T00:00:00Z'::timestamptz
 ) AS versions_eligible_as_of_oct5,
 md5(string_agg(id::text||'|'||dedupe_key||'|'||md5(payload::text),'~' ORDER BY id::text)) AS manifest,
 md5(string_agg(id::text||'|'||dedupe_key||'|'||md5(payload::text),'~' ORDER BY id::text))
 = '7fd554d31e6b4e30062dd9cb30c408f0' AS manifest_matches_source
FROM recovery_drill_331.fred_observation_revision_pair;
