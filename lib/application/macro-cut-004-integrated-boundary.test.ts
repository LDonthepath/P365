import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("MACRO-CUT-004: integrated SQL is read-only / fail-closed, never silently mutates production", () => {
  const sql = readFileSync(new URL("../../scripts/ops/macro_cut_004_inventory_readonly.sql",import.meta.url),"utf8");
  const execution = readFileSync(new URL("../../scripts/ops/macro_cut_004_execution_blocked.sql",import.meta.url),"utf8");
  assert.match(sql,/COALESCE\(source_id, payload->>'sourceId'/);
  assert.match(sql,/observation_ids/);
  assert.match(sql,/evidence_ids/);
  assert.match(sql,/jsonb_array_elements_text/);
  assert.match(sql,/md5\(j\.command\)/);
  assert.match(sql,/STOP_DRIFT_OR_ACTIVE_JOB/);
  const scrub = (text: string) => text.replace(/--[^\n]*/g,"");
  assert.doesNotMatch(scrub(sql),/\b(?:DELETE|UPDATE|TRUNCATE|DROP|ALTER|INSERT|GRANT|REVOKE|CREATE)\s/i);
  assert.doesNotMatch(scrub(execution),/\b(?:DELETE|UPDATE|TRUNCATE|DROP|ALTER|INSERT|GRANT|REVOKE|CREATE)\s/i);
  assert.match(execution,/RAISE EXCEPTION 'MACRO-CUT-004 BLOCKED/);
  assert.doesNotMatch(scrub(execution),/cron\.(?:unschedule|schedule|alter_job)\s*\(/);
});
test("MACRO-CUT-004: provider/source archival, cron and history boundaries documented together", () => {
  const readme=readFileSync(new URL("../../README.md",import.meta.url),"utf8");
  const audit=readFileSync(new URL("../../docs/P365-MARKET-MEMORY-STORAGE-GROWTH-AUDIT-2026-10-04.md",import.meta.url),"utf8");
  const ops=readFileSync(new URL("../../docs/OPS-CRON-NAME-001-OPERATOR-RUNBOOK.md",import.meta.url),"utf8");
  for(const doc of [readme,audit,ops])assert.match(doc,/MACRO-CUT-004/);
  assert.match(audit,/103,067/);
  assert.match(audit,/212 Yahoo/);
  assert.match(audit,/190 CoinGecko/);
  assert.match(ops,/#3.*Biquote/);
  assert.match(ops,/backup|restore/i);
});
