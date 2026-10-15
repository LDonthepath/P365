import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("MACRO-CUT-005: history manifest preserves archival identity and is read-only", () => {
  const sql=readFileSync(new URL("../../scripts/ops/macro_cut_005_reference_closure_readonly.sql",import.meta.url),"utf8");
  const noComments=sql.replace(/--[^\n]*/g,"");
  assert.match(sql,/COALESCE\(m\.source_id,m\.payload->>'sourceId'/);
  assert.match(sql,/record_type/);
  assert.match(sql,/payload_hash/);
  assert.match(sql,/dedupe_key/);
  assert.match(sql,/observation_ids/);
  assert.match(sql,/evidence_ids/);
  assert.match(sql,/event_ids/);
  assert.match(sql,/observationIds/);
  assert.match(sql,/supersedes_id/);
  assert.match(sql,/invalidates_id/);
  assert.match(sql,/PASS_APPEND_ONLY_ACTIVE/);
  assert.match(sql,/PASS_RETAINED_CRON/);
  assert.match(sql,/PASS_NO_RETIRED_JOBS/);
  assert.match(sql,/UNLINKED_IN_KNOWN_PATHS/);
  assert.doesNotMatch(noComments,/\b(?:DELETE|UPDATE|TRUNCATE|DROP|ALTER|INSERT|GRANT|REVOKE|CREATE)\s/i);
  assert.doesNotMatch(noComments,/cron\.(?:unschedule|schedule|alter_job)\s*\(/);
});

test("MACRO-CUT-005: operator docs keep backup, Biquote, snapshot and macro guardrails", () => {
  const paths=["../../README.md","../../docs/P365-ARCHITECTURE.md",
    "../../docs/P365-MARKET-MEMORY-STORAGE-GROWTH-AUDIT-2026-10-04.md",
    "../../docs/OPS-CRON-NAME-001-OPERATOR-RUNBOOK.md"];
  for(const path of paths) {
    const doc=readFileSync(new URL(path,import.meta.url),"utf8");
    assert.match(doc,/MACRO-CUT-005/);
    assert.match(doc,/backup|restore/i);
    assert.match(doc,/Snapshot|SNAPSHOT/);
    assert.match(doc,/Biquote|biquote/);
  }
});
