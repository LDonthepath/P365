import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const script = readFileSync("scripts/ops/ops_free_001a_storage_guardrail.sql", "utf8");

// This is a source-safety/contract smoke test, not a substitute for PostgreSQL
// staging execution or natural post-activation evidence.
test("OPS-FREE-001A changes only existing daily job command, not schedule/history", () => {
  assert.match(script, /WHERE jobname = 'p365-storage-daily' AND active IS TRUE/);
  assert.match(script, /IF v_schedule <> '15 0 \* \* \*'/);
  assert.match(script, /cron\.alter_job\(/);
  assert.doesNotMatch(script, /cron\.schedule\(/i);
  assert.doesNotMatch(script, /\b(?:DELETE|TRUNCATE|VACUUM|REINDEX|DROP|ALTER\s+TABLE|CREATE\s+TABLE|UPDATE)\s+(?:FROM\s+)?(?:public\.market_memory|cron\.job_run_details)/i);
  assert.match(script, /WHERE NOT EXISTS \(/);
  assert.match(script, /prior\.occurred_at=c\.snapshot_day_utc/);
});

test("OPS-FREE-001A does not claim a hardcoded quota as verified entitlement", () => {
  assert.match(script, /'projectQuotaStatus','UNVERIFIED'/);
  assert.match(script, /'verifiedProjectQuotaBytes',NULL/);
  assert.match(script, /'thresholdMeaning','ABSOLUTE_OPERATIONAL_NOT_QUOTA_PERCENT'/);
  assert.match(script, /'publishedReferenceStatus','DOCUMENTATION_ONLY_NOT_ACCOUNT_SPECIFIC'/);
  assert.doesNotMatch(script, /524288000/);
  assert.doesNotMatch(script, /'databaseUtilizationPct'/);
  assert.doesNotMatch(script, /'estimatedHeadroomBytes'/);
});

function risk(measured: number, days: number | null): string {
  if (measured >= 450_000_000 || (days !== null && days <= 7)) return "CRITICAL";
  if (measured >= 425_000_000 || (days !== null && days <= 14)) return "ESCALATION";
  if (measured >= 375_000_000 || (days !== null && days <= 30)) return "WARNING";
  return "BELOW_OPERATING_THRESHOLDS";
}
test("OPS-FREE-001A exact byte boundary fixture and runway escalation ordering", () => {
  assert.equal(risk(374_999_999, null), "BELOW_OPERATING_THRESHOLDS");
  assert.equal(risk(375_000_000, null), "WARNING");
  assert.equal(risk(424_999_999, null), "WARNING");
  assert.equal(risk(425_000_000, null), "ESCALATION");
  assert.equal(risk(449_999_999, null), "ESCALATION");
  assert.equal(risk(450_000_000, null), "CRITICAL");
  assert.equal(risk(322_628_755, 19.3), "WARNING");
  assert.equal(risk(322_628_755, 7), "CRITICAL");
  assert.equal(risk(322_628_755, 14), "ESCALATION");
  assert.equal(risk(322_628_755, 30), "WARNING");
  assert.equal(risk(322_628_755, 31), "BELOW_OPERATING_THRESHOLDS");
});

test("OPS-FREE-001A insufficient, stale and nonpositive trends are not called safe", () => {
  assert.match(script, /'INSUFFICIENT_HISTORY'/);
  assert.match(script, /'NON_POSITIVE_GROWTH'/);
  assert.match(script, /'SHORT_WINDOW'/);
  assert.match(script, /r\.last_at >= now\(\) - interval '72 hours'/);
  assert.match(script, /NULLIF\(extract\(epoch FROM m\.measured_at - b\.measured_at\), 0\)/);
  assert.match(script, /WHEN t\.growth_bytes_per_day > 0/);
  assert.match(script, /'forecastCaveat','SHORT_NONSTATIONARY_HISTORY_NOT_EXACT_RUNWAY'/);
});
